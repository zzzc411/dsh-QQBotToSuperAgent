/**
 * Minimal structural re-declarations of the dsh-superagent Source contract.
 *
 * dsh-superagent is `private: true` and not published to a registry, so this
 * plugin cannot import its types at build time. The contract is structural:
 * what matters is that the object we hand to `orchestrator.sources.register`
 * has the same shape the runtime expects. Everything here mirrors the public
 * surface in dsh-superagent's `src/sources/{kind,host}.ts` and `src/core/*.ts`.
 *
 * Only the subset actually used by this plugin is declared; the rest is omitted
 * on purpose to avoid coupling to fields we never touch.
 */

export interface Localized { zh: string; en: string }

export interface ActorRef { source: string; id: string }
export interface ThreadRef { source: string; id: string }
export interface ChannelRef { source: string; thread: string; address: Record<string, string> }

export type ScopeResult = { listened: true; observed: boolean; row?: string } | { listened: false; reason: string }

/** One immutable event a Source produces; `text` and `meta` are untrusted external data. */
export interface Trigger {
  id: string
  source: string
  /** Every thread the trigger belongs to; the first is the primary thread. */
  threads: ThreadRef[]
  actor: ActorRef
  /** Whether the event was written by a person rather than a bot. */
  human: boolean
  /** The sender addressed the agent, by mentioning it or in a direct message. */
  addressed?: 'mention' | 'direct'
  at: string
  text: string
  channel?: ChannelRef
  url?: string
  meta: Record<string, unknown>
}

export interface OutboundMessage {
  id: string
  channel: ChannelRef
  text: string
  kind: 'acknowledgement' | 'reply' | 'notice'
  ticketId?: string
}

export type ReceiveResult = 'stored' | 'duplicate' | 'filtered'

export interface ChannelLink { url: string; label: Localized; triggerId?: string }
export interface ChannelLinks { repository?: unknown; feishu?: unknown }

export interface Deployment {
  repository?: string
  feishu?: { brand?: string; name?: string; botId?: string }
  [key: string]: unknown
}

export interface Commands { withSignal(signal?: AbortSignal): Commands }

export interface Health {
  state: 'starting' | 'ready' | 'paused' | 'error'
  detail: string
  at?: string
}

export interface SourceContext {
  readonly ready: Promise<void>
  /** False until dsh-superagent's setup resolved the repository and accounts. */
  configured(): boolean
  /** Returns the Source's config while enabled, or undefined while disabled. */
  config<C extends Record<string, unknown>>(kind: string): C | undefined
  /** Ingests a trigger into the engine; callers should await completion. */
  receive(trigger: Trigger): ReceiveResult | Promise<ReceiveResult>
  /** Reports one of this kind's declared health entries. */
  report(entry: string, health: Health): void
}

export interface SourceHost {
  readonly sources: { register<C extends Record<string, unknown>>(kind: SourceKind<C>): () => void }
  context(kind: { kind: string; health: readonly string[] }): SourceContext
}

interface FieldBase { key: string; label: Localized; hint?: Localized; advanced?: true }

export type FieldSpec =
  | FieldBase & { type: 'switch' }
  | FieldBase & { type: 'select'; options: { value: string; label: Localized }[] }
  | FieldBase & { type: 'number'; min: number; max: number }
  | FieldBase & { type: 'text'; pattern?: string; readonly?: boolean; choose?: Localized }
  | FieldBase & { type: 'fact'; settings?: 'deployment' }
  | FieldBase & { type: 'rows'; columns: Array<
      | { key: string; label: Localized; type: 'text'; pattern?: string; optional?: boolean; choose?: Localized; refresh?: Localized }
      | { key: string; label: Localized; type: 'select'; options: { value: string; label: Localized }[] }
    > }

export interface AdmissionRowView {
  id: string
  label: Localized | string
  note: Localized
  cells: { listedUnaddressed: boolean; unlistedAddressed: boolean; unlistedUnaddressed: boolean }
}

export interface SourcePolicyPart<P extends Record<string, unknown>> {
  schema: unknown
  fields: FieldSpec[]
  explicit: Localized
  unnamed?: { person: Localized; bot: Localized }
  rows?(config: Record<string, unknown>): AdmissionRowView[]
  sync?: { label: Localized; ready(part: P): boolean; run(host: SourceHost, part: P, signal: AbortSignal): Promise<P> }
}

export interface SourceChannel<C> {
  allowed?(address: Record<string, string>, config: C): boolean
  /** @throws when delivery failed but may succeed on a later retry. */
  send(host: { commands: Commands }, message: OutboundMessage): Promise<'sent' | 'gone'>
  link(address: Record<string, string>, links: ChannelLinks): ChannelLink
}

export interface VariableSpec { key: string; description: Localized }

export interface SourceKind<C extends Record<string, unknown> = Record<string, unknown>> {
  kind: string
  title: Localized
  description: Localized
  schema: unknown
  fields: FieldSpec[]
  health: string[]
  /** Read-only facts shown beside the Source card's fields (undefined while setup is pending). */
  facts?(deployment: Deployment | undefined): Record<string, Localized | string>
  scope?(input: { meta: Record<string, unknown> }, config: C): ScopeResult
  channel?: SourceChannel<C>
  find?(query: string): { threads: string[]; terms: string[] }
  repliesTo?(trigger: Trigger): string | undefined
  policy?: SourcePolicyPart<Record<string, unknown> & { allowed: { id: string; name?: string }[] }>
  environment?: {
    variables: readonly VariableSpec[]
    values(input: { deployment: Deployment; config: C; trigger?: Trigger }): Record<string, string>
  }
}
