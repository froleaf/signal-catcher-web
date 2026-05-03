# signal-catcher-web

Web frontend for [signal-catcher](https://github.com/froleaf/signal-catcher) — zouye 的个人 openclaw agent。

提供：
- **Weekly Digest** — 每周 agent 整合的精选长文 / 信号 / 论文 / 实体 wiki
- **Eval 工作台** — 对推送过的 Material / Signal / Reflection 给反馈
- **Audit 报告** — 由反馈数据驱动的 agent 自我诊断
- **实体 Wiki** — Company / Person / Product 跨 Material 聚合视图

完整设计请读 [`docs/PLAN.md`](./docs/PLAN.md)。

---

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind 4
- @octokit/rest（跨 repo 数据获取）

部署平台：Vercel free tier，private repo。

---

## 数据来源

数据全部来自 [`froleaf/signal-catcher`](https://github.com/froleaf/signal-catcher) 这个 private repo。

跨 repo 访问通过 GitHub API + fine-grained PAT 实现：
- **Build 时** read：图谱 / state / output 文件
- **Runtime 写**：用户在 web 上点 Save / Approve 时，API route 通过 GitHub API commit 回 data repo

需要的环境变量：

```
GITHUB_TOKEN=<fine-grained PAT>
  scope: froleaf/signal-catcher
  permissions: Contents (RW) + Metadata (R)

NEXT_PUBLIC_DATA_REPO=froleaf/signal-catcher
```

PAT 通过 Vercel Project Settings → Environment Variables 配置，**永远不要**写在代码里或聊天里。

---

## 本地开发

```bash
pnpm install
cp .env.example .env.local   # 填 GITHUB_TOKEN
pnpm dev
```

打开 http://localhost:3000。

---

## 路由

| 路径 | 用途 |
|------|------|
| `/` | 主页 |
| `/weekly` | 周报列表 |
| `/weekly/[week]` | 单周详情 |
| `/weekly/[week]/audit` | 本周诊断 |
| `/weekly/[week]/todo` | agent-todo Approve/Reject |
| `/eval` | 反馈工作台 |
| `/eval/[week]` | 特定周次工作台 |
| `/wiki` | 实体导航 |
| `/wiki/[type]/[id]` | 单实体详情 |
| `/api/eval` (POST) | 写 eval-log |
| `/api/todo/decide` (POST) | 写 agent-todo |

---

## 贡献

单人项目，零外部贡献。

---

## License

Private. 不开源。
