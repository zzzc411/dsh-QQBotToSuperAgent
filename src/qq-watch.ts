/** QQ Source plugin entry: registers the kind and runs the live event consumer. */
import type { Context } from '@deepseek-ai/cordis'
import { QQBot } from '@tencent-connect/qqbot-nodejs'
import { setTimeout as delay } from 'node:timers/promises'
import { bindQr, bindState } from './bind'
import { registerBindRoutes } from './http'
import { credentials, QQConfigSchema, qqKind, type QQConfig } from './kind'
import { qqTrigger, SOURCE } from './trigger'
import { setBot } from './bot'
import type { SourceContext, SourceHost } from './superagent'

export const name = 'dsh-qq-superagent-qq'
export const inject = ['orchestrator', 'webServer']

export function apply(ctx: Context): void {
  const orchestrator = ctx.get('orchestrator') as unknown as SourceHost
  const webServer = ctx.get('webServer') as unknown as Parameters<typeof registerBindRoutes>[0]
  ctx.logger.info('dsh-qq-superagent: QQ Source registered (kind=%s)', qqKind.kind)
  ctx.effect(() => orchestrator.sources.register(qqKind), 'qq: source kind')
  ctx.effect(() => registerBindRoutes(webServer), 'qq: bind routes')
  ctx.effect(() => {
    const controller = new AbortController()
    const running = runQq(orchestrator.context(qqKind), controller.signal)
    return async () => { controller.abort(); await running }
  })
}

/** Runs the live event consumer only while the Source is enabled and configured. */
async function runQq(ctx: SourceContext, signal: AbortSignal): Promise<void> {
  await ctx.ready
  let retry: number | undefined
  while (!signal.aborted) {
    const config = ctx.config<QQConfig>(SOURCE)
    if (!config) {
      ctx.report('qq', { state: 'paused', detail: 'The QQ Source is off' })
      await delay(5000, undefined, { signal }).catch(() => {})
      continue
    }
    if (!ctx.configured()) {
      ctx.report('qq', { state: 'paused', detail: 'Waiting for dsh-superagent setup' })
      await delay(5000, undefined, { signal }).catch(() => {})
      continue
    }
    let creds: { appId: string; appSecret: string } | undefined
    try { creds = credentials(config) }
    catch {
      creds = await ensureCredentials(ctx, signal)
      if (signal.aborted) break
      if (!creds) { await delay(15000, undefined, { signal }).catch(() => {}); continue }
    }
    // Mark the bind as done so the panel shows "connected" rather than a stale QR.
    bindState.phase = 'success'
    bindState.appId = creds.appId
    const running = new AbortController()
    const check = setInterval(() => { if (!ctx.config<QQConfig>(SOURCE)) running.abort() }, 5000)
    const stop = () => running.abort()
    signal.addEventListener('abort', stop, { once: true })
    const began = Date.now()
    try { await consume(ctx, creds, running.signal) }
    catch (error) { if (!running.signal.aborted) ctx.report('qq', { state: 'error', detail: String(error) }) }
    finally { clearInterval(check); signal.removeEventListener('abort', stop) }
    if (running.signal.aborted) continue
    retry = consumerRetry(retry, Date.now() - began)
    await delay(retry, undefined, { signal }).catch(() => {})
  }
}

/**
 * Runs the QR bind when no credentials are configured, surfacing the live scan
 * URL in the QQ health line (which the Sources card shows). On success it returns
 * the credentials the bind wrote to `$DSH_HOME/.qq-bot-credentials.json`.
 */
async function ensureCredentials(ctx: SourceContext, signal: AbortSignal): Promise<{ appId: string; appSecret: string } | undefined> {
  // Keep the health line's URL current while the QR refreshes.
  const ticker = setInterval(() => {
    if (bindState.phase === 'waiting' && bindState.url) ctx.report('qq', { state: 'paused', detail: `需要扫码绑定：${bindState.url}` })
  }, 3000)
  try {
    ctx.report('qq', { state: 'paused', detail: bindState.url ? `需要扫码绑定：${bindState.url}` : '正在生成扫码链接…' })
    const bound = await bindQr(signal)
    if (!bound) {
      ctx.report('qq', { state: 'error', detail: bindState.error ? `扫码绑定失败：${bindState.error}` : '扫码绑定未完成' })
      return undefined
    }
    const openid = bound.userOpenid ? `；请在「策略 → QQ → 允许的用户」加入 openid ${bound.userOpenid}` : ''
    ctx.report('qq', { state: 'paused', detail: `已绑定 ${bound.appId}${openid}` })
    await delay(3000, undefined, { signal }).catch(() => {})
    return { appId: bound.appId, appSecret: bound.appSecret }
  } finally { clearInterval(ticker) }
}

/** Wait before reconnecting: 1s after a run that stayed up for a minute, otherwise exponential backoff up to 60s. */
function consumerRetry(previous: number | undefined, ranMs: number): number {
  return previous === undefined || ranMs >= 60_000 ? 1000 : Math.min(previous * 2, 60_000)
}

async function consume(ctx: SourceContext, creds: { appId: string; appSecret: string }, signal: AbortSignal): Promise<void> {
  const bot = new QQBot({ appId: creds.appId, appSecret: creds.appSecret })
  setBot(bot)
  let chain = Promise.resolve()
  bot.on('ready', () => ctx.report('qq', { state: 'ready', detail: `Connected as ${creds.appId}`, at: new Date().toISOString() }))
  bot.on('disconnected', event => { ctx.report('qq', { state: 'error', detail: `Disconnected (code ${String(event?.code ?? '')})` }) })
  bot.on('error', error => { ctx.report('qq', { state: 'error', detail: String(error) }) })
  bot.on('message', (_mctx, msg) => {
    chain = chain.then(async () => {
      const trigger = qqTrigger(msg, creds.appId)
      // Messages already read when the Source is disabled are dropped.
      if (!trigger || !ctx.config<QQConfig>(SOURCE)) return
      await ctx.receive(trigger)
    }).catch(error => { ctx.report('qq', { state: 'error', detail: String(error) }) })
  })
  try { await bot.start(signal) }
  finally { setBot(undefined); await chain }
}
