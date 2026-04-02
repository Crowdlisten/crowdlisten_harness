# CrowdListen

> 一个统一的 AI 智能体 MCP 服务器。规划工作、搜索社交平台、积累知识——通过渐进式技能披露，智能体只加载当前需要的工具。

[English](README.md) | [中文文档](README-CN.md) | [한국어](README-KO.md) | [Español](README-ES.md)

## 问题所在

AI 智能体是无状态的。每次新会话都从零开始——不记得昨天的决策，不知道其他智能体发现了什么，也无法访问用户在七个平台上发布的真实反馈。你只能反复解释相同的上下文，错过散落在各处的用户信号，看着智能体重新发现已知的解决方案。

CrowdListen 用一个 MCP 服务器解决三个问题：

1. **规划和跟踪工作**——跨智能体共享知识库，持续积累。
2. **搜索社交平台**——Reddit、YouTube、TikTok、Twitter/X、Instagram、小红书——返回智能体可推理的结构化数据。
3. **记住所学**——下一次会话从所有积累开始，而非从零开始。

你的智能体从 4 个发现工具开始。按需激活技能包——规划、社交聆听、受众分析——只加载当前任务需要的工具。

## 立即体验

一条命令。浏览器打开，登录，智能体自动配置：

```bash
npx @crowdlisten/harness login
```

自动为 Claude Code、Cursor、Gemini CLI、Codex、Amp 和 OpenClaw 配置 MCP。无需环境变量，无需编辑 JSON，无需管理 API 密钥。

登录后重启智能体，即可开始调用工具。

### 手动配置

添加以下内容到智能体的 MCP 配置：

```json
{
  "mcpServers": {
    "crowdlisten": {
      "command": "npx",
      "args": ["-y", "@crowdlisten/harness"]
    }
  }
}
```

## 工作原理

### 渐进式技能披露

你的智能体从 4 个始终可用的工具开始：

```
list_skill_packs()                                    → 查看可用技能包
activate_skill_pack({ pack_id: "planning" })          → 解锁 11 个任务工具
activate_skill_pack({ pack_id: "social-listening" })  → 解锁 7 个搜索工具
remember({ type: "preference", title: "...", ... })   → 跨会话保存上下文
recall({ search: "React" })                           → 检索已保存的上下文
```

激活后，新工具通过 `tools/list_changed` 自动出现。无需重启。

### 技能包

| 技能包 | 工具数 | 描述 |
|--------|--------|------|
| **core**（始终开启） | 4 | 发现 + 记忆 |
| **planning** | 11 | 任务、计划、进度跟踪 |
| **knowledge** | 3 | 项目知识库 |
| **social-listening** | 7 | 搜索社交平台（免费） |
| **audience-analysis** | 6 | AI 分析（需要 CROWDLISTEN_API_KEY） |
| **sessions** | 3 | 多智能体协作 |
| **setup** | 5 | 看板管理 |

另有：原生 SKILL.md 工作流包（竞品分析、内容创作等），激活时提供完整方法论指导。

## 你能做什么

### 规划和跟踪工作

智能体调用 `list_tasks` 查看任务，`claim_task` 开始工作，`create_plan` 起草带假设和风险的方案。你审核计划、留下反馈，智能体迭代。每个决策和经验都被捕获到知识库中，供未来任务查询。

### 搜索社交平台

一个工具搜索 Reddit、YouTube、TikTok、Twitter/X、Instagram、小红书和 Moltbook。返回带有互动指标、时间戳和作者信息的结构化帖子——无论来自哪个平台，格式完全一致。

```bash
# 也可作为 CLI 使用
npx crowdlisten search reddit "cursor vs claude code" --limit 5
npx crowdlisten vision https://news.ycombinator.com
```

### 从任意网站提取

视觉模式对任意 URL 截图，发送给 LLM（Claude、Gemini 或 OpenAI），返回结构化数据。没有 API 的论坛？有付费墙的新闻网站评论？用 `extract_url` 搞定。

### 分析受众信号

付费 API 层增加观点聚类、深度分析（受众细分、竞争信号）和研究综合（单条查询生成跨平台报告）。核心提取功能完全免费且开源。

### 跨会话记忆

智能体用 `remember` 保存上下文，用 `recall` 检索。从 Claude Code 切换到 Cursor 再到 Gemini CLI——知识始终跟随你。

## MCP 工具参考

### 始终可用（4 个工具）

| 工具 | 功能 |
|------|------|
| `list_skill_packs` | 列出可用技能包及状态、工具数 |
| `activate_skill_pack` | 激活技能包以解锁其工具 |
| `remember` | 跨会话保存上下文（偏好、决策、模式、洞察） |
| `recall` | 检索已保存的上下文块 |

### 规划包（11 个工具）

| 工具 | 功能 |
|------|------|
| `list_tasks` | 列出看板任务 |
| `get_task` | 获取完整任务详情 |
| `create_task` | 创建新任务 |
| `update_task` | 更改标题、描述、状态、优先级 |
| `claim_task` | 开始工作——返回上下文、工作区、分支 |
| `complete_task` | 标记完成，自动完结计划 |
| `delete_task` | 永久删除任务 |
| `log_progress` | 记录执行会话日志 |
| `create_plan` | 创建执行计划（方案、假设、风险） |
| `get_plan` | 获取计划及版本历史和反馈 |
| `update_plan` | 迭代：更新方案、状态或添加反馈 |

