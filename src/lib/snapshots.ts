// Points de restauration : des copies datées de ta progression, conservées sur l'appareil (IndexedDB)
// et, si la table Supabase existe, dans ton compte cloud (une par semaine).
// Elles ne remplacent jamais ta sauvegarde principale : ce sont des filets de sécurité en plus.
import type { AppState } from './state'
import { totalReviews } from './state'

export type SnapKind = 'auto' | 'manuel' | 'avant-restauration'

export interface SnapMeta {
  id: string
  kind: SnapKind
  t: number
  cards: number // cartes déjà vues
  reviews: number // révisions au total
}
export interface Snap extends SnapMeta {
  data: string // JSON de l'état
}

const DB = 'kioku-snapshots'
const STORE = 'snaps'
const KEEP_AUTO = 6
const KEEP_OTHER = 6

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const r = fn(t.objectStore(STORE))
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
        t.oncomplete = () => db.close()
      })
  )
}

const meta = ({ id, kind, t, cards, reviews }: Snap): SnapMeta => ({ id, kind, t, cards, reviews })

export const seenCards = (st: AppState) => Object.values(st.cards).filter((c) => c.s !== 'new').length

/** Lundi (UTC) de la semaine de `t`, au format AAAA-MM-JJ. */
export function weekId(t: number): string {
  const d = new Date(t)
  const dow = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10)
}

export async function listLocal(): Promise<SnapMeta[]> {
  try {
    const all = await tx<Snap[]>('readonly', (s) => s.getAll())
    return all.map(meta).sort((a, b) => b.t - a.t)
  } catch {
    return []
  }
}

export async function getLocal(id: string): Promise<Snap | null> {
  try {
    return (await tx<Snap | undefined>('readonly', (s) => s.get(id))) ?? null
  } catch {
    return null
  }
}

async function prune() {
  const all = await listLocal()
  const drop = (kind: SnapKind, keep: number) => all.filter((s) => s.kind === kind).slice(keep)
  const toDrop = [...drop('auto', KEEP_AUTO), ...drop('manuel', KEEP_OTHER), ...drop('avant-restauration', KEEP_OTHER)]
  for (const s of toDrop) await tx('readwrite', (st) => st.delete(s.id))
}

export async function saveLocal(state: AppState, kind: SnapKind, now = Date.now()): Promise<boolean> {
  try {
    const id = kind === 'auto' ? `auto-${weekId(now)}` : `${kind}-${now}`
    const snap: Snap = { id, kind, t: now, cards: seenCards(state), reviews: totalReviews(state), data: JSON.stringify(state) }
    await tx('readwrite', (s) => s.put(snap))
    await prune()
    return true
  } catch {
    return false
  }
}

/** Une copie automatique par semaine, seulement s'il y a quelque chose à sauvegarder. */
export async function autoSnapshot(state: AppState, now = Date.now()): Promise<void> {
  if (seenCards(state) === 0) return
  const existing = await getLocal(`auto-${weekId(now)}`)
  if (!existing) await saveLocal(state, 'auto', now)
}
