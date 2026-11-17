/** Host routes backing the client panel: the live QR-bind state. */
import QRCode from 'qrcode'
import { bindState } from './bind'

export const BIND_PREFIX = '/plugins/dsh-qq-superagent'
export const BIND_PATH = `${BIND_PREFIX}/bind`

interface RouteHost {
  register(route: { kind: 'prefix'; path: string; handler: (req: unknown, res: unknown) => void | Promise<void> }): () => void
}
interface Req { url?: string }
interface Res { writeHead(status: number, headers?: Record<string, string>): void; end(body?: string): void }

/** Registers `GET /plugins/dsh-qq-superagent/bind`, returning the current bind phase, URL, and QR SVG. */
export function registerBindRoutes(webServer: RouteHost): () => void {
  return webServer.register({
    kind: 'prefix',
    path: BIND_PREFIX,
    handler: async (rawReq, rawRes) => {
      const req = rawReq as Req
      const res = rawRes as Res
      const path = new URL(req.url ?? '/', 'http://localhost').pathname
      if (path !== BIND_PATH) { res.writeHead(404); res.end(); return }
      let qrSvg = ''
      if (bindState.url) {
        try { qrSvg = await QRCode.toString(bindState.url, { type: 'svg', margin: 1, width: 240 }) }
        catch { /* the panel falls back to the link */ }
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({
        phase: bindState.phase,
        url: bindState.url,
        qrSvg,
        appId: bindState.appId ?? '',
        openid: bindState.userOpenid ?? '',
        error: bindState.error ?? '',
      }))
    },
  })
}
