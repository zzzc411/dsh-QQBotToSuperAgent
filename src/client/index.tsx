/** Browser entry: a left-sidebar QQ entry, its main panel (QR bind + config), and a settings section. */
import { createElement, useCallback, useEffect, useRef, useState } from 'react'

const PANEL_ID = 'dsh-qq-superagent'
const BIND_URL = '/plugins/dsh-qq-superagent/bind'
const API = '/orchestrator/api'

/** QQ robot logo, the same vector the official plugin uses. */
const QQ_LOGO = 'M19.3862 15.5001C19.3861 11.4203 16.0789 8.11296 11.999 8.11292C7.91915 8.11292 4.61203 11.4203 4.61182 15.5001V17.0001C4.61182 18.5949 5.90429 19.8873 7.49902 19.8873H16.499C18.0937 19.8873 19.3862 18.5949 19.3862 17.0001V15.5001ZM10.6118 14.0001C10.6118 14.6145 10.1129 15.1134 9.49853 15.1134C8.8843 15.1132 8.38672 14.6144 8.38672 14.0001V12.0006C8.38672 11.3863 8.8843 10.8875 9.49853 10.8873C10.1129 10.8873 10.6118 11.3862 10.6118 12.0006V14.0001ZM15.6113 14.0001C15.6113 14.6143 15.1136 15.1131 14.4995 15.1134C13.8851 15.1134 13.3862 14.6145 13.3862 14.0001V12.0006C13.3862 11.3862 13.8851 10.8873 14.4995 10.8873C15.1136 10.8876 15.6113 11.3864 15.6113 12.0006V14.0001ZM14.2607 3.04895C14.2607 3.89351 13.7957 4.62474 13.1108 5.0133V5.95374C17.8958 6.50514 21.6112 10.5676 21.6113 15.5001V17.0001C21.6113 19.8237 19.3225 22.1124 16.499 22.1124H7.49902C4.67546 22.1124 2.38672 19.8237 2.38672 17.0001V15.5001C2.38691 10.568 6.10139 6.50571 10.8857 5.95374V5.01185C10.2017 4.62305 9.73583 3.89286 9.73583 3.04895C9.73609 1.79961 10.7496 0.787231 11.999 0.787231C13.2484 0.787297 14.2605 1.79966 14.2607 3.04895Z'

interface BindState { phase: string; url: string; qrSvg: string; appId: string; appSecret: string; openid: string; error: string }
interface Allowed { id: string; name?: string }
interface QqConfig { appId: string; appSecret: string; groups: { groupOpenid: string; name?: string; listen: string }[]; directMessages: boolean; otherGroups: string }
interface SettingsView {
  blocks: { policy: { value: { rules: unknown[]; sources: Record<string, { allowed?: Allowed[]; admission?: unknown }> }; revision: number }, eval: { value: { mode: string }; revision: number } }
  sources: { id: string; value: { enabled: boolean; config: QqConfig }; revision: number }[]
}

function QqIcon({ size = 16 }: { size?: number }) {
  return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
    createElement('path', { d: QQ_LOGO, fill: 'currentColor' }))
}

