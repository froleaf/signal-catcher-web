# signal-catcher Pipeline 优化方案 v1

> **撰写于** 2026-05-03
> **状态** 方案确认，开始实施
> **作者** zouye + Claude（结对设计）
> **本文件作用** 完整记录 v1 设计决策、背景与未来方向，供后续迭代回溯

---

## 1. 产品背景

### 1.1 现状

[signal-catcher](https://github.com/froleaf/signal-catcher) 是 zouye 个人的 openclaw agent，跑在 GCP VM `openclaw-sg`（asia-southeast1-b）上。每天替我把散落在 X / RSS / arxiv / 公众号里的信息按"我可能感兴趣 + Lenny 9 个领域的框架"过滤、压缩、推送到 Telegram，并把推送内容编织成一张可查询的 Signal 图谱。

到本文撰写时（v1 改造前）的状态：
- **图谱规模**：1010 个 entity（174 Material / 89 Company / 79 Product / 23 Person / 12 Signal / 9 TopicCluster + Reflection）
- **运行 cron**：morning-news / daily-signal / twitter-walker / weekly-lens / weekly-signal-audit / weekly-wiki-rebuild / arxiv-walker — **7 个独立 cron**
- **数据沉淀**：3 月 10 日上线至今，daily memory 不断档，lineage 日志 680 条
- **brain 模式**：用户可以 @ 它问问题，回复底部带引用脚注 (`📎 引用：item_xxx · ref_yyy`)
- **Reflection 实体**：用户在 brain 对话中说"沉淀这个"会触发 distill-reflection skill 把 agent 给出的延伸解读写入图谱

### 1.2 已暴露的痛点

通过几次 review 累积下来的具体问题：

1. **推送质量没有反馈回路**——每天推 30-60 条 Material，但用户读完是否觉得有价值、是不是想读、推得对不对，agent 完全不知道。本身 schema 设计了"Signal Collection 信号矩阵"（harder/lighter/select 等按钮），但 module-1/2 已下线，整套机制停摆。

2. **Lenny's Take 形式化**——agent 给出的"用 Whole Product 框架解读"是**调用框架的名字**，不是**用框架的内核**。grep 关键词只拿到平铺 Material list，Lenny 节点的完整内容（定义/案例/用户深度标注/跨域连接）从未被深度引用。

3. **weekly 4 个独立 cron 互不相通**——weekly-lens / weekly-signal-audit / weekly-wiki-rebuild / arxiv-walker 各跑各的，分别推 Telegram，没有"周度整合视角"。lens 还推到一个奇怪的群（`-5120363786`），不是早晚报那个群。

4. **自我优化循环不存在**——5 个数据源（daily memory、Signal 图谱、Twitter 图谱、lineage 日志、pushed-history）一直在写，但**没有任何路径在读**这些数据做反馈。Source 死亡、cluster 活跃度、Reflection 召回率、漏检话题——都在 schema 里有字段，但是 write-only。

5. **HTML 输出在 VM 本地**——`output/wiki/` 和 `output/weekly/` 是 VM 本地静态 HTML，要想看必须 sync 拉到本地，或者 ssh 到 VM。没有"周末打开浏览器就能看周报"的体验。

6. **群组推送噪声**——早晚报推群很合理（日常通知），但 weekly 系列推群是噪声——周报内容应该是"沉浸阅读"场景，群组聊天流不适合。

---

## 2. 目标

### 2.1 核心 use case

| ID | 场景 | 成功状态（用户视角） |
|----|------|---------------------|
| **U1** | 早通勤扫推送 | "推的东西我会想点开 80% 以上" |
| **U2** | 晚饭后看深度 | "Lenny's Take 真的在用框架推，不是套壳" |
| **U3** | 周末浏览周报/wiki | "看完之后能说出本周 3 件大事" |
| **U4** | 平时 brain 召回 | "我提到 X，agent 立刻引用上周推过的 Y" |

### 2.2 系统级目标

- 建立**人机分工**的 eval 体系：人评质量/深度/形式化，机器审遗漏/重复
- 所有改 agent 行为的优化**必须用户批准后才执行**（半自治，非完全自治）
- 周报作为唯一的"沉浸式"内容载体，部署到 web 上独立访问
- agent 越跑越像 user（判断对齐），不需要重复纠偏

### 2.3 边界

- **单人使用**——只服务 zouye，不考虑多用户
- **订阅制 token**——不优化模型成本，模型路由优先级最低
- **半自治**——所有"改判断"的优化必须人批
- **私有性**——repo private，Vercel 默认域名（不外传），不做 SSO

---

## 3. 方案设计

### 3.1 架构 overview

```
═══════════════════════════════════════════════════════════════════════
                Layer 1 · 原子输出（agent 产出）
═══════════════════════════════════════════════════════════════════════
   Material (item_*)      Signal (sig_*)        Reflection (ref_*)
   每篇文章/推文/论文       thesis-level 提炼      brain 对话沉淀
   daily/twitter/weekly    仅 weekly 创建         distill 触发

═══════════════════════════════════════════════════════════════════════
                Layer 2 · 双 loop 同时收集 eval 数据
═══════════════════════════════════════════════════════════════════════

   ┌─ Manual Eval Loop（人，web 工作台）─┐  ┌─ Auto Eval Loop（机器）──┐
   │                                     │  │                           │
   │  /eval 工作台                        │  │  scripts/self-optimize.py │
   │  free-text feedback                 │  │  纯计算，每天 03:00 跑     │
   │  无预设维度（v1）                    │  │  - URL 死链               │
   │                                     │  │  - pushed-history prune   │
   │  写：state/eval-log.jsonl            │  │  - source 30 天活跃        │
   │                                     │  │  - cluster 统计回写        │
   │                                     │  │  - 漏检关键词比对          │
   │                                     │  │                           │
   │                                     │  │  cron/self-optimize.md     │
   │                                     │  │  LLM 提议层（不执行）      │
   │                                     │  │  写 state/agent-todo.json  │
   └─────────────────────────────────────┘  └───────────────────────────┘

═══════════════════════════════════════════════════════════════════════
                Layer 3 · Weekly Audit & Apply（统一收口）
═══════════════════════════════════════════════════════════════════════

   weekly-digest cron（周日 10:00-12:00，仅 DM）

   Phase 1 · Signal Audit            ← 替代 weekly-signal-audit
   Phase 2 · Wiki Rebuild            ← 替代 weekly-wiki-rebuild
   Phase 3 · Arxiv Digest            ← 替代 arxiv-walker
   Phase 4 · Highlights              ← 新增（精选 + through-line）
   Phase 5 · Eval Aggregation        ← 新增（LLM 读 free text 提炼主题）
   Phase 6 · Apply Approved Todos    ← 新增（执行用户批准过的优化）
   Phase 7 · Audit Report            ← 新增（写 audit-data.json）
   Phase 8 · Render & Publish        ← git push → Vercel build

═══════════════════════════════════════════════════════════════════════
                Layer 4 · Close the Loop（用户周末做）
═══════════════════════════════════════════════════════════════════════

   1. /weekly/{w}/audit  看本周诊断
   2. /weekly/{w}/todo   approve/reject 优化项
   3. /eval/{w}          补完 free-text 反馈
   4. 必要时手动改 cron/*.md prompt
```

### 3.2 原子单位定义

eval 评价的"一行 = 一次评价"对应：

| 原子单位 | 来源 | 一周量级 | 评价方 |
|---------|------|---------|--------|
| **Material** (`item_*`) | 早晚报 / twitter-walker / arxiv 推过的每篇 | 30-60 | 人 + 机 |
| **Signal** (`sig_*`) | weekly-digest 整合时新建/更新的 thesis | 1-3 | 人 |
| **Reflection** (`ref_*`) | brain 对话沉淀 | 0-3 | 隐式（看召回率）|

**关键设计**：推送和评价完全解耦。一条 Telegram 消息可能含 5 个 Material，在 web 工作台是 5 行 eval。

### 3.3 双 loop 责任分工

明确边界——人不评机器能判断的，机器不评人才能判断的：

**人来评（手动 loop）**
- 信息深度：太浅 / 刚好 / 太深
- 解读质量：Lenny's Take 真展开了 / 形式化 / 框架不适用
- 路由：该走早报 / 晚报 / 周报 / 仅入图谱
- 兴趣对齐：相关 / 不相关
- 行动意愿：想沉淀 / 看完即弃

**机器来审（自动 loop）**
- URL 死链
- 语义重复（v1 不用 embedding，让 agent 直接对比摘要）
- 漏检（最近 brain queries 提到的话题，最近推送是否覆盖）
- Source 死活（30 天无新 Material）
- Cluster 活跃度（materialCount 增速）
- Pushed-history 30 天 prune

### 3.4 自动化执行的边界（核心红线）

**Housekeeping（机器自动执行）**——只更新数据/统计，不改 agent 决策：
- URL 死链标记
- pushed-history 30 天 prune
- TopicCluster.materialCount 统计
- lastMentionedAt 字段更新

**优化建议（写 todo，等用户批准）**——任何改 agent 行为的：
- Source tier 降级
- Cluster 标 dormant
- Entity 合并
- 推送策略调整
- cron prompt 改写建议

**红线**：任何会改 agent 决策的事都要人批。机器只动事实记录，不动判断逻辑。

### 3.5 Eval 维度（v1 极简）

```jsonl
# state/eval-log.jsonl  (append-only)
{
  "ts": "2026-05-03T12:34:56Z",
  "item_id": "item_20260503_xxx",
  "item_type": "Material",
  "feedback": "推得太浅了，特别是关于 Anthropic 的部分。Lenny's Take 用了 Whole Product 但只是名字没展开，要是 7 Powers 的 Counter-Positioning 可能更准。",
  "source": "morning-news"
}
```

**一个 free-text 字段** `feedback`。

理由：
- 用一段时间后由 LLM **从自然语言反推真正用得上的维度**——这才是真实的，不是预设的
- v1 不强求结构化 = 不增加评价摩擦
- N 周后（4-8 周）有 100+ 条 free text，再做"维度提取"工作

### 3.6 Cron 重组

| Cron | 现状 | 改为 | Channel |
|------|------|------|---------|
| morning-news | `0 8 * * *` | `0 8 * * 1-5`（周一至五）| 群+DM 不变 |
| daily-signal | `0 21 * * *` | `0 21 * * 1-5` | 群+DM 不变 |
| twitter-walker | `0 13 */3 * *` | 不变 | 仅 DM（已是）|
| **weekly-digest** | （新增）| `0 10 * * 0` | **仅 DM** |
| **self-optimize** | （新增）| `0 3 * * *` | 静默（周日合并到一份摘要）|
| ~~weekly-lens~~ | 删除 | — | — |
| ~~weekly-signal-audit~~ | 删除 | — | — |
| ~~weekly-wiki-rebuild~~ | 删除 | — | — |
| ~~arxiv-walker~~ | 删除 | — | — |

**周一回补 72 小时**：周一的 morning-news 和 daily-signal 提示中加一段——扫描窗口扩大到上周五晚到周一傍晚（覆盖周末停推期间产生的内容），并标记为 `briefingType: morning-news-monday-backfill` 用于后续召回评估。

**weekly-lens 推到奇怪群 `-5120363786`** 的问题——合并后自然消除（weekly-digest 仅 DM）。

### 3.7 Lenny 框架 Conditional 应用

修改 cron prompt 中的"Lenny's Take"步骤——不再强制每条都套 Lenny 框架：

```
Step X · Lenny 框架适配判断（前置）

写 Take 之前先做 routing 判断：

【条件 A · 用 Lenny 框架】（命中以下任一）
- 内容明显落在 Lenny 9 个领域
- 内容触及"做产品/做组织/做增长"的具体决策

  → 选最相关的 1 个 Lenny 框架
  → grep 该框架的 KnowledgeNode @id
  → Read 完整节点内容（定义/组成/案例/cross-link/user depth）
  → Take 中至少引用 2 处节点的具体内容（不只是名字）

【条件 B · 用模型自己的深度能力】（其余情况）
- 纯技术细节（model arch、训练方法、infra 优化）
- 纯科学/数学（理论新结果，无明显应用）
- 纯文化/社会评论

  → 不强行套 Lenny 框架
  → 用模型自身能力做深度技术解读 / 历史脉络 / 第一性原理推演
  → Take 标准：解释"它真正解决的是什么" + "3 个月/1 年内会发生什么" + "非显而易见的洞察"

【共同的形式化红线】
- ❌ 提名了框架但没展开 → 不及格
- ❌ "agent 自治化是大势所趋"等通用评论 → 不及格
- ❌ 复读 abstract → 不及格

如果既不落 Lenny 也不能给非显而易见洞察 → 直接写 2 句中性摘要，不强写 Take。
```

### 3.8 双 repo 部署

- **数据 repo** `froleaf/signal-catcher`（已有，private）— 图谱、cron、skills、state
- **前端 repo** `froleaf/signal-catcher-web`（本 repo，private）— Next.js + Vercel 部署

**为什么双 repo 不是单 repo 双目录**：
- 用户偏好（rationale: keeping concerns separate）
- 跨 repo 数据获取通过 GitHub API（octokit）实现
- 代价：需要 token；ROI：repo 浏览整洁、各自 build 节奏独立

### 3.9 Web 路由

```
/                         主页（最近 weekly digest 高亮 + 入口三件套）
/weekly                   周报列表（倒序）
/weekly/[week]            单周详情（through-line + highlights + papers）
/weekly/[week]/audit      LLM 提炼的本周反馈主题 + 错判模式
/weekly/[week]/todo       agent-todo 列表，每条 Approve/Reject 按钮
/eval                     反馈工作台（本周未评 list + 历史）
/eval/[week]              特定周次工作台
/wiki                     实体导航
/wiki/[type]/[id]         单实体详情
/api/eval                 POST: 写 eval-log.jsonl
/api/todo/decide          POST: 写 agent-todo.json approve 状态
```

### 3.10 跨 repo 数据流

```
Build 时（Vercel build server）：
  Octokit + GITHUB_TOKEN
  → GET /repos/froleaf/signal-catcher/contents/signal/ontology.jsonld
  → 解码 base64 → 解析 JSON
  → SSG 渲染所有页面

Runtime 写时（用户在 web 上操作）：
  /api/eval (POST)
  → Octokit.repos.createOrUpdateFileContents
    owner=froleaf, repo=signal-catcher
    path=state/eval-log.jsonl
    content=base64(原内容 + 新 jsonl 行)
    commit message="eval: feedback for {item_id}"
  → 自动 commit 到 main
  → （可选）触发 web rebuild
```

### 3.11 Vercel rebuild 节奏

为避免每次 cron 写图谱都触发 rebuild，使用 `vercel.json` 的 `ignoreCommand`：

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  },
  "ignoreCommand": "git diff --quiet HEAD^ HEAD ./web/path/specific/files"
}
```

只在以下变化时 rebuild：
- web repo 自身代码变化
- signal-catcher 的 ontology.jsonld 变化（数据更新）→ 但 web 是另一个 repo，这种"远程数据驱动 rebuild"用 Vercel deploy hook 实现
- audit-data-*.json 变化（weekly-digest 跑完）

实际上更简单的策略：weekly-digest cron 跑完后**调一次 Vercel deploy hook**，每周一次部署，daily push 不触发。

### 3.12 数据 schema

#### state/eval-log.jsonl（append-only）

```jsonl
{"ts":"2026-05-03T12:34:56Z","item_id":"item_20260503_xxx","item_type":"Material","feedback":"<free text>","source":"morning-news"}
```

字段：
- `ts` — ISO 8601 时间戳
- `item_id` — 评价对象的 @id（Material/Signal/Reflection）
- `item_type` — `Material` / `Signal` / `Reflection`
- `feedback` — 自由文本（v1 唯一内容字段）
- `source` — 来源 cron（用于按 cron 聚合分析）

#### state/agent-todo.json（read-modify-write）

```json
{
  "version": 1,
  "updated_at": "2026-05-03T03:00:00Z",
  "items": [
    {
      "id": "todo_20260503_001",
      "created_at": "2026-05-03T03:00:00Z",
      "type": "source_dormant",
      "rationale": "src_xxx 30 天无新 Material，建议 tier 从 active 降到 dormant",
      "evidence": {
        "source_id": "src_xxx",
        "last_material_at": "2026-04-02",
        "current_tier": "active"
      },
      "status": "pending",
      "decided_at": null,
      "applied_at": null
    }
  ]
}
```

`status` 枚举：`pending` → `approved` / `rejected` → `applied`

#### output/audit-data-{YYYY-WW}.json（weekly-digest 写）

```json
{
  "week": "2026-W18",
  "generated_at": "...",
  "eval_summary": {
    "items_evaluated": 23,
    "dominant_themes": [
      {
        "theme": "Lenny's Take 形式化",
        "occurrence_count": 8,
        "example_quotes": ["..."]
      }
    ],
    "source_quality_signals": {
      "src_xxx": "用户多次表示推得过密",
      "src_yyy": "命中率高，质量稳定"
    }
  },
  "new_pending_todos": [...],
  "applied_todos": [...],
  "next_week_suggestions": [...]
}
```

---

## 4. 实施计划

### 4.1 P0 任务（按依赖顺序）

| # | 任务 | 工作量 | 阻塞 |
|:-:|------|--------|------|
| 1 | Cron 调度调整（早晚报周末停 + 周一回补 + setup-cron.sh 重写） | 0.5 天 | — |
| 2 | Lenny 框架 conditional 化（cron prompts） | 0.5 天 | — |
| 3 | scripts/self-optimize.py（纯 housekeeping） | 1 天 | — |
| 4 | cron/self-optimize.md（LLM 提议层，所有 → todo） | 1 天 | #3 |
| 5 | cron/weekly-digest.md（合并 4 cron + Phase 5-7 新增） | 2-3 天 | #4 |
| 6 | signal-catcher-web 站点骨架 + Vercel 部署 | 1-2 天 | — |
| 7 | /weekly 路由 + 数据驱动渲染 | 1-2 天 | #5, #6 |
| 8 | /eval 工作台 + POST /api/eval | 1 天 | #6 |
| 9 | /weekly/[w]/audit + /todo + POST /api/todo/decide | 1 天 | #5, #7 |
| 10 | /wiki 路由 | 0.5 天 | #6 |
| 11 | 文档同步：AGENTS.md / STRUCTURE.md / SCHEMA.md | 0.5 天 | 所有 |

合计 10-12 天。第 5 天 weekly-digest 跑通；第 11 天 Vercel 上线。

### 4.2 验收标准

- 周一早报扫到周末两天的内容（回补生效）
- 第一份 weekly-digest 在周日生成 + DM 收到 + Vercel /weekly/{w} 可访问
- /eval 能写入 free-text，第二天看到 jsonl 文件多了一行
- /weekly/{w}/todo 能 approve，next self-optimize cron 应用后状态变 `applied`
- audit report 在 /weekly/{w}/audit 可看，包含 LLM 提炼的反馈主题

---

## 5. 未来迭代方向

按 ROI / 复杂度 / 风险排序：

### 5.1 模型路由（订阅制下不优先，但有 ROI）

主要使用智谱（GLM 系）+ OpenAI（GPT-5 系）。

按层路由：
- **质量瓶颈位**（brain 默认问答 / arxiv 论文框架解读 / Lenny's Take）→ `gpt-5` + reasoning effort 或 `glm-4.6`
- **中质量**（distill-reflection / weekly-signal-audit）→ `glm-4.6` 或 `gpt-5`
- **成本敏感**（NER / morning 粗排 / knowledge-extract）→ `glm-4-flash` 或 `gpt-5-mini`
- **长上下文场景**（thesis-level dedup）→ `glm-4-long`

实施方式：每个 cron prompt 顶部声明 + openclaw config 按 agent_id 路由。

### 5.2 Eval 维度结构化（v2）

第一版 free text 攒满 100+ 条后：
- 用 LLM 做主题聚类，反推用户真正在用的维度
- 写一份"维度白皮书"
- /eval 工作台增加结构化 form（dropdown / radio）作为 free text 之外的快速入口
- free text 字段保留（永远是 fallback）

### 5.3 Embedding 升级（性能优化）

当前不用 embedding，让 agent 直接读所有摘要做对比。如果 self-optimize cron 跑得慢或产生噪声多：
- 引入 sentence-transformer 或 OpenAI text-embedding-3-small
- 跑 pairwise 余弦相似度
- > 0.85 直接合并、0.7-0.85 入 borderline todo

### 5.4 完全 5 layer pipeline 重组

当前是 cron 类型组织，未来可能重组为：

```
Layer 1 · Collectors（多个，独立频次）
Layer 2 · Triage（统一打标 + 路由）
Layer 3 · Synthesize（按载体分支）
Layer 4 · Deliver（按用户场景）
Layer 5 · Feedback（三个时间尺度：微/中/宏）
```

每个 cron 不再"自采+自加工+自推"，而是按层组合。前提：v1 跑稳，数据驱动让重组边界清晰后再做。

### 5.5 多用户开放（远期）

- 当前：单人，user-profiles.json 只有 zouye
- 远期：开放给 1-N 个朋友
- 需要：onboarding flow、订阅源/兴趣按用户隔离、推送权限控制
- v2 之后再说

### 5.6 群组推送策略迭代

- 当前早晚报推群+DM
- 群里其他人对内容质量的反馈也是信号（reactions / 转发）
- v2 可能：扫描群内反应作为隐式 eval 数据

### 5.7 brain 模式 retrieval 增强

针对 U4（"我提到 X，agent 立刻引用上周推过的 Y"）的失败模式：
- 当前 grep 关键词匹配，错过相关概念（"agent harness" ↔ "agent runtime"）
- 加入 alias 表 + concept expansion
- 进一步：引入 embedding 召回（与 §5.3 共用基础设施）

### 5.8 Twitter walker 自学习 follow list

- 当前 follow list 静态维护
- 可以基于 author 入选率自动调整：高入选率升级到 must-follow，低入选率自动 unfollow

---

## 6. 关键决策记录

按时间顺序记录 v1 设计过程中的关键 trade-off 和最终选择：

| # | 决策 | 选择 | 否决方案 + 原因 |
|:-:|------|------|-----------------|
| 1 | Eval 维度的设计粒度 | **v1 free text，无预设维度** | 否决"7 维结构化"——预设维度容易错；让自然语言反推真维度 |
| 2 | 收集反馈的载体 | **Web 工作台**（无 Telegram 按钮） | 否决"Telegram 内嵌按钮"——一条消息含多 Material，按钮粒度不对 |
| 3 | 自动 vs 半自治 | **所有改 agent 行为的优化必须人批** | 否决"高置信项机器自动执行"——避免 agent 跑偏 |
| 4 | 单 repo vs 双 repo | **双 repo**（`signal-catcher` 数据 + `signal-catcher-web` 前端）| 否决"单 repo 双目录" — 用户偏好分离关注点 |
| 5 | 部署平台 | **Vercel**（free tier）| 否决"Cloudflare Pages + Access" —— 已确认私有性靠"不外传"即可，不需要 SSO |
| 6 | Web 部署节奏 | **周更**（weekly-digest 完成后 push） | 否决"日更" —— web 是沉淀资产，不需要实时；与"周末看"心智一致 |
| 7 | 模型路由优先级 | **最后做** | 订阅制下成本不重要，先优化用户体验 |
| 8 | 技术深度去重 | **不用 embedding**（让 agent 直读摘要对比）| 否决"embedding + 余弦相似度" —— v1 简化；token 不是瓶颈 |
| 9 | 周报推送 channel | **仅 DM**，群组保留早晚报 | 周报是沉浸式阅读，不适合群聊流 |
| 10 | 周末停早晚报 | **周一-五推，周末停，周一回补 72 小时** | 周末用户读周报不需要新增 daily 噪声 |
| 11 | Lenny 框架是否必用 | **conditional**（A 路径用框架，B 路径用模型自身能力）| 否决"强制每条都用 Lenny" —— 强行套是形式化根源 |
| 12 | 文档单一来源 | **AGENTS.md 路由 + cron/skill 各自详情** | 否决"WORKFLOW_AUTO.md 单独存在" —— 已合并并精简 AGENTS.md |

---

## 7. 已废弃的方案

记录设计过程中考虑过但未采用的方案，避免后续重复讨论：

### 7.1 Telegram 内嵌按钮收集 eval

- **方案**：每条 Material 推送时挂 7 个按钮（quality/depth/route）
- **否决原因**：
  - 一条 Telegram 消息含多 Material，按钮粒度只能针对消息整体
  - 评价原子级是 Material，不是消息
- **替代**：Web 工作台

### 7.2 7 维结构化 eval form

- **方案**：quality / depth / novelty / relevance / action / lenny_take / route 7 个维度，dropdown / radio 收集
- **否决原因**：
  - 预设维度容易错——我（设计者）不知道用户真正在用什么轴
  - 增加评价摩擦
- **替代**：v1 单字段 free text，等数据反推维度

### 7.3 Cloudflare Pages + Cloudflare Access

- **方案**：CF Pages 部署 + Zero Trust Access SSO 限制访问
- **否决原因**：用户已确认 Vercel default 域名 + "不外传"足够，不需要 SSO
- **保留场景**：未来开放多用户时可重新评估

### 7.4 全自动优化执行

- **方案**：高置信优化项（如 source 30 天 dormant）机器自动执行
- **否决原因**：用户明确表示"最终优化的执行由人批准"
- **替代**：所有 → agent-todo，人 approve 后下次 cron 才应用

### 7.5 Embedding 语义去重

- **方案**：scripts/self-optimize.py 用 embedding 算 pairwise 相似度
- **否决原因**：v1 不优化性能；订阅制下让 agent 直读摘要对比 token 不是瓶颈
- **保留场景**：见 §5.3，跑慢/噪声多时升级

### 7.6 模块 1/2 主动评估（Bandwidth/Resolution）

- **现状**：skill 文件夹保留，但已下线，不再路由
- **下线原因**：评估机制设计了但没真用上
- **替代**：v1 通过 eval-log free text 让用户自己说，未来 §5.2 反推维度时可能复活

### 7.7 metric-first 自优化思路

- **方案**：列 7 个 metric（push 命中率、source 死活、cluster 活跃度等）建数字看板
- **否决原因**：用户指出"算出指标后无法决策"
- **替代**：use-case-first——先想"该决策什么"再设计数据收集

---

## 8. 文档维护说明

### 8.1 本文档定位

`docs/PLAN.md` 是 **v1 完整方案的 snapshot**，落定后**不再频繁修改**——它是回溯参考。

### 8.2 后续迭代记录方式

未来的设计决策不要直接改本文，改用以下方式：

```
docs/
  ├── PLAN.md                      ← v1 完整方案（本文件，冻结）
  ├── decisions/                   ← ADR（Architecture Decision Records）
  │   ├── 0001-eval-dimensions-v2.md
  │   ├── 0002-model-routing.md
  │   └── ...
  └── retrospective/
      ├── 2026-W22.md              ← 每月 retro（v1 跑了 N 周后）
      └── ...
