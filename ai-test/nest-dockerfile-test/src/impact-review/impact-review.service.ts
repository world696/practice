import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import {
  ChangedFile,
  CreateReviewDto,
  ImpactArea,
  ReviewRecord,
  TestPlanItem,
  TestType,
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

  create(input: CreateReviewDto) {
    this.validate(input);
    const id = randomUUID();
    const now = new Date().toISOString();
    const record: ReviewRecord = {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      request: {
        ...input,
        environment: input.environment || 'staging',
        testTypes: input.testTypes?.length ? input.testTypes : undefined,
        deploy: input.deploy ?? true,
      },
      changedFiles: [],
      impactAreas: [],
      testPlan: [],
      deployment: {
        requested: input.deploy ?? true,
        status: input.deploy === false ? 'not_requested' : 'pending_adapter',
        environment: input.environment || 'staging',
      },
      results: [],
    };
    this.reviews.set(id, record);
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
    if (!input.repositoryPath || !input.commit) {
      throw new BadRequestException('repositoryPath and commit are required');
    }
    if (!existsSync(input.repositoryPath)) {
      throw new BadRequestException('repositoryPath does not exist');
    }
    if ((input.testTypes || []).includes('frontend') && !input.frontendUrl) {
      throw new BadRequestException('frontendUrl is required when frontend test is selected');
    }
    if (input.frontendUrl && !/^https?:\/\//.test(input.frontendUrl)) {
      throw new BadRequestException('frontendUrl must start with http:// or https://');
    }
    for (const type of input.testTypes || []) {
      if (!TEST_COMMANDS[type]) throw new BadRequestException(`Unsupported test type: ${type}`);
    }
  }

  private async run(review: ReviewRecord) {
    try {
      review.status = 'analyzing';
      review.updatedAt = new Date().toISOString();
      const repo = review.request.repositoryPath;
      const base = review.request.baseCommit || `${review.request.commit}^`;
      const [files, commitMessage, diff] = await Promise.all([
        this.git(repo, ['diff', '--name-status', base, review.request.commit]),
        this.git(repo, ['show', '-s', '--format=%s', review.request.commit]),
        this.git(repo, ['diff', '--unified=0', base, review.request.commit]),
      ]);
      review.commitMessage = commitMessage.trim();
      review.changedFiles = this.parseChangedFiles(files, diff);
      review.impactAreas = this.analyzeImpact(review.changedFiles, diff);
      review.testPlan = this.buildTestPlan(review);
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
      await this.executeTests(review);
      review.status = review.results.some((result) => result.status === 'failed') ? 'failed' : 'passed';
    } catch (error) {
      review.status = 'failed';
      review.error = error instanceof Error ? error.message : String(error);
    } finally {
      review.updatedAt = new Date().toISOString();
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
      if (item.type === 'frontend') {
        await this.executeFrontendCheck(review, started);
        continue;
      }
      const scriptName = item.type === 'build' ? 'build' : item.type === 'e2e' ? 'test:e2e' : `test:${item.type}`;
      const hasScript = item.type === 'unit' ? Boolean(scripts.test) : Boolean(scripts[scriptName]);
      if (!hasScript) {
        review.results.push({ type: item.type, status: 'skipped', durationMs: Date.now() - started, output: `No ${item.type === 'unit' ? 'test' : scriptName} script found` });
        continue;
      }
      try {
        const command = item.type === 'unit' ? 'test' : scriptName;
        const args = item.type === 'unit' ? ['run', command, '--', '--runInBand'] : ['run', command, '--', '--runInBand'];
        const result = await execFileAsync('npm', args, { cwd: review.request.repositoryPath, timeout: 120_000, maxBuffer: 2_000_000 });
        review.results.push({ type: item.type, status: 'passed', durationMs: Date.now() - started, output: `${result.stdout}${result.stderr}`.slice(-4000) });
      } catch (error: any) {
        review.results.push({ type: item.type, status: 'failed', durationMs: Date.now() - started, output: `${error.stdout || ''}`.slice(-4000), error: error.message });
      }
    }
  }

  private async executeFrontendCheck(review: ReviewRecord, started: number) {
    if (!review.request.frontendUrl) {
      review.results.push({ type: 'frontend', status: 'skipped', durationMs: 0, output: 'No frontendUrl provided' });
      return;
    }
    try {
      const response = await fetch(review.request.frontendUrl, { signal: AbortSignal.timeout(30_000) });
      const html = await response.text();
      const check = review.request.frontendCheck || {};
      const missingText = (check.requiredText || []).filter((text) => !html.includes(text));
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
      const expectedStatus = check.expectedStatus ?? 200;
      const titleOk = !check.expectedTitle || title === check.expectedTitle;
      const passed = response.status === expectedStatus && missingText.length === 0 && titleOk;
      review.results.push({
        type: 'frontend',
        status: passed ? 'passed' : 'failed',
        durationMs: Date.now() - started,
        output: `HTTP ${response.status}; title: ${title || '(empty)'}`,
        error: passed ? undefined : `页面检查失败：${missingText.length ? `缺少文案 ${missingText.join(', ')}；` : ''}${titleOk ? '' : `标题不匹配，实际为「${title}」；`}`,
        details: { url: review.request.frontendUrl, status: response.status, title, missingText },
      });
    } catch (error) {
      review.results.push({ type: 'frontend', status: 'failed', durationMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
    }
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
    const add = (name: string, reason: string, risk: ImpactArea['risk'], file: string) => {
      const existing = groups.get(name) || { name, reason, risk, files: [] };
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
      reason: type === 'frontend' ? (review.request.frontendUrl ? '验证目标页面可达、标题和关键文案' : '未提供前端地址，跳过页面检查') : type === 'security' && critical ? '存在高风险影响点，必须执行安全回归' : `基于 ${review.impactAreas.length} 个影响区域自动选择`,
      command: TEST_COMMANDS[type],
      selected: (type === 'frontend' ? Boolean(review.request.frontendUrl) : selected.has(type)) || (type === 'security' && critical),
    }));
  }

  private async git(repo: string, args: string[]) {
    const result = await execFileAsync('git', args, { cwd: repo, timeout: 30_000, maxBuffer: 4_000_000 });
    return result.stdout;
  }
}
