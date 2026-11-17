import { describe, expect, it } from 'vitest'
import type { QQBotInboundMessage } from '@tencent-connect/qqbot-nodejs'
import { qqTrigger, qqTime, SOURCE } from '../src/trigger'

const base = (overrides: Partial<QQBotInboundMessage> = {}): QQBotInboundMessage => ({
  rawEventType: 'C2C_MESSAGE_CREATE',
  kind: 'c2c',
  senderId: 'USER_OPENID',
  content: '帮我改一下登录页',
  messageId: 'MSG_1',
  timestamp: '1731800000',
  ...overrides,
} as QQBotInboundMessage)

describe('qqTime', () => {
  it('normalizes epoch seconds to ISO', () => {
    expect(qqTime('1731800000')).toBe(new Date(1731800000 * 1000).toISOString())
  })
  it('normalizes epoch milliseconds to ISO', () => {
    expect(qqTime('1731800000000')).toBe(new Date(1731800000000).toISOString())
  })
})

describe('qqTrigger', () => {
  it('maps a private message to a direct trigger', () => {
    const trigger = qqTrigger(base(), '1000000000')
    expect(trigger?.source).toBe(SOURCE)
    expect(trigger?.addressed).toBe('direct')
    expect(trigger?.human).toBe(true)
    expect(trigger?.actor).toEqual({ source: SOURCE, id: 'USER_OPENID' })
    expect(trigger?.threads[0]).toEqual({ source: SOURCE, id: 'c2c:USER_OPENID' })
    expect(trigger?.channel?.address).toMatchObject({ scope: 'c2c', targetId: 'USER_OPENID', messageId: 'MSG_1' })
  })

  it('maps an @-mention group message to a mention trigger', () => {
    const trigger = qqTrigger(base({
      rawEventType: 'GROUP_AT_MESSAGE_CREATE',
      kind: 'group',
      senderId: 'MEMBER_OPENID',
      groupOpenid: 'GROUP_OPENID',
      mentions: [{ is_you: true }],
    }), '1000000000')
    expect(trigger?.addressed).toBe('mention')
    expect(trigger?.threads[0]).toEqual({ source: SOURCE, id: 'group:GROUP_OPENID' })
    expect(trigger?.meta).toMatchObject({ scope: 'group', targetId: 'GROUP_OPENID' })
  })

  it('detects mention via the <@!appId> content marker', () => {
    const trigger = qqTrigger(base({
      rawEventType: 'GROUP_MESSAGE_CREATE',
      kind: 'group',
      senderId: 'MEMBER_OPENID',
      groupOpenid: 'GROUP_OPENID',
      content: '<@!1000000000> 帮我看看',
      mentions: [],
    }), '1000000000')
    expect(trigger?.addressed).toBe('mention')
  })

  it('drops messages written by the bot itself', () => {
    expect(qqTrigger(base({ senderIsBot: true }), '1000000000')).toBeUndefined()
  })

  it('leaves an unaddressed group message without addressed', () => {
    const trigger = qqTrigger(base({
      rawEventType: 'GROUP_MESSAGE_CREATE',
      kind: 'group',
      senderId: 'MEMBER_OPENID',
      groupOpenid: 'GROUP_OPENID',
      mentions: [],
    }), '1000000000')
    expect(trigger).toBeDefined()
    expect(trigger?.addressed).toBeUndefined()
    expect(trigger?.meta.mentioned).toBe(false)
  })
})