```

ADR 模板：
```markdown
# ADR-NNNN: <决策标题>

- **状态**：proposed / accepted / superseded
- **日期**：YYYY-MM-DD
- **背景**：为什么需要这个决策
- **方案**：选了什么
- **trade-off**：放弃了什么、为什么
- **影响**：会改哪些代码 / 文档 / 流程
```

### 8.3 v1 → v2 触发条件

何时应该 reset 进入 v2 思考：
- 累积 100+ 条 eval-log free text（约 4-8 周）
- 用户明确说"现在的 pipeline 满足不了 X"
- 主要 use case 之外出现新的强诉求（如多用户开放）

到那时再写一份 `docs/PLAN-v2.md`，本文件保持不动。

---

## 附录 A · 涉及的 Repo / 路径

| 资源 | 路径 / URL |
|------|----------|
| 数据 repo | https://github.com/froleaf/signal-catcher |
| 前端 repo（本 repo）| https://github.com/froleaf/signal-catcher-web |
| VM | `openclaw-sg` @ `asia-southeast1-b`（GCP）|
| 本地 workspace | `~/.openclaw/workspace-signal-catcher/` |
| 本地 web 项目 | `~/Work/projects/signal-catcher-web/` |
| Vercel project | （待创建，名 `signal-catcher-web`）|

## 附录 B · 涉及的关键文件

数据 repo（`signal-catcher`）：
- `AGENTS.md` — 路由 / 全局红线 / Cron 调度索引
- `STRUCTURE.md` — 目录结构 / 双图谱架构 / 写入权限矩阵
- `signal/SCHEMA.md` — 实体 schema（写入前必读）
- `cron/setup-cron.sh` — cron 注册脚本
- `cron/morning-news.md` `cron/daily-signal.md` — 早晚报
- `cron/weekly-digest.md` — **新增**，合并 4 个旧 weekly cron
- `cron/self-optimize.md` — **新增**，每天 03:00 提议优化
- `scripts/self-optimize.py` — **新增**，纯 housekeeping
- `state/eval-log.jsonl` — **新增**，用户反馈
- `state/agent-todo.json` — **新增**，待批准优化
- `output/audit-data-{YYYY-WW}.json` — **新增**，每周 audit 数据

前端 repo（本 repo）：
- `src/app/page.tsx` — 主页
- `src/app/weekly/...` — 周报路由
- `src/app/eval/...` — 工作台
- `src/app/wiki/...` — 实体页
- `src/app/api/eval/route.ts` — 写 eval-log
- `src/app/api/todo/decide/route.ts` — 写 agent-todo

---

**End of v1 Plan.**
