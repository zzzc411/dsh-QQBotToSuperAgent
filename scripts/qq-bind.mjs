// QR-code bind helper: obtain a QQ Open Platform bot's AppID/AppSecret and the
// scanning user's openid by scanning a QR code with the QQ app.
//
// Usage:
//   node scripts/qq-bind.mjs [result-file]
//
// Prints the QR URL on `onQrDisplayed` and writes it to `<result-file>.url`;
// on success writes `{ appId, appSecret, userOpenid }` to `<result-file>`.
import { startQrConnect } from '@tencent-connect/qqbot-connector'
import { writeFileSync } from 'node:fs'

const out = process.argv[2] ?? '/tmp/qq-bind-result.json'

const dispose = startQrConnect({
  onQrDisplayed(url) {
    console.log(`QR_URL=${url}`)
    writeFileSync(`${out}.url`, url)
  },
  onSuccess(credentials) {
    console.log(`SUCCESS=${JSON.stringify(credentials)}`)
    writeFileSync(out, JSON.stringify(credentials, null, 2))
    process.exit(0)
  },
  onFailure(error) {
    console.error(`FAIL=${error.message}`)
    writeFileSync(`${out}.fail`, error.message)
    process.exit(1)
  },
}, {
  displayQrCodeToConsole: false,
  source: 'dsh-qq-superagent',
})

process.on('SIGINT', () => { dispose(); process.exit(130) })
