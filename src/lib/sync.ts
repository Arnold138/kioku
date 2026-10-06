// Synchronisation cloud via Supabase (gratuit) : un compte e-mail + mot de passe,
// une seule ligne JSON par utilisateur. L'app reste 100 % utilisable hors ligne.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useStore } from './store'
import { mergeStates, sanitize, type AppState } from './state'
import { seenCards, weekId } from './snapshots'

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
    void pushWeeklySnapshot(sb, user.id, merged)
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


// ───────── Historique cloud (optionnel) ─────────
// Une copie par semaine dans la table `kioku_snapshots` (voir supabase/snapshots.sql). Si la table n'existe pas encore,
// tout est ignoré en silence : l'app et la synchro normale ne sont pas affectées.
const LS_REMOTE_WEEK = 'kioku:snap-remote-week'
const KEEP_REMOTE = 8

export interface RemoteSnap {
  taken_on: string
  cards: number
}

export async function pushWeeklySnapshot(sb: SupabaseClient, userId: string, state: AppState): Promise<void> {
  try {
    if (seenCards(state) === 0) return
    const wk = weekId(Date.now())
    if (localStorage.getItem(LS_REMOTE_WEEK) === wk) return
    const { error } = await sb.from('kioku_snapshots').upsert({ user_id: userId, taken_on: wk, data: state }, { onConflict: 'user_id,taken_on' })
    if (error) return // table absente ou refus : on n'insiste pas
    localStorage.setItem(LS_REMOTE_WEEK, wk)
    const { data } = await sb.from('kioku_snapshots').select('taken_on').eq('user_id', userId).order('taken_on', { ascending: false })
    const old = (data ?? []).slice(KEEP_REMOTE).map((r) => r.taken_on as string)
    if (old.length) await sb.from('kioku_snapshots').delete().eq('user_id', userId).in('taken_on', old)
  } catch {
    /* ignoré */
  }
}

export async function listRemoteSnapshots(): Promise<RemoteSnap[] | null> {
  const sb = getClient()
  if (!sb) return null
  try {
    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) return null
    const { data, error } = await sb.from('kioku_snapshots').select('taken_on, data').order('taken_on', { ascending: false })
    if (error || !data) return null
    return data.map((r) => ({ taken_on: r.taken_on as string, cards: seenCards(sanitize(r.data)) }))
  } catch {
    return null
  }
}

export async function fetchRemoteSnapshot(takenOn: string): Promise<string | null> {
  const sb = getClient()
  if (!sb) return null
  try {
    const { data, error } = await sb.from('kioku_snapshots').select('data').eq('taken_on', takenOn).maybeSingle()
    if (error || !data) return null
    return JSON.stringify(data.data)
  } catch {
    return null
  }
}
