/** Normalizes QQ Open Platform inbound messages into dsh-superagent Triggers. */
import { createHash } from 'node:crypto'
import type { QQBotInboundMessage } from '@tencent-connect/qqbot-nodejs'
import type { ChannelRef, Trigger } from './superagent.ts'

export const SOURCE = 'qq'

/** Deterministic trigger id: every read path for the same QQ message yields the same id. */
export const qqId = (...values: string[]): string =>
  createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 32)

/** Constructs the QQ reply channel address; `scope` records `c2c`/`group` explicitly. */
export const qqChannel = (scope: 'c2c' | 'group', targetId: string, messageId?: string): ChannelRef =>
  ({ source: SOURCE, thread: `${SOURCE}:${scope}:${targetId}`, address: { scope, targetId, ...(messageId ? { messageId } : {}) } })

/** QQ pushes timestamps as epoch seconds (10 digits) or milliseconds (13 digits). */
export function qqTime(value: string): string {
  const n = Number(value)
  if (Number.isFinite(n)) {
    const ms = n < 1e12 ? n * 1000 : n
    return new Date(ms).toISOString()
  }
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : value
}

/** Heuristic: detect `<@!{appId}>` or `<@{appId}>` mention markers in content (same as qqbot-nodejs). */
function detectMention(content: string, appId: string): boolean {
  if (!content || !appId) return false
  const escaped = appId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<@!?${escaped}>`).test(content)
}

/**
 * Converts a QQ inbound message into a Trigger, returning undefined for messages
 * written by the bot itself. Group messages count as `addressed: 'mention'` only
 * when QQ signals an @-mention (`GROUP_AT_MESSAGE_CREATE`, `mentions[].is_you`,
 * or a `<@!{appId}>` marker); `scope` in `SourceKind.scope` then decides whether
 * the group actually receives work.
 */
export function qqTrigger(msg: QQBotInboundMessage, appId: string): Trigger | undefined {
  if (msg.senderIsBot) return undefined
  const direct = msg.kind === 'c2c'
  const targetId = direct ? msg.senderId : (msg.groupOpenid ?? msg.senderId)
  const mentioned = !direct && (
    msg.rawEventType === 'GROUP_AT_MESSAGE_CREATE'
    || (msg.mentions?.some(item => (item as { is_you?: boolean }).is_you === true) ?? false)
    || detectMention(msg.content, appId))
  return {
    id: qqId(SOURCE, msg.messageId),
    source: SOURCE,
    threads: [{ source: SOURCE, id: `${direct ? 'c2c' : 'group'}:${targetId}` }],
    actor: { source: SOURCE, id: msg.senderId },
    human: !msg.senderIsBot,
    ...(direct ? { addressed: 'direct' as const } : mentioned ? { addressed: 'mention' as const } : {}),
    at: qqTime(msg.timestamp),
    text: msg.content,
    channel: qqChannel(direct ? 'c2c' : 'group', targetId, msg.messageId),
    meta: {
      scope: direct ? 'c2c' : 'group',
      targetId,
      messageId: msg.messageId,
      direct,
      mentioned,
      ...(msg.senderName ? { senderName: msg.senderName } : {}),
      ...(msg.groupOpenid ? { groupOpenid: msg.groupOpenid } : {}),
    },
  }
}
