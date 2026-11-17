# dsh-qq-superagent 开发指南

本文面向维护 / 扩展本仓库的 agent 与开发者。运行前提：这是一个 **pnpm** 仓库，目标是作为 `dsh-superagent` 的 Source 伴生插件。

## 术语与边界

- **Source**：dsh-superagent 的入站通道抽象（见其 `src/sources/kind.ts`）。本插件实现一个 `SourceKind`（`kind: 'qq'`）并注册进 `orchestrator.sources`。
- **契约是结构化的**：dsh-superagent 是 `private: true`，未发布到 registry，无法在编译期 import 其类型。因此 `src/superagent.ts` 手工再声明了最小契约子集。改动前先对照 dsh-superagent 的 `src/sources/{kind,host}.ts` 与 `src/core/{model,ports}.ts`，保持形状一致。
- **传输层**：`@tencent-connect/qqbot-nodejs` 的 `QQBot`（QQ 开放平台，WebSocket 模式）。不要引入个人 QQ 协议（OneBot/NapCat）。

## 常用命令

```sh
pnpm install          # 安装依赖
pnpm build            # tsdown 打包到 lib/（index + qq-watch 两个入口）
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest
pnpm check            # 三连：typecheck + test + build
```

## 目录约定

- 运行时依赖（`@tencent-connect/qqbot-nodejs`、`zod`）在 `package.json` 的 `dependencies`，构建时 `neverBundle`（保持外部依赖，由 profile 的 pnpm 安装）。
- `@deepseek-ai/cordis` 是 peer（host 注入），devDep 固定到与 dsh-superagent 相同的 `4.0.5-alpha.1`。
- 构建产物 `lib/` 与 `node_modules/` 均入 `.gitignore`，不提交。

## 改动要点

### 新增字段 / 配置
1. 改 `src/kind.ts` 的 `QQConfigSchema`（zod）。
2. 同步 `fields` 里的 UI 表单描述（`FieldSpec`，支持 `switch` / `select` / `text` / `rows`）。
3. 若影响准入，同步 `scope()`、`policy.rows()`。

### 改消息归一化
- 只改 `src/trigger.ts` 的 `qqTrigger()`；用 `tests/trigger.spec.ts` 锁定行为。
- `id` 必须幂等：同一 QQ 消息任何路径产出的 `id` 一致（用 `qqId(SOURCE, messageId)`）。

### 改出站
- 只改 `src/channel.ts` 的 `sendQq()`；`message.channel.address` 形如 `{ scope, targetId, messageId? }`。
- 发送失败应当**抛出**（Outbox 会重试），只有确定对方永久无法接收才返回 `'gone'`。

## 已知约束（改前必读）

1. 同一 AppID 只能有一个活动 WS 连接；测试时不要和 dsh21 里已启用的 `im-qqbot` 争抢同一个 AppID。
2. v0.1.0 无历史回填 / 无 `threadContext` / 无图片；需要时对照飞书实现（`feishu-loops.ts`、`feishu-read.ts`）补全，并更新 `spec.md` 的“未实现”清单。
3. 本插件依赖 `orchestrator` 服务：只能装进同时加载 `dsh-superagent` 的 profile，否则该插件不激活。

## 提交与版本

- 遵循语义化版本；改动 Source 契约相关行为时 bump minor，仅修 bug bump patch。
- 每次合并前跑 `pnpm check`。
