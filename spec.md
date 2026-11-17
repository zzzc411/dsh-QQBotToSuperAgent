# dsh-qq-superagent 规格说明

## 1. 目标

让一个 **QQ 官方开放平台机器人**（QQ Open Platform bot，QQ 群 + 私聊）成为 `dsh-superagent` 的入站 Source：

- 手机上的 QQ 私聊 / 群消息 → `Trigger` → 策略评估 → 工单（Ticket）→ worker 会话执行 → 结果回推到 QQ。
- 每个 DSH 实例（profile）配置**各自的 AppID/AppSecret**，互不干扰，从而把“聊天专用”的 dsh21 与“干活专用”的 superagent 实例隔离。

本插件是 `dsh-superagent` 的**伴生插件**：它依赖 `dsh-superagent` 注册的 `orchestrator` 服务，通过 `orchestrator.sources.register(kind)` 接入 Source 扩展点，本身不 fork / 不重复实现 agent 逻辑。

## 2. 范围

### 2.1 已实现（v0.1.0）

- QQ 官方 bot 的 WebSocket 长连接（复用 `@tencent-connect/qqbot-nodejs` 的 `QQBot`）。
- 私聊（c2c）、群聊（group）消息 → `Trigger` 归一化：
  - 私聊 → `addressed: 'direct'`；
  - 群 @机器人（`GROUP_AT_MESSAGE_CREATE` / `mentions[].is_you` / `<@!appId>` 标记）→ `addressed: 'mention'`；
  - 机器人自己的消息 → 丢弃。
- Source 配置（`appId` / `appSecret` / 群列表 / 私聊开关 / 其他群策略），存于 dsh-superagent 的 Settings。
- 入站 scope 过滤（哪些群 / 私聊接收工作）、出站 channel（回消息）、policy（允许发起工作的用户 openid、可成为候选的机器人 openid）。
- 执行环境变量注入（`DSH_SUPERAGENT_QQ_SCOPE` / `DSH_SUPERAGENT_QQ_CHAT`）。
- 健康上报（`qq` 条目），断线自动重连（退避），Source 关闭时 5 秒内停止消费者。

### 2.2 明确不做（v0.1.0）

- **不实现**历史消息回填 / 订阅线程轮询（对照飞书 `feishu-loops.ts` 的 backfill + pollThreads）；v0.1.0 只依赖实时 WS 推送。因此：Source 关闭期间错过的消息不会补收。
- **不实现** `threadContext`（评估器读不到消息历史，只能看到 Trigger 本身文本）。
- **不实现**图片 / 文件 / 引用回复的解析与发送（仅文本）。
- **不实现** QQ 频道（guild）/ 私信（dm）与按钮交互（interaction）。
- 同一 AppID 只能有一个活动 WS 连接：**不要把同一个 bot 同时配到多个正在运行的 DSH 实例**，否则互相踢下线。

以上每一项都在 README「路线图」中列出，作为后续迭代。

## 3. 架构

```
QQ 用户 → QQ WebSocket 网关
              │  @tencent-connect/qqbot-nodejs (QQBot)
              ▼
      dsh-qq-superagent/qq-watch (本插件)
        ├─ qqTrigger(): InboundMessage → Trigger
        └─ ctx.receive(trigger)
              ▼
      dsh-superagent 编排器
        intake → Evals(策略/准入) → Tickets → worker Session 执行
              │
              ▼
      Outbox → SourceRegistry.send → sendQq() → QQBot.sendText → QQ
```

模块划分：

| 文件 | 职责 |
|---|---|
| `src/superagent.ts` | 对 dsh-superagent Source 契约的**结构化类型再声明**（因该包未发布） |
| `src/trigger.ts` | `SOURCE`、`qqId`（幂等 id）、`qqChannel`、`qqTime`、`qqTrigger` |
| `src/kind.ts` | `SourceKind`：schema、fields、scope、channel、policy、environment |
| `src/channel.ts` | 出站 `sendQq`、`qqLink` |
| `src/bot.ts` | 当前连接 bot 的单例句柄（channel 经它发消息） |
| `src/qq-watch.ts` | Cordis 插件入口：注册 kind + 运行消费者循环 |
| `src/index.ts` | 包入口，仅 re-export 供程序化引用 |

## 4. 配置与数据流

- `appId` / `appSecret`：优先读 Settings 里的 Source 配置，留空则读环境变量 `QQBOT_APPID` / `QQBOT_SECRET`（推荐用环境变量，避免明文入 Settings）。
- `groups[]`：`{ groupOpenid, name?, listen: 'mentions' | 'all' }`。
- `directMessages`：是否接收私聊。
- `otherGroups`：未列出的群 `none`（不接收）/ `mentions`（仅 @）。
- Policy：`allowed[]`（能发起工作的用户 openid）、`bots[]`（消息可成为候选的机器人 openid）。

## 5. 安全

- worker 会话由 dsh-superagent 设为 `danger-full-access`，因此 QQ 入口等于**全权限远程执行**，务必把 `allowed` 白名单收窄到本人。
- AppSecret 属于凭据，建议走环境变量注入，不要提交到 git。

## 6. 验收标准（Definition of Done）

1. `pnpm check`（typecheck + test + build）全绿。
2. 安装到某个 `dsh-superagent` profile 后，`dsh --profile <p> web` 能启动，`qq` Source 出现在 Source 列表，健康条目 `qq` 变为 `Connected as <appId>`。
3. 手机 QQ 私聊机器人 → 生成 Trigger → 生成 Ticket → worker 执行 → QQ 收到回复。
4. 白名单外用户消息不产生工单（符合 policy）。