const S = {
  page: { padding: '20px 24px 40px', maxWidth: '640px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: 'inherit' },
  title: { fontSize: '18px', fontWeight: 600, margin: '0 0 16px' },
  card: { border: '1px solid rgba(127,127,127,.25)', borderRadius: '12px', padding: '18px', marginBottom: '16px' },
  center: { textAlign: 'center' as const },
  hint: { fontSize: '13px', opacity: .7, margin: '8px 0' },
  link: { fontSize: '12px', wordBreak: 'break-all' as const, display: 'block', margin: '8px 0' },
  ok: { color: '#1a7f37', fontWeight: 600 },
  err: { color: '#cf222e' },
  row: { display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0' },
  label: { fontSize: '13px', minWidth: '110px', opacity: .8 },
  input: { flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', fontSize: '13px' },
  textarea: { width: '100%', minHeight: '64px', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', fontSize: '13px', fontFamily: 'ui-monospace, monospace' },
  button: { padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(127,127,127,.4)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '13px' },
  notice: { fontSize: '12px', marginTop: '8px' },
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    ...init,
    headers: { 'x-orchestrator-request': '1', 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(await response.text())
  return await response.json() as T
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

/** QQ config and its policy allow-list, as loaded from dsh-superagent's settings. */
function useConfig() {
  const [view, setView] = useState<SettingsView | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try { setView(await api<SettingsView>('settings')) }
    catch (failure) { setError(String(failure)) }
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { view, error, reload }
}

function BindCard({ bind, onApplied }: { bind: BindState | null; onApplied: () => void }) {
  if (!bind) return createElement('div', { style: S.card }, createElement('p', { style: S.hint }, '正在读取绑定状态…'))
  if (bind.phase === 'success') {
    return createElement('div', { style: { ...S.card, ...S.center } },
      createElement('p', { style: S.ok }, '✅ 已绑定'),
      createElement('p', { style: S.hint }, `AppID ${bind.appId}`),
      bind.openid ? createElement('p', { style: S.hint }, `openid ${bind.openid}`) : null,
      createElement('p', { style: S.hint }, '凭据已自动写入 QQ Source，可以在下面继续调整。'))
  }
  if (bind.phase === 'failed') {
    return createElement('div', { style: { ...S.card, ...S.center } },
      createElement('p', { style: S.err }, '❌ 绑定失败'),
      createElement('p', { style: S.hint }, bind.error || '请稍后重试'))
  }
  return createElement('div', { style: { ...S.card, ...S.center } },
    bind.qrSvg
      ? createElement('div', { dangerouslySetInnerHTML: { __html: bind.qrSvg }, style: { display: 'flex', justifyContent: 'center', margin: '8px 0' } })
      : createElement('p', { style: S.hint }, '正在生成二维码…'),
    createElement('p', { style: S.hint }, '用手机 QQ 扫码并确认授权。二维码过期会自动刷新，本页无需手动刷新。'),
    bind.url ? createElement('a', { style: S.link, href: bind.url, target: '_blank', rel: 'noreferrer' }, bind.url) : null)
}

function ConfigCard({ view, reload }: { view: SettingsView | null; reload: () => void }) {
  const source = view?.sources.find(item => item.id === 'qq')
  const allowed = view?.blocks.policy.value.sources.qq?.allowed ?? []
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [directMessages, setDirectMessages] = useState(true)
  const [otherGroups, setOtherGroups] = useState('none')
  const [allowText, setAllowText] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = Boolean(source) && view !== null

  useEffect(() => {
    if (!source || !view) return
    setAppId(source.value.config.appId ?? '')
    setAppSecret(source.value.config.appSecret ?? '')
    setDirectMessages(source.value.config.directMessages !== false)
    setOtherGroups(source.value.config.otherGroups ?? 'none')
    setAllowText((view.blocks.policy.value.sources.qq?.allowed ?? []).map(item => item.id).join('\n'))
  }, [source?.revision, view?.blocks.policy.revision])

  const save = async () => {
    if (!source || !view) return
    setBusy(true); setNotice('')
    try {
      const config = { ...source.value.config, appId: appId.trim(), appSecret: appSecret.trim(), directMessages, otherGroups }
      await api('settings/source:qq', { method: 'PUT', body: JSON.stringify({ value: { enabled: true, config }, revision: source.revision }) })
      const policy = view.blocks.policy.value
      const list = allowText.split(/[\s,;]+/).map(text => text.trim()).filter(Boolean)
      const next = { ...policy, sources: { ...policy.sources, qq: { ...(policy.sources.qq ?? {}), admission: policy.sources.qq?.admission ?? {}, allowed: list.map(id => ({ id })) } } }
      await api('settings/policy', { method: 'PUT', body: JSON.stringify({ value: next, revision: view.blocks.policy.revision }) })
      setNotice('已保存')
      reload()
    } catch (failure) {
      setNotice(`保存失败：${String(failure)}`)
    } finally { setBusy(false) }
  }

  if (!ready) return createElement('div', { style: S.card }, createElement('p', { style: S.hint }, '正在读取 QQ 配置…'))
  return createElement('div', { style: S.card },
    createElement('h3', { style: { fontSize: '15px', margin: '0 0 12px' } }, 'QQ 机器人配置'),
    createElement('div', { style: S.row },
      createElement('span', { style: S.label }, 'AppID'),
      createElement('input', { style: S.input, value: appId, onChange: (event: { target: { value: string } }) => setAppId(event.target.value), spellCheck: false })),
    createElement('div', { style: S.row },
      createElement('span', { style: S.label }, 'AppSecret'),
      createElement('input', { style: S.input, type: 'password', value: appSecret, onChange: (event: { target: { value: string } }) => setAppSecret(event.target.value), spellCheck: false })),
    createElement('div', { style: S.row },
      createElement('span', { style: S.label }, '接收私聊'),
      createElement('input', { type: 'checkbox', checked: directMessages, onChange: (event: { target: { checked: boolean } }) => setDirectMessages(event.target.checked) })),
    createElement('div', { style: S.row },
      createElement('span', { style: S.label }, '其他群'),
      createElement('select', { style: S.input, value: otherGroups, onChange: (event: { target: { value: string } }) => setOtherGroups(event.target.value) },
        createElement('option', { value: 'none' }, '不接收'),
        createElement('option', { value: 'mentions' }, '仅 @'))),
    createElement('p', { style: S.hint }, `接收的群：${source!.value.config.groups.length || '未配置（群聊需到「设置 → 源 → QQ」添加 groupOpenid）'}`),
    createElement('div', null,
      createElement('p', { style: { ...S.hint, marginBottom: '4px' } }, '允许发起工作的 QQ openid（每行一个）'),
      createElement('textarea', { style: S.textarea, value: allowText, onChange: (event: { target: { value: string } }) => setAllowText(event.target.value), spellCheck: false })),
    createElement('div', { style: { ...S.row, marginTop: '12px' } },
      createElement('button', { style: S.button, type: 'button', disabled: busy, onClick: () => { void save() } }, busy ? '保存中…' : '保存'),
      allowed.length ? createElement('span', { style: S.hint }, `当前白名单 ${allowed.length} 人`) : createElement('span', { style: { ...S.hint, color: '#cf222e' } }, '白名单为空：消息会被判为 not_a_member 丢弃')),
    notice ? createElement('p', { style: { ...S.notice, ...(notice.startsWith('已保存') ? { color: '#1a7f37' } : S.err) } }, notice) : null)
}

/** After a successful scan, write the credentials and openid into dsh-superagent automatically. */
function useAutoApply(bind: BindState | null, reload: () => void) {
  const applied = useRef(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    // Only a real scan carries the secret; a config-bound bot has none, so skip it.
    if (bind?.phase !== 'success' || !bind.appSecret || applied.current) return
    applied.current = true
    void (async () => {
      try {
        const view = await api<SettingsView>('settings')
        const source = view.sources.find(item => item.id === 'qq')
        if (!source) { setNotice('未找到 QQ Source'); return }
        const config = { ...source.value.config, appId: bind.appId, appSecret: bind.appSecret }
        await api('settings/source:qq', { method: 'PUT', body: JSON.stringify({ value: { enabled: true, config }, revision: source.revision }) })
        if (bind.openid) {
          const policy = view.blocks.policy.value
          const list = policy.sources.qq?.allowed ?? []
          if (!list.some(item => item.id === bind.openid)) {
            const next = { ...policy, sources: { ...policy.sources, qq: { ...(policy.sources.qq ?? {}), admission: policy.sources.qq?.admission ?? {}, allowed: [...list, { id: bind.openid }] } } }
            await api('settings/policy', { method: 'PUT', body: JSON.stringify({ value: next, revision: view.blocks.policy.revision }) })
          }
        }
        setNotice('已自动把凭据和 openid 写入 QQ Source')
        reload()
      } catch (failure) { setNotice(`自动写入失败：${String(failure)}`) }
    })()
  }, [bind?.phase, reload])
  return notice
}

function QqPanel(): unknown {
  const bind = useBind()
  const { view, reload } = useConfig()
  const notice = useAutoApply(bind, reload)
  return createElement('div', { style: S.page },
    createElement('h2', { style: S.title }, 'QQ 机器人'),
    createElement(BindCard, { bind, onApplied: reload }),
    notice ? createElement('p', { style: { ...S.notice, color: '#1a7f37' } }, notice) : null,
    createElement(ConfigCard, { view, reload }))
}

export const name = 'dsh-qq-superagent-client'
export const inject = ['slots']

/** Registers the left-sidebar entry, its main panel, and a settings section — mirroring the official QQ bot plugin. */
export function apply(ctx: any): void {
  const slots = ctx.slots
  if (slots === undefined) return
  ctx.effect(() => slots.inject('main', () => slots.register({ name: 'main', key: PANEL_ID, inject: () => ({}) }, QqPanel)), 'dsh-qq-superagent: main panel')
  ctx.effect(() => slots.inject('sidebar.panellist', () => slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 12, label: 'QQ 机器人' }, QqIcon)), 'dsh-qq-superagent: sidebar entry')
  ctx.effect(() => slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'qqbot', order: 8, label: 'QQ 机器人' }, QqPanel)), 'dsh-qq-superagent: settings section')
}
