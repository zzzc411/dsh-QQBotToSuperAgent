/** Holds the currently connected QQBot so the outbound channel can reach it. */
import type { QQBot } from '@tencent-connect/qqbot-nodejs'

let active: QQBot | undefined

export function setBot(bot: QQBot | undefined): void {
  active = bot
}

export function getBot(): QQBot | undefined {
  return active
}
