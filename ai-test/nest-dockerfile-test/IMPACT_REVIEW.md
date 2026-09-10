# 基于 Commit 的对抗性审查 MVP

## 启动

```bash
pnpm install
pnpm start:dev
```

启动后直接打开 `http://localhost:3000/console/`（如果 3000 被占用，可使用 `PORT=3001 pnpm start:dev`，然后打开 `http://localhost:3001/console/`）。控制台可以填写 commit、远程分支、环境、前端页面地址、期望标题和关键文案，点击一次即可查看分析与测试结果。

## 创建审查任务

```bash
curl -X POST http://localhost:3000/impact-reviews \
  -H 'content-type: application/json' \
  -d '{
    "repositoryPath": "/absolute/path/to/repository",
    "commit": "abc1234",
    "baseCommit": "abc1234^",
    "environment": "staging",
    "testTypes": ["unit", "e2e", "security", "build"],
    "deploy": false
  }'
```

勾选 `frontend` 后，服务会检查目标页面 HTTP 状态、HTML title 和必需文案；页面验证结果中提供“打开页面做视觉复核”链接。当前版本不依赖前端项目的测试脚本，适合先验证已发布页面是否可达且内容正确。

填写远程分支后，服务会执行 `git fetch --no-tags <remote> <branch>`，以 `FETCH_HEAD` 对应的远程 commit 做分析。勾选“同步到当前分支”后，会在工作区干净且可以 fast-forward 时合并到当前分支；否则只拉取并分析，不覆盖开发者未提交的修改。

前端浏览器检查使用 Playwright：会执行页面 JavaScript，监听 console/page error、失败请求和 HTTP 4xx/5xx，按配置点击 CSS selector，并生成截图。多应用场景在 `frontendTargets` 中逐行提供应用名和 URL；Token 本身不能推断页面，系统会将凭证仅注入每个目标页面的同源请求，不发送给第三方资源。凭证只在本次任务的浏览器上下文中使用，不放入任务结果、不写入日志，任务结束后销毁。

运行环境必须有可用浏览器：优先使用 `PLAYWRIGHT_BROWSER_PATH`，否则自动探测系统 Chrome/Chromium；若使用 Playwright 自带浏览器，请先执行 `pnpm exec playwright install chromium`。每个页面目标都会产生独立的页面结果，最后汇总为整体测试步骤和结论。

控制台默认只做安全点击探测；若要验证明确交互，在“页面断言”中填写 CSS selector，例如 `button.submit, a.next`。影响点卡片会展开列出所有关联的页面文件和路径，并显示影响对象、命中原因和建议回归项。

任务会异步完成。通过 `GET /impact-reviews/:id` 查看 commit 信息、变更文件、影响区域、风险等级、测试计划、测试结果和部署状态；失败任务可调用 `POST /impact-reviews/:id/retry`。

## 当前边界与遗漏项

- Git 分析和测试执行已落地；部署状态保留了 adapter 边界，下一步应接入 Kubernetes/Argo CD/内部发布平台，并在部署后做健康检查和自动回滚。
- 生产化前需要把内存任务存储换成数据库，把异步执行换成队列，并加入用户鉴权、仓库白名单、命令沙箱、超时/并发配额和审计日志。
- 还应接入测试数据脱敏/隔离、基线对比（性能、错误率）、通知渠道、报告持久化，以及 PR/commit 状态回写。
