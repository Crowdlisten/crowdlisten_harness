# CrowdListen

> 为你的 AI 智能体提供群体上下文——来自真实用户的分析情报：他们在说什么、市场在想什么、社区需要什么。

![CrowdListen — Give your agent evidence, not guesses](docs/images/hero.png)

[English](README.md) | [中文文档](README-CN.md) | [한국어](README-KO.md) | [Español](README-ES.md)

## 问题所在

AI 智能体不知道你的用户在想什么。每次会话都从零开始——不知道 Reddit 上用户在说什么，没有 TikTok 评论的信号，没有论坛讨论的综合分析。你只能手动复制粘贴反馈，看着智能体在缺少最关键输入的情况下做决策：真实用户的想法。

CrowdListen 通过四步循环解决这个问题：

1. **聆听** — 搜索 Reddit、YouTube、TikTok、Twitter/X、Instagram、小红书和论坛
2. **分析** — 按主题聚类意见、提取痛点、综合跨平台报告
3. **保存** — 将洞察存入 .md 知识库，跨会话持续积累
4. **调取** — 任何智能体通过语义搜索检索上下文，或直接浏览 INDEX.md

任何智能体 — Claude Code、Cursor、Gemini CLI、Codex — 都可以随时调取。情报跨会话、跨智能体持续积累。这就是群体上下文。

## 立即体验

一条命令。浏览器打开，登录，智能体自动配置：

```bash
npx @crowdlisten/harness login
```

自动为 **Claude Code、Cursor、Gemini CLI、Codex、Amp 和 OpenClaw** 配置 MCP。无需环境变量，无需编辑 JSON，无需管理 API 密钥。登录后重启智能体即可。

### 手动配置

添加到智能体的 MCP 配置：

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

远程访问使用 HTTP 传输：

```json
{
  "mcpServers": {
    "crowdlisten": {
      "url": "https://mcp.crowdlisten.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## 你能做什么

| 功能 | 说明 | 原理 |
|------|------|------|
| **搜索社交平台** | 一个工具搜索 Reddit、YouTube、TikTok、Twitter/X、Instagram、小红书 | 返回带互动指标、时间戳和作者信息的结构化帖子——所有平台格式统一 |
| **分析受众信号** | 聚类意见、提取痛点、生成跨平台报告 | AI 按主题分组评论、评分情感、识别竞争信号 |
| **跨会话保存和调取** | .md 知识库跨智能体和设备持续积累 | 用 `save` 保存，`recall` 检索，浏览 `~/.crowdlisten/context/INDEX.md`，`sync_context({ organize: true })` 整理 |
| **规划和跟踪工作** | 任务、执行计划、进度跟踪、服务端执行 | 智能体领取任务、起草带假设和风险的方案、记录进度、触发执行并轮询状态 |
| **运行完整分析** | 端到端群体分析，流式返回结果 | `run_analysis` 触发后端完整流水线；`continue_analysis` 追问 |
| **从群体反馈获取规格说明** | 将群体情报转化为可执行的规格说明 | 规格包含证据引用、验收标准和置信度评分 |
| **从任意网站提取** | 截图任意 URL 并返回结构化数据 | 视觉模式将截图发送给 LLM——适用于论坛、付费墙网站等 |

## 工作原理

![CrowdListen Pipeline — Raw Crowd Signals to Agent Delivery](docs/images/pipeline.jpg)

智能体从 **7 个核心工具** 开始，按需激活技能包（所有包共约 30 个工具）。无需重启——新工具通过 `tools/list_changed` 自动出现。

**任务执行** — 触发服务端 AI 智能体执行（Amp、Claude Code、Codex、Gemini CLI），通过 MCP 轮询进度。调用 `execute_task` 分派工作，`get_execution_status` 跟踪完成情况。

### 技能包

| 技能包 | 工具数 | 描述 |
|--------|:------:|------|
| **core**（始终开启） | 7 | .md 知识库（save/recall/sync/publish）、技能发现、偏好设置 |
| **social-listening** | 7 | 搜索 Reddit、TikTok、YouTube、Twitter、Instagram、小红书 |
| **audience-analysis** | 4 | 意见聚类、洞察提取、内容丰富 |
| **planning** | 13 | 任务、执行计划、进度跟踪、服务端智能体执行 |
| **analysis** | 5 | 运行完整分析、从结果生成规格说明 |
| **crowd-intelligence** | 2 | 异步群体研究与任务轮询 |
| **spec-delivery** | 3 | 浏览和领取群体反馈的可执行规格说明 |
| **sessions** | 3 | 多智能体协作 |
| **setup** | 3 | 看板管理、项目列表、迁移 |
| **agent-network** | 2 | 注册智能体、发现能力 |

另有 9 个**工作流包**，激活时通过 SKILL.md 提供专业方法论：
- knowledge-base、competitive-analysis、content-strategy、content-creator、data-storytelling、heuristic-evaluation、market-research-reports、user-stories、ux-researcher

完整工具参考：**[docs/TOOLS.md](docs/TOOLS.md)**

### 知识库

每次智能体交互都能让知识库更好。系统以复利循环运作：

```
 save()          Supabase              ~/.crowdlisten/context/
