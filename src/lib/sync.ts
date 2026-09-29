// Synchronisation cloud via Supabase (gratuit) : un compte e-mail + mot de passe,
// une seule ligne JSON par utilisateur. L'app reste 100 % utilisable hors ligne.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useStore } from './store'
import { mergeStates, sanitize } from './state'

const LS_CFG = 'kioku:supabase'
let client: SupabaseClient | null = null
let started = false
let pushTimer: ReturnType<typeof setTimeout> | undefined
let syncing = false

export interface SbConfig {
  url: string
  key: string
}

function readCfg(): SbConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (envUrl && envKey) return { url: envUrl, key: envKey }
  try {
    const raw = localStorage.getItem(LS_CFG)
    if (raw) {
      const c = JSON.parse(raw) as SbConfig
      if (c.url && c.key) return c
    }
  } catch {
    /* ignore */
  }
  return null
}

export const hasEnvConfig = () => Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
export const getStoredConfig = (): SbConfig | null => readCfg()

export function saveConfig(cfg: SbConfig) {
  try {
    localStorage.setItem(LS_CFG, JSON.stringify(cfg))
  } catch {
    /* ignore */
  }
  client = null
}

function getClient(): SupabaseClient | null {
  if (client) return client
  const cfg = readCfg()
  if (!cfg) return null
  client = createClient(cfg.url.trim(), cfg.key.trim(), { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

const setSync = (s: Parameters<ReturnType<typeof useStore.getState>['setSync']>[0]) => useStore.getState().setSync(s)

export async function syncNow(): Promise<void> {
  const sb = getClient()
  if (!sb || syncing) return
  const { data: sess } = await sb.auth.getSession()
  const user = sess.session?.user
  if (!user) {
    setSync({ status: 'off' })
    return
  }
  syncing = true
  setSync({ status: 'syncing', email: user.email ?? undefined })
  try {
    const { data, error } = await sb.from('kioku_state').select('data').eq('user_id', user.id).maybeSingle()
    if (error) throw error
    if (data?.data) useStore.getState().applyRemote(sanitize(data.data))
    const merged = useStore.getState().state
    const { error: upErr } = await sb
      .from('kioku_state')
      .upsert({ user_id: user.id, data: merged, updated_at: new Date().toISOString() })
    if (upErr) throw upErr
    setSync({ status: 'ok', email: user.email ?? undefined, last: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    setSync({ status: 'error', email: user.email ?? undefined, message: msg })
  } finally {
    syncing = false
  }
}

function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void syncNow(), 4000)
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const sb = getClient()
  if (!sb) return 'Configuration Supabase manquante.'
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) return error.message
  await syncNow()
  return null
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const sb = getClient()
  if (!sb) return 'Configuration Supabase manquante.'
  const { data, error } = await sb.auth.signUp({ email, password })
  if (error) return error.message
  if (!data.session) return 'Compte créé. Confirme ton e-mail (ou désactive la confirmation dans Supabase), puis connecte-toi.'
  await syncNow()
  return null
}

export async function signOut() {
  const sb = getClient()
  if (sb) await sb.auth.signOut()
  setSync({ status: 'off' })
}

/** Démarre la synchronisation automatique (appelé une fois au lancement). */
export async function startSync() {
  if (started) return
  started = true
  const sb = getClient()
  if (!sb) {
    setSync({ status: 'off' })
    return
  }
  const { data } = await sb.auth.getSession()
  if (data.session) await syncNow()
  // pousse les changements locaux (avec anti-rebond)
  useStore.subscribe((s, prev) => {
    if (s.state !== prev.state && s.sync.status !== 'off') schedulePush()
  })
  // récupère les changements de l'autre appareil au retour dans l'app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && useStore.getState().sync.status !== 'off') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
}

export async function reconnect() {
  started = false
  client = null
  await startSync()
}

export { mergeStates }
