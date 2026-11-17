// Stable local QR-bind page for the QQ Open Platform bot.
//
// Serves http://127.0.0.1:<port>/ with the CURRENT QR code (auto-refreshed when
// the task expires) and, on success, the obtained { appId, appSecret, userOpenid }.
//
// Usage: node scripts/qq-bind-server.mjs [port]
import { startQrConnect } from '@tencent-connect/qqbot-connector'
import QRCode from 'qrcode'
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'

const PORT = Number(process.argv[2] ?? process.env.QQ_BIND_PORT ?? 3099)
const RESULT = '/tmp/qq-bind-result.json'

let state = { phase: 'starting', url: '', svg: '', credentials: null, error: '' }

const dispose = startQrConnect({
  onQrDisplayed: async (url) => {
    let svg = ''
    try { svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 260 }) }
    catch (error) { console.error('QR render failed:', String(error)) }
    state = { ...state, phase: 'waiting', url, svg, error: '' }
    console.log(`QR_URL=${url}`)
  },
  onQrExpired: () => { state = { ...state, phase: 'refreshing' } },
  onSuccess: (credentials) => {
    state = { ...state, phase: 'success', credentials }
    writeFileSync(RESULT, JSON.stringify(credentials, null, 2))
    console.log(`SUCCESS=${JSON.stringify(credentials)}`)
  },
  onFailure: (error) => {
    state = { ...state, phase: 'failed', error: error.message }
    console.log(`FAIL=${error.message}`)
  },
}, { displayQrCodeToConsole: false, source: 'dsh-qq-superagent' })

const page = () => `<!doctype html><html lang="zh"><meta charset="utf-8">
<title>QQ 机器人扫码绑定</title>
<style>
 body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:32px auto;padding:0 16px;text-align:center;color:#111}
 h2{font-weight:600}
 #qr{min-height:260px;display:flex;align-items:center;justify-content:center}
 #qr svg{width:260px;height:260px}
 .muted{color:#666;font-size:13px}
 code{word-break:break-all;font-size:12px;color:#0a58ca}
 a{color:#0a58ca}
 pre{text-align:left;background:#f6f8fa;padding:12px;border-radius:8px;overflow:auto;font-size:12px}
 .ok{color:#1a7f37;font-weight:600}
 .err{color:#cf222e;font-weight:600}
</style>
<h2>QQ 机器人扫码绑定</h2>
<div id="qr">${state.svg || '<span class="muted">正在生成二维码…</span>'}</div>
<div id="status">${statusHtml()}</div>
<p class="muted" id="hint">用手机 QQ 扫码并在 QQ 里确认授权。二维码过期会自动刷新，本页无需手动刷新。</p>
<p class="muted">链接：<a id="link" href="${state.url}" target="_blank">${state.url || '（等待生成）'}</a></p>
<pre id="creds" style="display:none"></pre>
<script>
let lastUrl = ${JSON.stringify(state.url)};
async function poll() {
  try {
    const r = await fetch('/state'); const s = await r.json();
    if (s.phase === 'success') {
      document.getElementById('status').innerHTML = '<span class="ok">✅ 绑定成功</span>';
      document.getElementById('hint').style.display = 'none';
      const pre = document.getElementById('creds');
      pre.style.display = 'block';
      pre.textContent = JSON.stringify(s.credentials, null, 2);
      return;
    }
    if (s.phase === 'failed') {
      document.getElementById('status').innerHTML = '<span class="err">❌ 失败：' + (s.error || '') + '</span>';
      return;
    }
    document.getElementById('status').textContent = s.phase === 'refreshing' ? '二维码刷新中…' : '等待扫码…';
    if (s.url && s.url !== lastUrl) {
      lastUrl = s.url;
      document.getElementById('qr').innerHTML = s.svg || '';
      const a = document.getElementById('link'); a.href = s.url; a.textContent = s.url;
    }
  } catch (e) {}
  setTimeout(poll, 1500);
}
poll();
</script>
</html>`

function statusHtml() {
  if (state.phase === 'success') return '<span class="ok">✅ 绑定成功</span>'
  if (state.phase === 'failed') return `<span class="err">❌ 失败：${state.error}</span>`
  if (state.phase === 'refreshing') return '二维码刷新中…'
  return state.phase === 'waiting' ? '等待扫码…' : '正在生成二维码…'
}

createServer((req, res) => {
  if (req.url === '/state') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(state))
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  res.end(page())
}).listen(PORT, '127.0.0.1', () => {
  console.log(`QR_BIND_PAGE=http://127.0.0.1:${PORT}/`)
})

process.on('SIGINT', () => { dispose(); process.exit(130) })
process.on('SIGTERM', () => { dispose(); process.exit(143) })
