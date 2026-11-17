/**
 * dsh-qq-superagent: a QQ (official QQ Open Platform bot) Source for dsh-superagent.
 *
 * The bundle layer (`cordis.patch.yml`) inserts this package root as a no-op host
 * row — it anchors client-module discovery (the browser panel) — and the
 * `qq-watch` plugin, which registers the QQ Source and runs the bot.
 */
export const name = 'dsh-qq-superagent'
export const inject: string[] = []
/** No-op host half; the Source itself lives in `./qq-watch`. */
export function apply(): void { /* anchors the client module, nothing to mount */ }

export { qqKind, QQConfigSchema, credentials, qqSettings, type QQConfig } from './kind'
export { qqTrigger, qqChannel, qqTime, qqId, SOURCE } from './trigger'
export { sendQq, qqLink } from './channel'
export { setBot, getBot } from './bot'
export { bindQr, bindState, bindSummary, credentialsPath, dshHome, type BoundCredentials } from './bind'
export type {
  SourceKind, SourceHost, SourceContext, SourceChannel, SourcePolicyPart,
  Trigger, OutboundMessage, ChannelRef, ThreadRef, ActorRef, ScopeResult,
  Localized, FieldSpec, Health,
} from './superagent'
