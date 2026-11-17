/** The QQ Source kind: configuration schema, UI fields, scope, channel, and policy. */
import { z } from 'zod'
import { qqLink, sendQq } from './channel'
import { SOURCE } from './trigger'
import type { Localized, SourceKind } from './superagent'

const GroupSchema = z.object({
  groupOpenid: z.string().min(1).max(128),
  name: z.string().trim().max(60).optional(),
  listen: z.enum(['mentions', 'all']),
}).strict()

export const QQConfigSchema = z.object({
  /** QQ Open Platform AppID; empty means read QQBOT_APPID. */
  appId: z.string().trim().default(''),
  /** QQ Open Platform AppSecret; empty means read QQBOT_SECRET. */
  appSecret: z.string().trim().default(''),
  groups: z.array(GroupSchema)
    .refine(groups => new Set(groups.map(group => group.groupOpenid)).size === groups.length, 'Duplicate group ids')
    .default([]),
  directMessages: z.boolean().default(true),
  otherGroups: z.enum(['none', 'mentions']).default('none'),
}).strict()

export type QQConfig = z.infer<typeof QQConfigSchema>

/** Resolves AppID/AppSecret from config, falling back to environment variables. */
export function credentials(config: QQConfig): { appId: string; appSecret: string } {
  const appId = config.appId || process.env.QQBOT_APPID || ''
  const appSecret = config.appSecret || process.env.QQBOT_SECRET || ''
  if (!appId || !appSecret) throw new Error('The QQ Source needs an AppID and AppSecret (configure them or set QQBOT_APPID / QQBOT_SECRET)')
  return { appId, appSecret }
}

const PolicySchema = z.object({
  allowed: z.array(z.object({ id: z.string().min(1).max(64), name: z.string().trim().max(100).optional() }).strict())
    .refine(users => new Set(users.map(user => user.id)).size === users.length, 'Duplicate openids')
    .default([]),
  bots: z.array(z.object({ id: z.string().min(1).max(64), name: z.string().trim().max(100).optional() }).strict())
    .refine(bots => new Set(bots.map(bot => bot.id)).size === bots.length, 'Duplicate bot ids')
    .optional(),
}).strict()