───────→  memories 表  ──渲染──→  ├── INDEX.md
                                  ├── entries/a1b2c3d4.md
 recall()        ↑                └── topics/auth.md
←────────────────┘
                                  sync_context({ organize: true })
 sync_context()                   检测重复，
 重建本地 ←──── 完整拉取 ────── 按主题分组，
 .md 缓存                        建议合成
```

**数据流向：**

1. **保存** — `save({ title, content, tags })` 写入 Supabase，并在本地渲染带 YAML 前置数据的 `.md` 文件
2. **调取** — `recall({ search })` 通过语义搜索（pgvector 余弦相似度）查询 Supabase，关键词匹配作为后备。结构化浏览可直接读取 `~/.crowdlisten/context/INDEX.md`
3. **同步** — `sync_context()` 从云端拉取所有条目并重建本地 `.md` 目录。切换设备或网页上传后使用。传入 `organize: true` 可检测近似重复（Jaccard 相似度）、识别 3+ 条目的主题，返回报告告知智能体需要合成或修剪什么
4. **发布** — `publish_context({ memory_id, team_id })` 与团队成员共享条目。下次 `sync_context` 会将其拉入 INDEX.md 的 `## Shared` 部分

**复利效应：** 每次分析或研究任务后，智能体保存 2-3 个关键要点。随时间推移，`sync_context({ organize: true })` 将其分组为主题。智能体将主题合成为精炼摘要。下一个智能体从丰富的 INDEX.md 开始，而非白纸一张。

Supabase 是唯一真实来源。本地 `.md` 目录是只读渲染缓存——没有同步冲突，没有合并问题。

### 平台

| 平台 | 配置 | 说明 |
|------|------|------|
| Reddit | 无需配置 | 即刻可用 |
| TikTok、Instagram、小红书 | `npx playwright install chromium` | 基于浏览器提取 |
| Twitter/X | `.env` 中设置 `TWITTER_USERNAME` + `TWITTER_PASSWORD` | 基于凭证 |
| YouTube | `.env` 中设置 `YOUTUBE_API_KEY` | 需要 API 密钥 |
| 视觉模式（任意 URL） | `ANTHROPIC_API_KEY`、`GEMINI_API_KEY` 或 `OPENAI_API_KEY` 之一 | 截图 + LLM 提取 |

### 支持的智能体

**登录时自动配置：** Claude Code、Cursor、Gemini CLI、Codex、Amp、OpenClaw

**也支持（手动配置）：** Copilot、Droid、Qwen Code、OpenCode

## CLI

```bash
npx @crowdlisten/harness login          # 登录 + 自动配置智能体
npx @crowdlisten/harness setup          # 重新运行自动配置
npx @crowdlisten/harness serve          # 启动 HTTP 服务器，端口 :3848

npx crowdlisten search reddit "AI agents" --limit 20
npx crowdlisten vision https://news.ycombinator.com --limit 10
npx crowdlisten trending reddit --limit 10
```

## 隐私

- PII 在 LLM 调用前本地脱敏
- 记忆以行级安全存储——用户只能访问自己的数据
- 云端不可用时本地回退
- 使用你自己的 API 密钥进行 LLM 提取
- 未经明确操作不会同步数据
- MIT 开源，可审查

## 开发

```bash
git clone https://github.com/Crowdlisten/crowdlisten_harness.git
cd crowdlisten_harness
npm install && npm run build
npm test    # 通过 Vitest 运行 210+ 个测试
```

智能体可读的功能描述和示例工作流，请参阅 [AGENTS.md](AGENTS.md)。

## 贡献

最有价值的贡献：新平台适配器（Threads、Bluesky、Hacker News、Product Hunt、Mastodon）和提取修复。

## 许可证

MIT — [crowdlisten.com](https://crowdlisten.com)
