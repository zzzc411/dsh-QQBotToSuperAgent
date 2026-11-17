/** QQ outbound channel: sends text replies through the connected bot. */
import type { ChannelLink, ChannelLinks, Commands, OutboundMessage } from './superagent'
import { getBot } from './bot'
import { checkedImText } from './text'

/**
 * Sends an outbound message idempotently by ID. The `host` argument is part of the
 * Source channel contract but unused here: QQ transport goes straight through the
 * active `QQBot` instance rather than a CLI subprocess.
 */
export async function sendQq(_host: { commands: Commands }, message: OutboundMessage): Promise<'sent' | 'gone'> {
  const bot = getBot()
  if (!bot) throw new Error('The QQ bot is not connected')
  const { scope, targetId, messageId } = message.channel.address
  if (!targetId) throw new Error('Missing QQ reply target')
  const target = {
    scope: (scope === 'group' ? 'group' : 'c2c') as 'group' | 'c2c',
    targetId,
    ...(messageId ? { msgId: messageId } : {}),
  }
  await bot.sendText(target, checkedImText(message.text))
  return 'sent'
}

/** QQ has no web deep link, so the fallback label is returned with an empty URL. */
export const qqLink = (_address: Record<string, string>, _links: ChannelLinks): ChannelLink => ({
  url: '',
  label: { zh: 'QQ 消息', en: 'QQ message' },
})
