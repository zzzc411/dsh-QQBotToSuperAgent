# dsh-qq-superagent

把 **QQ 官方开放平台机器人**（QQ 群 + 私聊）接到 `dsh-superagent`：手机上的 QQ 消息 → 工单 → worker 会话执行 → 结果回推到 QQ。

> 这是 `dsh-superagent` 的 **Source 伴生插件**，不是通用的 DSH 聊天插件。它需要与 `dsh-superagent` 同进程安装，才能拿到 `orchestrator` 服务并把消息变成 `Trigger`。

## 为什么是它

- `dsh-superagent` 自带的 IM 通道只有飞书（`feishu-watch`）。本插件补上 QQ 官方 bot 通道。
- 每个 DSH 实例用**各自的 AppID/AppSecret**，互不干扰：聊天用的 dsh21、干活用的 superagent 可以各配各的机器人，彻底隔离。
- 复用腾讯官方 `@tencent-connect/qqbot-nodejs` SDK（QQ 开放平台 WebSocket），不做个人 QQ 协议，规避封号风险。

## 前置条件

- Node `^22.19 || >=24`，pnpm。
- 一个启用了「消息推送」的 QQ 机器人（在 [QQ 开放平台](https://q.qq.com) 创建，拿到 **AppID** 和 **AppSecret**）。
- 一个已经能跑起来的 `dsh-superagent` profile（dsh `^0.2.1-alpha.2`）。

## 安装

```sh
# 1. 从源码构建
cd dsh-qq-superagent
pnpm install && pnpm build

# 2. 安装到 superagent profile（本地路径）
DSH_HOME=~/.dsh \
  dsh plugin --profile superagent add /home/digital/dsh-qq-superagent

# 3. 启动
DSH_HOME=~/.dsh dsh --profile superagent web
```

> 注意：`dsh-superagent` 运行在 dsh `0.2.1` 上。用哪个 `dsh` 二进制装的插件，就用同一个二进制启动。若你用的是隔离 DSH_HOME（如 dsh21 的 `isolate/0.2.1-rc.5`），`DSH_HOME` 要指向 superagent 实际所在 home。

## 配置（在 dsh-superagent 管理面板里）

打开 superagent 面板的「Sources → QQ」，填：

| 字段 | 说明 |
|---|---|
| 扫码绑定 | 只读：缺少凭据时这里显示实时的 QQ 扫码链接（自动刷新），扫码成功后凭据自动保存 |
| AppID / AppSecret | QQ 机器人凭据；留空则读环境变量 `QQBOT_APPID` / `QQBOT_SECRET`（推荐） |
| 接收的群 | `groupOpenid` + 接收模式（`仅 @` / `全部消息`） |
| 其他群 | 未列出的群：`不接收` / `仅 @` |
| 接收私聊 | 开关 |

策略（Policy）里配置「能发起工作的 QQ 用户」白名单（openid），把准入收窄到本人。

`groupOpenid` / 用户 `openid` 怎么拿：让机器人在目标群 / 私聊里说一句话，看面板里 Source 的状态 / 健康信息，或临时放开「全部消息」观察收到的 Trigger。

## 工作机制

```
QQ → WebSocket → QQBot → qqTrigger() → Trigger → superagent intake
     → Evals(策略) → Ticket → worker Session → Outbox → sendQq() → QQ
```

- 私聊 = 明确的请求（`addressed: 'direct'`）。
- 群 @机器人 = 明确的请求（`addressed: 'mention'`）；群「全部消息」模式下的非 @消息只作为评估的候选。
- 机器人自己的消息、白名单外的用户、不在接收范围的群，都不会产生工单。

## 安全

worker 会话是 `danger-full-access` 全权限，QQ 入口等于全权限远程执行。务必：

1. 白名单只放自己的 openid。
2. AppSecret 走环境变量，不要写进面板 / 提交到 git。
3. **同一 AppID 只能有一个活动连接**——不要把同一个机器人同时配到多个正在运行的 DSH 实例（例如和 dsh21 的 `im-qqbot` 争抢），否则互相踢下线。

## 路线图（未实现）

- 历史消息回填、订阅线程轮询（断线补收）。
- `threadContext`（评估器读取消息历史）。
- 图片 / 文件 / 引用回复。
- QQ 频道（guild）与按钮交互。

## 开发

```sh
pnpm check   # typecheck + test + build
```

详见 [AGENTS.md](./AGENTS.md) 与 [spec.md](./spec.md)。

## License

MIT
