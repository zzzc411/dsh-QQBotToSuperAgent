/** QR-code bind flow: surfaces the scan URL and stores the resulting credentials. */
import { startQrConnect } from '@tencent-connect/qqbot-connector'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface BoundCredentials { appId: string; appSecret: string; userOpenid?: string }

/** Live bind state, read by the Source card's `fact` and the QQ health line. */
export const bindState: {
  url: string
  phase: 'idle' | 'waiting' | 'success' | 'failed'
  appId?: string
  userOpenid?: string
  error?: string
} = { url: '', phase: 'idle' }

/** The DSH home this process runs under; the bind result lives beside it. */
export const dshHome = (): string => process.env.DSH_HOME ?? join(process.env.HOME ?? '', '.dsh')

/** Where a successful scan stores the bot credentials, read on the next start. */
export const credentialsPath = (): string => join(dshHome(), '.qq-bot-credentials.json')

/**
 * Runs the QR bind until it succeeds, fails, or `signal` aborts. On success the
 * credentials (including the scanning user's openid) are written to
 * {@link credentialsPath} so the Source can connect without a restart.
 */
export function bindQr(signal: AbortSignal): Promise<BoundCredentials | undefined> {
  return new Promise(resolve => {
    let settled = false
    let disposeRef: (() => void) | undefined
    const finish = (value: BoundCredentials | undefined): void => {
      if (settled) return
      settled = true
      disposeRef?.()
      resolve(value)
    }
    try {
      disposeRef = startQrConnect({
        onQrDisplayed(url) { bindState.url = url; bindState.phase = 'waiting' },
        onQrExpired() { bindState.phase = 'waiting' },
        onSuccess(credentials) {
          const first = credentials[0]
          if (!first) { bindState.phase = 'failed'; bindState.error = '扫码未返回有效凭据'; finish(undefined); return }
          const result: BoundCredentials = {
            appId: first.appId,
            appSecret: first.appSecret,
            ...(first.userOpenid ? { userOpenid: first.userOpenid } : {}),
          }
          bindState.phase = 'success'
          bindState.appId = first.appId
          bindState.userOpenid = first.userOpenid
          try { writeFileSync(credentialsPath(), JSON.stringify(result, null, 2), { mode: 0o600 }) }
          catch { /* keep the credentials in memory for this run */ }
          finish(result)
        },
        onFailure(error) { bindState.phase = 'failed'; bindState.error = error.message; finish(undefined) },
      }, { displayQrCodeToConsole: false, signal, source: 'dsh-qq-superagent' })
    } catch (error) {
      bindState.phase = 'failed'
      bindState.error = String(error)
      finish(undefined)
      return
    }
    if (signal.aborted) finish(undefined)
    else signal.addEventListener('abort', () => finish(undefined), { once: true })
  })
}

/** One-line bind description shown in the Source card's fact field. */
export function bindSummary(): string {
  if (bindState.phase === 'success') {
    return `已绑定 ${bindState.appId ?? ''}${bindState.userOpenid ? `；openid ${bindState.userOpenid}` : ''}`
  }
  if (bindState.phase === 'waiting') return `等待扫码：${bindState.url}`
  if (bindState.phase === 'failed') return `绑定失败：${bindState.error ?? ''}`
  return '首次使用：Source 运行时会自动生成扫码链接'
}
