@AGENTS.md

# 数据仓位置

本仓 (signal-catcher-web) 是 signal-catcher 系统的前端站点。数据 / cron prompt / agent skill 全在另一个 repo：

- **远程**：https://github.com/froleaf/signal-catcher (private)
- **本地 clone**：`/Users/zouye/.openclaw/workspace-signal-catcher/`（这是 openclaw VM agent 的 workspace，跟远程双向同步）

关键路径：

| 内容 | 路径（数据仓内） |
|------|-----------------|
| cron prompt（LLM 跑 cron 时读）| `cron/*.md` — self-optimize / weekly-digest / morning-news / daily-signal / arxiv-walker / twitter-walker / weekly-lens / weekly-signal-audit / weekly-wiki-rebuild |
| Python 工具脚本 | `scripts/*.py` — self-optimize.py 等 |
| 图谱主体 | `signal/ontology.jsonld` |
| 状态文件 | `state/eval-log.jsonl`（用户反馈，append-only）/ `state/agent-todo.json`（self-optimize 提议 + 用户决策）|
| 周报源数据 | `output/audit-data-{YYYY-WNN}.json` |
| Skills / agent 定义 | `skills/`、`.claude/` |

跨仓改动时（比如 cron prompt 里的 URL 模板 bug 引发 web 路由 404），优先去数据仓 clone 改，不要在本仓硬接 hack。
