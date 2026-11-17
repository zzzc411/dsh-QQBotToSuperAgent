/** Browser entry: a left-sidebar QQ entry, its main panel, and a settings section showing the QR bind UI. */
import { createElement, useEffect, useState } from 'react'

const PANEL_ID = 'dsh-qq-superagent'
const BIND_URL = '/plugins/dsh-qq-superagent/bind'

/** QQ robot logo, the same vector the official plugin uses. */
const QQ_LOGO = 'M19.3862 15.5001C19.3861 11.4203 16.0789 8.11296 11.999 8.11292C7.91915 8.11292 4.61203 11.4203 4.61182 15.5001V17.0001C4.61182 18.5949 5.90429 19.8873 7.49902 19.8873H16.499C18.0937 19.8873 19.3862 18.5949 19.3862 17.0001V15.5001ZM10.6118 14.0001C10.6118 14.6145 10.1129 15.1134 9.49853 15.1134C8.8843 15.1132 8.38672 14.6144 8.38672 14.0001V12.0006C8.38672 11.3863 8.8843 10.8875 9.49853 10.8873C10.1129 10.8873 10.6118 11.3862 10.6118 12.0006V14.0001ZM15.6113 14.0001C15.6113 14.6143 15.1136 15.1131 14.4995 15.1134C13.8851 15.1134 13.3862 14.6145 13.3862 14.0001V12.0006C13.3862 11.3862 13.8851 10.8873 14.4995 10.8873C15.1136 10.8876 15.6113 11.3864 15.6113 12.0006V14.0001ZM14.2607 3.04895C14.2607 3.89351 13.7957 4.62474 13.1108 5.0133V5.95374C17.8958 6.50514 21.6112 10.5676 21.6113 15.5001V17.0001C21.6113 19.8237 19.3225 22.1124 16.499 22.1124H7.49902C4.67546 22.1124 2.38672 19.8237 2.38672 17.0001V15.5001C2.38691 10.568 6.10139 6.50571 10.8857 5.95374V5.01185C10.2017 4.62305 9.73583 3.89286 9.73583 3.04895C9.73609 1.79961 10.7496 0.787231 11.999 0.787231C13.2484 0.787297 14.2605 1.79966 14.2607 3.04895Z'

interface BindState { phase: string; url: string; qrSvg: string; appId: string; openid: string; error: string }

function QqIcon({ size = 16 }: { size?: number }) {
  return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
    createElement('path', { d: QQ_LOGO, fill: 'currentColor' }))
}

function useBind(): BindState | null {
  const [state, setState] = useState<BindState | null>(null)
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const response = await fetch(BIND_URL, { headers: { accept: 'application/json' } })
        if (response.ok && alive) setState(await response.json() as BindState)
      } catch { /* keep the last state */ }
      if (alive) timer = setTimeout(poll, 1500)
    }
    void poll()
    return () => { alive = false; clearTimeout(timer) }
  }, [])
  return state
}

const styles: Record<string, Record<string, string | number>> = {
  page: { padding: '24px', maxWidth: '560px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  title: { fontSize: '18px', fontWeight: 600, margin: '0 0 16px' },
  card: { border: '1px solid rgba(127,127,127,.25)', borderRadius: '12px', padding: '20px', textAlign: 'center' },
  qr: { display: 'flex', justifyContent: 'center', margin: '12px 0' },
  hint: { fontSize: '13px', opacity: .7, margin: '8px 0' },
  link: { fontSize: '12px', wordBreak: 'break-all', display: 'block', margin: '8px 0' },
  ok: { color: '#1a7f37', fontWeight: 600 },
  err: { color: '#cf222e', fontWeight: 600 },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: '12px', wordBreak: 'break-all', background: 'rgba(127,127,127,.12)', padding: '8px', borderRadius: '8px' },
}

function BindPanel(): unknown {
  const state = useBind()
  if (!state) return createElement('div', { style: styles.page }, createElement('p', { style: styles.hint }, '正在读取绑定状态…'))
  const head = createElement('h2', { style: styles.title }, 'QQ 机器人')
  if (state.phase === 'success') {
    return createElement('div', { style: styles.page }, head,
      createElement('div', { style: styles.card },
        createElement('p', { style: styles.ok }, '✅ 已绑定'),
        createElement('p', { style: styles.hint }, `AppID ${state.appId}`),
        state.openid ? createElement('p', { style: styles.hint }, `openid ${state.openid}`) : null,
        state.openid ? createElement('p', { style: styles.hint }, '把这个 openid 加入「设置 → 源 → QQ 的策略白名单」，然后就能在 QQ 里下任务了。') : null))
  }
  if (state.phase === 'failed') {
    return createElement('div', { style: styles.page }, head,
      createElement('div', { style: styles.card },
        createElement('p', { style: styles.err }, '❌ 绑定失败'),
        createElement('p', { style: styles.hint }, state.error || '请稍后重试')))
  }
  // waiting / idle / refreshing: show the current QR and the fallback link.
  return createElement('div', { style: styles.page }, head,
    createElement('div', { style: styles.card },
      state.qrSvg
        ? createElement('div', { style: styles.qr, dangerouslySetInnerHTML: { __html: state.qrSvg } })
        : createElement('p', { style: styles.hint }, '正在生成二维码…'),
      createElement('p', { style: styles.hint }, '用手机 QQ 扫码并确认授权。二维码过期会自动刷新，本页无需手动刷新。'),
      state.url ? createElement('a', { style: styles.link, href: state.url, target: '_blank', rel: 'noreferrer' }, state.url) : null,
      createElement('p', { style: { ...styles.hint, marginTop: '16px' } }, '扫码成功后凭据会自动保存；也可以在上面的链接里打开二维码页面。')))
}

export const name = 'dsh-qq-superagent-client'
export const inject = ['slots']

/** Registers the left-sidebar entry, its main panel, and a settings section — mirroring the official QQ bot plugin. */
export function apply(ctx: any): void {
  const slots = ctx.slots
  if (slots === undefined) return
  ctx.effect(() => slots.inject('main', () => slots.register({ name: 'main', key: PANEL_ID, inject: () => ({}) }, BindPanel)), 'dsh-qq-superagent: main panel')
  ctx.effect(() => slots.inject('sidebar.panellist', () => slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 12, label: 'QQ 机器人' }, QqIcon)), 'dsh-qq-superagent: sidebar entry')
  ctx.effect(() => slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'qqbot', order: 8, label: 'QQ 机器人' }, BindPanel)), 'dsh-qq-superagent: settings section')
}
