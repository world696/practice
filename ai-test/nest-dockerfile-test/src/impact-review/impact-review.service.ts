import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import {
  BrowserAuthInput,
  BrowserEvent,
  ChangedFile,
  CreateReviewDto,
  ImpactArea,
  ReviewRecord,
  TestPlanItem,
  TestType,
  FrontendTarget,
} from './impact-review.types';

const execFileAsync = promisify(execFile);
const TEST_COMMANDS: Record<TestType, string> = {
  frontend: 'browser check (URL, title, required text)',
  unit: 'npm test -- --runInBand',
  integration: 'npm run test:integration -- --runInBand',
  e2e: 'npm run test:e2e -- --runInBand',
  security: 'npm run test:security -- --runInBand',
  build: 'npm run build',
};

@Injectable()
export class ImpactReviewService {
  private readonly reviews = new Map<string, ReviewRecord>();
  private readonly browserAuth = new Map<string, BrowserAuthInput | undefined>();
  private readonly screenshots = new Map<string, string>();

  create(input: CreateReviewDto) {
    this.validate(input);
    const id = randomUUID();
    const now = new Date().toISOString();
    const { browserAuth, ...safeInput } = input;
    const record: ReviewRecord = {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      request: {
        ...safeInput,
        environment: input.environment || 'staging',
        testTypes: input.testTypes?.length ? input.testTypes : undefined,
        deploy: input.deploy ?? true,
        browserAuth: browserAuth ? { mode: browserAuth.mode, provided: true } : undefined,
      },
      changedFiles: [],
      impactAreas: [],
      testPlan: [],
      events: [],
      screenshotReady: false,
      deployment: {
        requested: input.deploy ?? true,
        status: input.deploy === false ? 'not_requested' : 'pending_adapter',
        environment: input.environment || 'staging',
      },
      results: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, conclusion: '等待测试完成', steps: [] },
    };
    this.reviews.set(id, record);
    this.browserAuth.set(id, browserAuth);
    void this.run(record);
    return record;
  }

  list() {
    return [...this.reviews.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string) {
    const review = this.reviews.get(id);
    if (!review) throw new NotFoundException(`Impact review ${id} not found`);
    return review;
  }

  getScreenshotPath(id: string) {
    this.get(id);
    const path = this.screenshots.get(id);
    if (!path || !existsSync(path)) throw new NotFoundException(`Screenshot for review ${id} not found`);
    return path;
  }

  retry(id: string) {
    const review = this.get(id);
    if (review.status !== 'failed') {
      throw new BadRequestException('Only failed reviews can be retried');
    }
    review.results = [];
    review.error = undefined;
    review.status = 'queued';
    void this.run(review);
    return review;
  }

  private validate(input: CreateReviewDto) {
    if (!input.repositoryPath || (!input.commit && !input.remoteBranch)) {
      throw new BadRequestException('repositoryPath and either commit or remoteBranch are required');
    }
    if (!existsSync(input.repositoryPath)) {
      throw new BadRequestException('repositoryPath does not exist');
    }
    if ((input.testTypes || []).includes('frontend') && !input.frontendUrl && !input.frontendTargets?.length) {
      throw new BadRequestException('frontendUrl or frontendTargets is required when frontend test is selected');
    }
    if (input.frontendUrl && !/^https?:\/\//.test(input.frontendUrl)) {
      throw new BadRequestException('frontendUrl must start with http:// or https://');
    }
    for (const target of input.frontendTargets || []) {
      if (!target.name || !/^https?:\/\//.test(target.url)) throw new BadRequestException('Each frontend target needs a name and an http(s) URL');
    }
    if (input.browserAuth?.mode === 'bearer' && !input.browserAuth.token) {
      throw new BadRequestException('Bearer Token is required for bearer authentication');
    }
    if (input.browserAuth?.mode === 'cookie' && (!input.browserAuth.cookieName || !input.browserAuth.cookieValue)) {
      throw new BadRequestException('Cookie name and value are required for cookie authentication');
    }
    for (const type of input.testTypes || []) {
      if (!TEST_COMMANDS[type]) throw new BadRequestException(`Unsupported test type: ${type}`);
    }
  }

  private async run(review: ReviewRecord) {
    try {
      review.status = 'analyzing';
      this.addEvent(review, { type: 'step', message: '正在解析 commit 和改动范围' });
      review.updatedAt = new Date().toISOString();
      const repo = review.request.repositoryPath;
      const commit = await this.resolveCommit(repo, review.request);
      review.resolvedCommit = commit;
      const base = review.request.baseCommit || `${commit}^`;
      const [files, commitMessage, diff] = await Promise.all([
        this.git(repo, ['diff', '--name-status', base, commit]),
        this.git(repo, ['show', '-s', '--format=%s', commit]),
        this.git(repo, ['diff', '--unified=0', base, commit]),
      ]);
      review.commitMessage = commitMessage.trim();
      review.changedFiles = this.parseChangedFiles(files, diff);
      review.impactAreas = this.analyzeImpact(review.changedFiles, diff);
      this.addEvent(review, { type: 'step', message: `Diff 解析完成 · ${review.changedFiles.length} 个文件 · ${review.impactAreas.length} 个影响区域` });
      for (const area of review.impactAreas) this.addEvent(review, { type: 'step', message: `影响点：${area.name} · ${area.affected}` });
      review.testPlan = this.buildTestPlan(review);
      this.addEvent(review, { type: 'step', message: `自动选择 ${review.testPlan.filter((item) => item.selected).length} 项测试` });
      review.status = 'waiting_for_deployment';
      review.updatedAt = new Date().toISOString();

      // Deployment is intentionally an adapter boundary. The review remains auditable
      // instead of claiming a deployment that this sample service cannot perform.
      if (review.deployment.requested) {
        review.deployment.status = 'pending_adapter';
        review.status = 'running';
      } else {
      review.status = 'running';
      }
      this.addEvent(review, { type: 'step', message: review.testPlan.some((item) => item.type === 'frontend' && item.selected) ? '开始启动真实浏览器验证' : '开始执行测试计划' });
      await this.executeTests(review);
      review.status = review.results.some((result) => result.status === 'failed') ? 'failed' : 'passed';
      this.refreshSummary(review);
      this.addEvent(review, { type: 'step', message: review.status === 'passed' ? '全部选定检查完成' : '检查完成，但存在失败项', level: review.status === 'passed' ? 'info' : 'warning' });
    } catch (error) {
      review.status = 'failed';
      review.error = error instanceof Error ? error.message : String(error);
      this.refreshSummary(review);
    } finally {
      this.browserAuth.delete(review.id);
      review.updatedAt = new Date().toISOString();
    }
  }

  private async resolveCommit(repo: string, request: CreateReviewDto) {
    if (request.remoteBranch) {
      const remote = request.remote || 'origin';
      await this.git(repo, ['fetch', '--no-tags', remote, request.remoteBranch]);
      const fetched = (await this.git(repo, ['rev-parse', 'FETCH_HEAD'])).trim();
      if (!fetched) throw new BadRequestException(`Remote branch ${remote}/${request.remoteBranch} returned no commit`);
      if (request.mergeRemote) await this.mergeFetchedCommit(repo, fetched);
      return fetched;
    }
    try {
      return (await this.git(repo, ['rev-parse', '--verify', `${request.commit}^{commit}`])).trim();
    } catch {
      throw new BadRequestException(`Commit ${request.commit} is not available locally; fill in a remote branch to fetch it first`);
    }
  }

  private async mergeFetchedCommit(repo: string, commit: string) {
    const status = (await this.git(repo, ['status', '--porcelain'])).trim();
    if (status) throw new BadRequestException('Cannot merge remote branch: local working tree is not clean');
    try {
      await this.git(repo, ['merge', '--ff-only', commit]);
    } catch {
      throw new BadRequestException('Remote branch was fetched, but it cannot be fast-forwarded into the current branch');
    }
  }

  private async executeTests(review: ReviewRecord) {
    const packageJsonPath = join(review.request.repositoryPath, 'package.json');
    let scripts: Record<string, string> = {};
    if (existsSync(packageJsonPath)) {
      try {
        scripts = JSON.parse(readFileSync(packageJsonPath, 'utf8')).scripts || {};
      } catch {
        // The Git analysis is still useful even when package.json is malformed.
      }
    }
    for (const item of review.testPlan.filter((candidate) => candidate.selected)) {
      const started = Date.now();
      this.addEvent(review, { type: 'step', message: `开始执行 ${item.type}` });
      if (item.type === 'frontend') {
        await this.executeFrontendCheck(review, started);
        continue;
      }
      const scriptName = item.type === 'build' ? 'build' : item.type === 'e2e' ? 'test:e2e' : `test:${item.type}`;
      const hasScript = item.type === 'unit' ? Boolean(scripts.test) : Boolean(scripts[scriptName]);
      if (!hasScript) {
        review.results.push({ type: item.type, status: 'skipped', durationMs: Date.now() - started, output: `No ${item.type === 'unit' ? 'test' : scriptName} script found` });
        this.addEvent(review, { type: 'step', message: `${item.type} 跳过：未找到对应脚本`, level: 'warning' });
        continue;
      }
      try {
        const command = item.type === 'unit' ? 'test' : scriptName;
        const args = item.type === 'unit' ? ['run', command, '--', '--runInBand'] : ['run', command, '--', '--runInBand'];
        const result = await execFileAsync('npm', args, { cwd: review.request.repositoryPath, timeout: 120_000, maxBuffer: 2_000_000 });
        review.results.push({ type: item.type, status: 'passed', durationMs: Date.now() - started, output: `${result.stdout}${result.stderr}`.slice(-4000) });
        this.addEvent(review, { type: 'step', message: `${item.type} 通过 · ${Date.now() - started}ms` });
      } catch (error: any) {
        review.results.push({ type: item.type, status: 'failed', durationMs: Date.now() - started, output: `${error.stdout || ''}`.slice(-4000), error: error.message });
        this.addEvent(review, { type: 'error', level: 'error', message: `${item.type} 失败 · ${error.message}` });
      }
    }
  }

  private async executeFrontendCheck(review: ReviewRecord, started: number) {
    const targets = this.frontendTargets(review.request);
    if (!targets.length) {
      review.results.push({ type: 'frontend', status: 'skipped', durationMs: 0, output: 'No frontendUrl provided' });
      return;
    }
    for (const target of targets) await this.executeFrontendTarget(review, target, started);
  }

  private async executeFrontendTarget(review: ReviewRecord, target: FrontendTarget, started: number) {
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    const auth = this.browserAuth.get(review.id);
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    let status = 0;
    let title = '';
    const interactionErrors: string[] = [];
    try {
      const executablePath = this.browserExecutablePath();
      browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
      const targetUrl = new URL(target.url);
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      if (auth?.mode === 'bearer' && auth.token) {
        await context.route('**/*', async (route) => {
          const requestUrl = new URL(route.request().url());
          const headers = { ...route.request().headers() };
          if (requestUrl.origin === targetUrl.origin) headers.authorization = `Bearer ${auth.token}`;
          await route.continue({ headers });
        });
      }
      if (auth?.mode === 'cookie' && auth.cookieName && auth.cookieValue) {
        await context.addCookies([{ name: auth.cookieName, value: auth.cookieValue, domain: targetUrl.hostname, path: '/' }]);
      }
      const page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          const text = message.text();
          (message.type() === 'error' ? consoleErrors : consoleWarnings).push(text);
          this.addEvent(review, { type: 'console', level: message.type() === 'error' ? 'error' : 'warning', message: text });
        }
      });
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
        this.addEvent(review, { type: 'pageerror', level: 'error', message: error.message });
      });
      page.on('request', (request) => this.addEvent(review, { type: 'request', message: `${request.method()} ${request.url()}`, url: request.url() }));
      page.on('requestfailed', (request) => {
        failedRequests.push(request.url());
        this.addEvent(review, { type: 'request', level: 'error', message: `请求失败 ${request.url()} · ${request.failure()?.errorText || 'unknown'}`, url: request.url() });
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          failedRequests.push(response.url());
          this.addEvent(review, { type: 'response', level: 'error', message: `HTTP ${response.status()} ${response.url()}`, url: response.url() });
        }
      });
      this.addEvent(review, { type: 'step', message: `打开应用「${target.name}」 ${target.url}` });
      const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      status = response?.status() || 0;
      title = await page.title();
      this.addEvent(review, { type: 'step', message: `页面加载完成 · HTTP ${status} · 标题「${title || '(empty)'}」` });
      try { await page.waitForLoadState('networkidle', { timeout: 10_000 }); } catch { this.addEvent(review, { type: 'step', message: '网络仍有活动，继续执行页面检查', level: 'warning' }); }
      const check = review.request.frontendCheck || {};
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const missingText = (check.requiredText || []).filter((text) => !bodyText.includes(text));
      const expectedStatus = check.expectedStatus ?? 200;
      const titleOk = !check.expectedTitle || title === check.expectedTitle;
      const explicitSelectors = check.clickSelectors || [];
      for (const selector of explicitSelectors) {
        this.addEvent(review, { type: 'step', message: `点击元素 ${selector}` });
        try {
          await page.locator(selector).first().click({ timeout: 10_000 });
        } catch (error) {
          interactionErrors.push(selector);
          this.addEvent(review, { type: 'error', level: 'error', message: `点击失败 ${selector} · ${error instanceof Error ? error.message : String(error)}` });
        }
      }
      if (!explicitSelectors.length && check.autoClick !== false) {
        const candidates = await page.locator('button[type="button"], [role="button"]').all();
        const safeCandidates = candidates.slice(0, 3);
        if (!safeCandidates.length) {
          this.addEvent(review, { type: 'step', message: '未发现安全点击目标，跳过交互', level: 'warning' });
        }
        for (const candidate of safeCandidates) {
          const label = (await candidate.innerText().catch(() => '')).trim().slice(0, 60) || '未命名按钮';
          this.addEvent(review, { type: 'step', message: `模拟安全点击「${label}」` });
          try {
            await candidate.click({ timeout: 10_000 });
          } catch (error) {
            interactionErrors.push(label);
            this.addEvent(review, { type: 'error', level: 'error', message: `模拟点击失败「${label}」 · ${error instanceof Error ? error.message : String(error)}` });
          }
        }
      }
      const screenshotDir = join(tmpdir(), 'impact-review-screenshots');
      mkdirSync(screenshotDir, { recursive: true });
      const screenshotPath = join(screenshotDir, `${review.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      this.screenshots.set(review.id, screenshotPath);
      review.screenshotReady = true;
      this.addEvent(review, { type: 'screenshot', message: '已生成页面截图' });
      const passed = status === expectedStatus && missingText.length === 0 && titleOk && consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 && interactionErrors.length === 0;
      review.results.push({
        type: 'frontend',
        status: passed ? 'passed' : 'failed',
        durationMs: Date.now() - started,
        output: `HTTP ${status}; title: ${title || '(empty)'}; console errors: ${consoleErrors.length}; failed requests: ${failedRequests.length}`,
        error: passed ? undefined : `页面检查失败：${missingText.length ? `缺少文案 ${missingText.join(', ')}；` : ''}${titleOk ? '' : `标题不匹配，实际为「${title}」；`}${consoleErrors.length ? `控制台错误 ${consoleErrors.length} 个；` : ''}${pageErrors.length ? `页面异常 ${pageErrors.length} 个；` : ''}${failedRequests.length ? `失败请求 ${failedRequests.length} 个；` : ''}${interactionErrors.length ? `交互失败 ${interactionErrors.length} 个；` : ''}`,
        details: { name: target.name, url: target.url, status, title, missingText, consoleErrors: consoleErrors.length, consoleWarnings: consoleWarnings.length, pageErrors: pageErrors.length, failedRequests: failedRequests.length, interactionErrors: interactionErrors.length, screenshotReady: true },
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message = /Executable doesn't exist|executable doesn't exist|browserType\.launch/i.test(rawMessage)
        ? `${rawMessage}。未找到可用浏览器，请在部署环境执行「pnpm exec playwright install chromium」，或配置 PLAYWRIGHT_BROWSER_PATH。`
        : rawMessage;
      this.addEvent(review, { type: 'error', level: 'error', message: `应用「${target.name}」验证失败 · ${message}` });
      review.results.push({ type: 'frontend', status: 'failed', durationMs: Date.now() - started, error: this.redact(review, message), details: { name: target.name, url: target.url, status, title, screenshotReady: false } });
    } finally {
      await browser?.close();
    }
  }

  private frontendTargets(request: ReviewRecord['request']): FrontendTarget[] {
    return request.frontendTargets?.length ? request.frontendTargets : request.frontendUrl ? [{ name: '默认应用', url: request.frontendUrl }] : [];
  }

  private browserExecutablePath() {
    const candidates = [
      process.env.PLAYWRIGHT_BROWSER_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      `${process.env.ProgramFiles || 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    ].filter(Boolean) as string[];
    return candidates.find((candidate) => existsSync(candidate));
  }

  private refreshSummary(review: ReviewRecord) {
    const passed = review.results.filter((result) => result.status === 'passed').length;
    const failed = review.results.filter((result) => result.status === 'failed').length;
    const skipped = review.results.filter((result) => result.status === 'skipped').length;
    const resultByType = new Map<TestType, ReviewRecord['results'][number]>();
    for (const result of review.results) if (!resultByType.has(result.type)) resultByType.set(result.type, result);
    const steps = review.testPlan.map((item) => {
      const result = resultByType.get(item.type);
      return {
        name: item.type,
        status: result?.status || 'skipped',
        detail: result?.error || result?.output || (item.selected ? '执行中或等待结果' : item.reason),
      } as const;
    });
    review.summary = {
      total: review.results.length,
      passed,
      failed,
      skipped,
      conclusion: failed
        ? `共完成 ${review.results.length} 项检查，其中 ${failed} 项失败，需要处理后再发布评估`
        : `共完成 ${review.results.length} 项检查，未发现阻断问题，可以进入下一步发布评估`,
      steps,
    };
  }

  private addEvent(review: ReviewRecord, event: Omit<BrowserEvent, 'at'>) {
    if (review.events.length >= 250) return;
    review.events.push({ ...event, message: this.redact(review, event.message), at: new Date().toISOString() });
    review.updatedAt = new Date().toISOString();
  }

  private redact(review: ReviewRecord, value: string) {
    let safe = value;
    const auth = this.browserAuth.get(review.id);
    for (const secret of [auth?.token, auth?.cookieValue].filter(Boolean) as string[]) safe = safe.split(secret).join('[REDACTED]');
    return safe;
  }

  private parseChangedFiles(raw: string, diff: string): ChangedFile[] {
    const counts = new Map<string, { additions: number; deletions: number }>();
    let current = '';
    for (const line of diff.split('\n')) {
      const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (fileMatch) current = fileMatch[2];
      const count = counts.get(current) || { additions: 0, deletions: 0 };
      if (line.startsWith('+') && !line.startsWith('+++')) count.additions++;
      if (line.startsWith('-') && !line.startsWith('---')) count.deletions++;
      if (current) counts.set(current, count);
    }
    return raw.split('\n').filter(Boolean).map((line) => {
      const [status, ...parts] = line.split('\t');
      const path = parts.at(-1) || '';
      return { status, path, ...(counts.get(path) || { additions: 0, deletions: 0 }) };
    });
  }

  private analyzeImpact(files: ChangedFile[], diff: string): ImpactArea[] {
    const groups = new Map<string, ImpactArea>();
    const details: Record<string, { affected: string; recommendedChecks: string[] }> = {
      '认证与权限': { affected: '登录、Token、会话和角色权限边界', recommendedChecks: ['未登录访问', 'Token 过期', '低权限用户访问高权限页面'] },
      '接口兼容性': { affected: '页面调用的接口参数、响应结构和错误处理', recommendedChecks: ['正常响应', '空数据/错误响应', '旧参数兼容'] },
      '数据与迁移': { affected: '数据库结构、查询结果和存量数据读写', recommendedChecks: ['迁移执行', '旧数据读取', '新增/更新/删除链路'] },
      '核心业务链路': { affected: '订单、计费、价格和资金相关操作', recommendedChecks: ['主流程', '重复提交', '异常回滚'] },
      '发布与配置': { affected: '构建产物、运行时配置和部署行为', recommendedChecks: ['构建', '环境变量', '发布后健康检查'] },
      '测试覆盖': { affected: '已有测试是否覆盖本次改动', recommendedChecks: ['相关单测', '集成测试', '回归测试'] },
      '前端交互': { affected: '页面组件、样式和用户点击行为', recommendedChecks: ['页面加载', '关键点击', '不同视口'] },
      '大范围变更': { affected: '变更范围较大导致的连带回归风险', recommendedChecks: ['全量构建', '核心链路回归', '性能基线'] },
      '输入与代码安全': { affected: '用户输入、HTML 注入和命令执行边界', recommendedChecks: ['恶意输入', '权限绕过', '输出编码'] },
    };
    const add = (name: string, reason: string, risk: ImpactArea['risk'], file: string) => {
      const existing = groups.get(name) || { name, reason, ...details[name], risk, files: [] };
      if (!existing.files.includes(file)) existing.files.push(file);
      if (risk === 'critical' || (risk === 'high' && existing.risk === 'medium')) existing.risk = risk;
      groups.set(name, existing);
    };
    for (const file of files) {
      const path = file.path.toLowerCase();
      if (/auth|login|permission|role|token|session/.test(path)) add('认证与权限', '命中认证、会话或权限相关文件', 'critical', file.path);
      if (/api|controller|route|dto|schema|graphql/.test(path)) add('接口兼容性', '接口、参数或数据契约可能发生变化', 'high', file.path);
      if (/db|migration|entity|model|repository|sql/.test(path)) add('数据与迁移', '数据模型、查询或迁移可能影响存量数据', 'critical', file.path);
      if (/payment|order|billing|price|money/.test(path)) add('核心业务链路', '命中订单、计费或资金相关逻辑', 'critical', file.path);
      if (/config|env|docker|deploy|helm|yaml|yml/.test(path)) add('发布与配置', '发布配置或运行时参数发生变化', 'high', file.path);
      if (/test|spec/.test(path)) add('测试覆盖', '测试代码发生变化，需要确认覆盖是否同步', 'low', file.path);
      if (/\.css$|\.scss$|\.tsx$|\.vue$/.test(path)) add('前端交互', '前端组件或样式可能影响页面行为', 'medium', file.path);
      if (file.additions + file.deletions > 200) add('大范围变更', '单文件变更量较大，建议扩大回归范围', 'high', file.path);
    }
    if (/eval\s*\(|innerHTML|dangerouslySetInnerHTML|child_process|exec\(/i.test(diff)) add('输入与代码安全', '检测到高风险输入处理或命令执行模式', 'critical', 'diff 内容');
    return [...groups.values()];
  }

  private buildTestPlan(review: ReviewRecord): TestPlanItem[] {
    const requested = review.request.testTypes;
    const critical = review.impactAreas.some((area) => area.risk === 'critical');
    const selected = new Set(requested?.length ? requested : (['frontend', 'unit', 'integration', 'e2e', 'security', 'build'] as TestType[]));
    return (Object.keys(TEST_COMMANDS) as TestType[]).map((type) => ({
      type,
      reason: type === 'frontend' ? (this.frontendTargets(review.request).length ? `验证 ${this.frontendTargets(review.request).length} 个应用页面可达、标题和关键文案` : '未提供前端地址，跳过页面检查') : type === 'security' && critical ? '存在高风险影响点，必须执行安全回归' : `基于 ${review.impactAreas.length} 个影响区域自动选择`,
      command: TEST_COMMANDS[type],
      selected: (type === 'frontend' ? this.frontendTargets(review.request).length > 0 : selected.has(type)) || (type === 'security' && critical),
    }));
  }

  private async git(repo: string, args: string[]) {
    const result = await execFileAsync('git', args, { cwd: repo, timeout: 30_000, maxBuffer: 4_000_000 });
    return result.stdout;
  }
}
