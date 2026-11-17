/**
 * dsh-qq-superagent: a QQ (official QQ Open Platform bot) Source for dsh-superagent.
 *
 * This package's bundle layer (`cordis.patch.yml`) inserts the `qq-watch` plugin,
 * which registers the QQ Source and runs the bot. This entry re-exports the pieces
 * other code may import programmatically.
 */
export { qqKind, QQConfigSchema, credentials, qqSettings, type QQConfig } from './kind'
export { qqTrigger, qqChannel, qqTime, qqId, SOURCE } from './trigger'
export { sendQq, qqLink } from './channel'
export { setBot, getBot } from './bot'
export type {
  SourceKind, SourceHost, SourceContext, SourceChannel, SourcePolicyPart,
  Trigger, OutboundMessage, ChannelRef, ThreadRef, ActorRef, ScopeResult,
  Localized, FieldSpec, Health,
} from './superagent'