### 知识包（3 个工具）

| 工具 | 功能 |
|------|------|
| `query_context` | 搜索决策、模式、经验 |
| `add_context` | 写入知识库 |
| `record_learning` | 捕获成果，可选提升为项目范围 |

### 社交聆听包（7 个工具，免费）

| 工具 | 功能 |
|------|------|
| `search_content` | 跨平台搜索帖子。支持 `useVision` 标志。 |
| `get_content_comments` | 获取特定帖子的评论/回复 |
| `get_trending_content` | 平台当前热门帖子 |
| `get_user_content` | 特定用户的近期帖子 |
| `extract_url` | 视觉提取——对任意 URL 截图，返回结构化数据 |
| `get_platform_status` | 可用平台及其功能 |
| `health_check` | 平台连接检查 |

平台：reddit、twitter、tiktok、instagram、youtube、xiaohongshu、moltbook

### 受众分析包（6 个工具，需要 CROWDLISTEN_API_KEY）

| 工具 | 功能 |
|------|------|
| `analyze_content` | 帖子及评论的情感 + 主题分析 |
| `cluster_opinions` | 按主题将评论分组为语义观点聚类 |
| `enrich_content` | 意图检测、立场分析、互动评分 |
| `deep_analyze` | 完整受众智能：细分、痛点、竞争信号 |
| `extract_insights` | 分类洞察提取（痛点、功能需求、好评） |
| `research_synthesis` | 单条查询生成跨平台研究报告 |

### 会话包（3 个工具）

| 工具 | 功能 |
|------|------|
| `start_session` | 启动并行智能体会话 |
| `list_sessions` | 列出任务的会话 |
| `update_session` | 更新会话状态/焦点 |

### 设置包（5 个工具）

| 工具 | 功能 |
|------|------|
| `get_or_create_global_board` | 获取全局看板 |
| `list_projects` | 列出可访问的项目 |
| `list_boards` | 列出项目的看板 |
| `create_board` | 创建带默认列的看板 |
| `migrate_to_global_board` | 将所有任务迁移到全局看板 |

## 平台配置

大多数平台零配置即可工作：

| 平台 | 需要什么 | 不配置会怎样 |
|------|---------|-------------|
| Reddit | 无 | 即刻可用 |
| TikTok | `npx playwright install chromium` | 浏览器未找到错误 |
| Instagram | `npx playwright install chromium` | 浏览器未找到错误 |
| 小红书 | `npx playwright install chromium` | 浏览器未找到错误 |
| Twitter/X | `.env` 中设置 `TWITTER_USERNAME` + `TWITTER_PASSWORD` | 跳过 |
| YouTube | `.env` 中设置 `YOUTUBE_API_KEY` | 跳过 |
| Moltbook | `.env` 中设置 `MOLTBOOK_API_KEY` | 跳过 |
| 视觉模式 | `ANTHROPIC_API_KEY`、`GEMINI_API_KEY` 或 `OPENAI_API_KEY` 之一 | 视觉返回错误 |
| 付费分析 | `CROWDLISTEN_API_KEY` | 免费工具正常使用 |

## CLI 命令

```bash
npx @crowdlisten/harness login          # 登录 + 自动配置智能体
npx @crowdlisten/harness setup          # 重新运行自动配置
npx @crowdlisten/harness logout         # 清除凭据
npx @crowdlisten/harness whoami         # 查看当前用户
npx @crowdlisten/harness context        # 启动技能包仪表板（端口 3847）
npx @crowdlisten/harness context <file> # 通过上下文管道处理文件
npx @crowdlisten/harness setup-context  # 配置 LLM 提供者

# 社交聆听 CLI
npx crowdlisten search reddit "AI agents" --limit 20
npx crowdlisten comments youtube dQw4w9WgXcQ --limit 100
npx crowdlisten vision https://news.ycombinator.com --limit 10
npx crowdlisten trending reddit --limit 10
npx crowdlisten status
npx crowdlisten health
```

## 支持的智能体

**登录时自动配置：** Claude Code、Cursor、Gemini CLI、Codex、Amp、OpenClaw

**也支持（手动配置）：** Copilot、Droid、Qwen Code、OpenCode

## 隐私

- PII 在 LLM 调用前本地脱敏
- 上下文存储在本地（`~/.crowdlisten/`）
- 使用你自己的 API 密钥进行 LLM 提取
- 未经明确操作不会同步数据
- 全部 MIT 开源，可审查

## 智能体参考

查看 [AGENTS.md](AGENTS.md) 获取机器可读的功能描述和示例工作流。

## 开发

```bash
git clone https://github.com/Crowdlisten/crowdlisten_harness.git
cd crowdlisten_harness
npm install && npm run build
npm test    # 通过 Vitest 运行 210 个测试
```

## 贡献

最有价值的贡献：新平台适配器（Threads、Bluesky、Hacker News、Product Hunt、Mastodon）和提取修复。

## 许可证

MIT — [crowdlisten.com](https://crowdlisten.com)