export const qqKind: SourceKind<QQConfig> = {
  kind: SOURCE,
  title: { zh: 'QQ', en: 'QQ' },
  description: {
    zh: '接收 QQ 私聊和这些群里发给机器人的消息，作为工单进入 dsh-superagent。',
    en: 'Receives QQ direct messages and messages to the bot in these groups as dsh-superagent tickets.',
  },
  schema: QQConfigSchema,
  fields: [
    {
      key: 'appId', type: 'text', label: { zh: 'AppID', en: 'AppID' },
      hint: { zh: 'QQ 开放平台的机器人 AppID；留空则读环境变量 QQBOT_APPID。保存后重启 dsh-superagent 生效。', en: 'QQ Open Platform bot AppID; empty reads QQBOT_APPID. Saving restarts dsh-superagent.' },
    },
    {
      key: 'appSecret', type: 'text', label: { zh: 'AppSecret', en: 'AppSecret' },
      hint: { zh: 'QQ 开放平台的机器人 AppSecret；留空则读环境变量 QQBOT_SECRET（更安全）。', en: 'QQ Open Platform bot AppSecret; empty reads QQBOT_SECRET (preferred).' },
    },
    {
      key: 'groups', type: 'rows', label: { zh: '接收的群', en: 'Groups' },
      hint: { zh: '“仅 @”只接收 @ 机器人的消息；“全部消息”也接收其余消息，评估可以按规则从中推断工作。', en: '"@ only" receives messages that mention the bot; "All" also receives the rest, from which Eval may infer work.' },
      columns: [
        { key: 'groupOpenid', type: 'text', label: { zh: '群 openid', en: 'Group openid' } },
        { key: 'listen', type: 'select', label: { zh: '接收', en: 'Receive' }, options: [{ value: 'mentions', label: { zh: '仅 @', en: '@ only' } }, { value: 'all', label: { zh: '全部消息', en: 'All' } }] },
      ],
    },
    {
      key: 'otherGroups', type: 'select', label: { zh: '其他群', en: 'Other groups' },
      options: [{ value: 'none', label: { zh: '不接收', en: 'Not received' } }, { value: 'mentions', label: { zh: '仅 @', en: '@ only' } }],
      hint: { zh: '机器人已加入、但没列在上面的群。“仅 @”接收那里 @ 机器人的消息。', en: 'Groups the bot has joined that are not listed above. "@ only" receives messages there that mention the bot.' },
    },
    { key: 'directMessages', type: 'switch', label: { zh: '接收私聊', en: 'Direct messages' } },
  ],
  health: ['qq'],
  scope({ meta }, config) {
    if (meta.scope === 'c2c') return config.directMessages ? { listened: true, observed: false, row: 'direct' } : { listened: false, reason: 'direct_messages_not_allowed' }
    const group = config.groups.find(item => item.groupOpenid === meta.targetId)
    if (group) return { listened: true, observed: group.listen === 'all', row: group.groupOpenid }
    return config.otherGroups === 'mentions' ? { listened: true, observed: false, row: 'other' } : { listened: false, reason: 'group_not_allowed' }
  },
  channel: {
    allowed: (address, config) => qqKind.scope!({ meta: { scope: address.scope, targetId: address.targetId } }, config).listened,
    send: sendQq,
    link: qqLink,
  },
  policy: {
    unnamed: { person: { zh: 'QQ 用户', en: 'QQ user' }, bot: { zh: 'QQ 机器人', en: 'QQ bot' } },
    schema: PolicySchema,
    fields: [
      {
        key: 'allowed', type: 'rows', label: { zh: '能发起工作的 QQ 用户', en: 'QQ users who may originate work' },
        columns: [
          { key: 'id', type: 'text', label: { zh: 'openid', en: 'openid' } },
          { key: 'name', type: 'text', label: { zh: '名字', en: 'Name' }, optional: true },
        ],
      },
      {
        key: 'bots', type: 'rows', label: { zh: '消息可以成为候选的机器人', en: 'Bots whose messages may become candidates' },
        hint: { zh: '名单里的机器人在接收的群里发的消息成为推断的候选；它们不能发起明确的请求。', en: 'Messages of a bot on this list, in groups the Source receives, become inferred candidates; they never make an explicit request.' },
        columns: [
          { key: 'id', type: 'text', label: { zh: 'openid', en: 'openid' } },
          { key: 'name', type: 'text', label: { zh: '名字', en: 'Name' }, optional: true },
        ],
      },
    ],
    explicit: { zh: '名单内的人私聊机器人或在群里 @ 机器人，总是明确的请求。', en: 'Someone on the list who messages the bot directly or @-mentions it always makes an explicit request.' },
    rows(stored) {
      const config = QQConfigSchema.parse(stored)
      const mentions = { zh: '仅 @', en: '@ only' }
      const all = { zh: '全部消息', en: 'All' }
      return [
        ...config.groups.map(group => ({
          id: group.groupOpenid,
          label: group.name || group.groupOpenid,
          note: group.listen === 'all' ? all : mentions,
          cells: { listedUnaddressed: group.listen === 'all', unlistedAddressed: true, unlistedUnaddressed: group.listen === 'all' },
        })),
        {
          id: 'other', label: { zh: '其他群', en: 'Other groups' },
          note: config.otherGroups === 'mentions' ? mentions : { zh: '不接收', en: 'Not received' },
          cells: { listedUnaddressed: false, unlistedAddressed: config.otherGroups === 'mentions', unlistedUnaddressed: false },
        },
        {
          id: 'direct', label: { zh: '私聊', en: 'Direct messages' },
          note: config.directMessages ? { zh: '接收', en: 'Received' } : { zh: '不接收', en: 'Not received' },
          cells: { listedUnaddressed: false, unlistedAddressed: config.directMessages, unlistedUnaddressed: false },
        },
      ]
    },
  },
  environment: {
    variables: [
      { key: 'DSH_SUPERAGENT_QQ_SCOPE', description: { zh: '工单来自的 QQ 会话类型（c2c / group）；非 QQ 来源时为空', en: 'QQ scope the ticket came from (c2c / group); empty when not from QQ' } },
      { key: 'DSH_SUPERAGENT_QQ_CHAT', description: { zh: '工单来自的 QQ 会话 id（私聊 openid 或群 openid）；非 QQ 来源时为空', en: 'QQ chat id (user or group openid) the ticket came from; empty when not from QQ' } },
    ],
    values: ({ trigger }) => ({
      DSH_SUPERAGENT_QQ_SCOPE: trigger?.source === SOURCE ? String(trigger.meta.scope ?? '') : '',
      DSH_SUPERAGENT_QQ_CHAT: trigger?.source === SOURCE ? String(trigger.meta.targetId ?? '') : '',
    }),
  },
}

/** Settings fallback: schema defaults while the QQ plugin is disabled. */
export const qqSettings = (sources: { instance<C extends Record<string, unknown>>(kind: string): { config: C } | undefined }): QQConfig =>
  sources.instance<QQConfig>(SOURCE)?.config ?? QQConfigSchema.parse({})
