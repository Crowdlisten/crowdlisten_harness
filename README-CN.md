# CrowdListen Harness

> 让你的 AI 智能体从经验中学习，为智能体集群构建不断进化的上下文知识库。

[English](README.md) | [中文文档](README-CN.md)

## 今天的 AI 智能体有什么问题？

AI 智能体是无状态的。每次你开启新会话，智能体都从零开始。它不记得昨天做了什么决策、为什么选择了某个方案、上周在你的代码库中发现了什么模式。你只能反复解释相同的上下文、纠正相同的错误、看着它重新发现相同的解决方案。

当你使用多个智能体时，问题更加严重。你的 Claude Code 会话搞清了团队的部署规范，但当你切换到 Cursor 做个快速修复时，那些知识就消失了。当 Gemini CLI 在夜间接手任务时，它完全不知道之前发生了什么。每个智能体都是一座孤岛。

CrowdListen Harness 解决了这个问题。它为你的智能体提供一个共享的、云端同步的知识库，在会话之间、工具之间、智能体之间持久保存。你的智能体完成的每个任务都会捕获决策、模式和经验。下一个任务继承所有这些。随着时间推移，你的智能体不只是执行——它们变得越来越聪明。

## 你能得到什么

**不断增值的知识库。** 当你的智能体做出架构决策、解决棘手的 Bug、或发现代码库中的模式时，CrowdListen Harness 会捕获这些知识。下次任何智能体处理相关任务时，这些知识会自动浮现。你不再需要重复解释上下文，而是在已有基础上持续构建。

**计划作为一等工件。** 大多数任务追踪器把计划当作纯文本描述。CrowdListen Harness 把计划视为版本化、可审核的工件，拥有完整生命周期：草案 → 审核 → 批准 → 执行 → 完成。你的智能体起草计划，你审核并留下反馈，智能体融入你的意见，归档上一版本，继续推进。每个决策和迭代都被保留。

**上下文跨智能体流转。** 从 Claude Code 切换到 Cursor 再到 Gemini CLI——知识库始终跟随你。通过 Supabase 云端同步，无论哪个智能体接手工作，它都能获取完整的历史：尝试过什么、什么有效、什么无效。

**多智能体协作。** 通过并行会话让多个智能体处理同一任务。每个智能体都能获取共享上下文，并将新的发现回写。适合将大型任务拆分为并行工作流，而不失去整体一致性。

## 立即体验

一条命令。浏览器打开，登录，智能体自动配置：

```bash
npx @crowdlisten/planner login
```

自动为 Claude Code、Cursor、Gemini CLI、Codex 和 OpenClaw 配置 MCP。同时安装 [CrowdListen Insights](https://github.com/Crowdlisten/crowdlisten_insights) 获取跨平台受众信号。无需环境变量，无需编辑 JSON，无需管理 API 密钥。

登录后重启智能体，即可开始调用工具。

### 手动配置

如果你偏好手动配置，添加以下内容到智能体的 MCP 配置：

```json
{
  "mcpServers": {
    "crowdlisten/planner": {
      "command": "npx",
      "args": ["-y", "@crowdlisten/planner"]
    }
  }
}
```

或在 [crowdlisten.com](https://crowdlisten.com) 登录，你的智能体可以阅读 [AGENTS.md](AGENTS.md) 获取完整工具参考。

## 工作原理

CrowdListen Harness 是一个 MCP 服务器——你的智能体直接调用它的 22 个工具，和调用其他 MCP 工具一样。典型的工作流如下：

1. **领取任务。** 智能体调用 `list_tasks` 查看可用工作，然后调用 `claim_task` 开始。领取任务时，它会收到完整的上下文：相关知识库条目、现有计划和相关决策的语义地图。

2. **先规划，再动手。** 对于非简单任务，智能体调用 `create_plan` 起草方案，包含假设、风险和成功标准。你审核计划、留下反馈，智能体迭代直到你批准。每个版本都被归档。

3. **带上下文执行。** 工作过程中，智能体通过 `add_context` 记录进展和决策。这些不是一次性笔记——它们成为可搜索的知识，未来的任务可以查询。

4. **捕获经验。** 任务完成后，智能体调用 `record_learning` 凝练发现。将经验提升为项目级，未来的每个智能体会话都能找到它。

5. **下一个任务更智能。** 新任务开始时，`query_context` 搜索所有积累的决策、模式和经验。你的智能体不再从零开始——它从之前的所有积累开始。

计划是可选的。简单任务可以直接跳到执行。但知识捕获始终适用，即使小任务也会为不断增长的上下文做出贡献。

## CrowdListen 生态系统

CrowdListen 是两个协同工作的 MCP 服务器：

**Insights** 发现受众在各社交平台上的讨论——Reddit、YouTube、TikTok、Twitter、Instagram、小红书等。**Harness** 将这些信号转化为有计划、可追踪的工作，知识库在每个任务间不断积累。两者配合，你的智能体可以研究话题、规划应对、执行任务，并记住所学以备下次使用。

```bash
# 一条命令安装两者
npx @crowdlisten/planner login
```

## MCP 工具

### 任务管理

| 工具 | 功能 |
|------|------|
| `list_tasks` | 列出看板上的任务（首先调用） |
| `get_task` | 获取完整任务详情 |
| `create_task` | 创建新任务 |
| `update_task` | 更改标题、描述、状态、优先级 |
| `claim_task` | 开始工作 — 返回上下文、工作区、分支 |
| `complete_task` | 标记完成，自动完结计划 |
| `delete_task` | 永久删除任务 |
| `log_progress` | 记录执行会话日志 |

### 规划

| 工具 | 功能 |
|------|------|
| `create_plan` | 创建执行计划（方案、假设、风险） |
| `get_plan` | 获取计划及版本历史和反馈 |
| `update_plan` | 迭代：更新方案、状态或添加反馈 |

### 知识库

| 工具 | 功能 |
|------|------|
| `query_context` | 搜索决策、模式、经验 |
| `add_context` | 写入知识库 |
| `record_learning` | 捕获成果，可选提升为项目范围 |
| `get_or_create_global_board` | 获取全局看板 |

### 多智能体会话

| 工具 | 功能 |
|------|------|
| `start_session` | 启动并行智能体会话 |
| `list_sessions` | 列出任务的会话 |
| `update_session` | 更新会话状态/焦点 |

### 看板管理

| 工具 | 功能 |
|------|------|
| `list_projects` | 列出可访问的项目 |
| `list_boards` | 列出项目的看板 |
| `create_board` | 创建带默认列的看板 |
| `migrate_to_global_board` | 将所有任务迁移到全局看板 |

完整参数详情：[docs/TOOLS.md](docs/TOOLS.md)

## 支持的智能体

**登录时自动配置：** Claude Code、Cursor、Gemini CLI、Codex、OpenClaw

**也支持（手动配置）：** Copilot、Droid、Qwen Code、OpenCode

## 命令

```bash
npx @crowdlisten/planner login    # 登录 + 自动配置智能体
npx @crowdlisten/planner setup    # 重新运行自动配置
npx @crowdlisten/planner logout   # 清除凭据
npx @crowdlisten/planner whoami   # 查看当前用户
```

## 智能体参考

查看 [AGENTS.md](AGENTS.md) 获取机器可读的功能描述、MCP 配置和示例工作流。

## 开发

```bash
git clone https://github.com/Crowdlisten/crowdlisten_harness.git
cd crowdlisten_harness
npm install && npm run build
npm test    # 通过 Vitest 运行 210 个测试
```

## 许可证

MIT — [crowdlisten.com](https://crowdlisten.com)
