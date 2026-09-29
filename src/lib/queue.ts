import type { Item } from './deck'
import type { AppState } from './state'
import { dayTotal } from './state'
import { dayKey, dayNumber, isDue } from './scheduler'

export type PosGroup = 'all' | 'verbs' | 'adjs' | 'nouns' | 'others'
export interface Filter {
  deck: string // 'all' ou id de deck
  pos: PosGroup
}
export const ALL: Filter = { deck: 'all', pos: 'all' }

export const POS_GROUPS: Array<{ id: PosGroup; label: string }> = [
  { id: 'all', label: 'Tout' },
  { id: 'verbs', label: 'Verbes' },
  { id: 'adjs', label: 'Adjectifs' },
  { id: 'nouns', label: 'Noms' },
  { id: 'others', label: 'Autres' }
]

export function posGroup(pos: string): PosGroup {
  if (pos === 'v') return 'verbs'
  if (pos === 'i' || pos === 'na' || pos === 'adj') return 'adjs'
  if (pos === 'n') return 'nouns'
  return 'others'
}

export function passes(it: Item, f: Filter): boolean {
  if (f.deck !== 'all' && it.deck !== f.deck) return false
  if (f.pos !== 'all') {
    // les phrases ne sont pas concernées par le filtre grammatical
    if (it.kind === 'sentence') return false
    if (posGroup(it.pos) !== f.pos) return false
  }
  return true
}

export interface QueueBuild {
  learning: string[]
  review: string[]
  fresh: string[]
  freshProd: string[]
  newLeft: number
  prodLeft: number
}

/** Construit les files du jour. Les identifiants sont des « card ids » : `w12:r`, `w12:p`. */
export function buildQueue(state: AppState, items: Item[], f: Filter, now: number, extraNew = 0): QueueBuild {
  const today = dayNumber(now)
  const dt = dayTotal(state, dayKey(today))
  const newLeft = Math.max(0, state.settings.newPerDay + extraNew - dt.nw)
  const prodLeft = state.settings.production ? Math.max(0, state.settings.prodPerDay + Math.floor(extraNew / 2) - dt.np) : 0

  const learning: Array<[number, string]> = []
  const review: Array<[number, string]> = []
  const fresh: string[] = []
  const freshProd: string[] = []

  const list = items.filter((it) => passes(it, f)).sort((a, b) => a.order - b.order)
  for (const it of list) {
    const r = state.cards[`${it.id}:r`]
    const p = state.cards[`${it.id}:p`]
    for (const [key, c] of [[`${it.id}:r`, r], [`${it.id}:p`, p]] as const) {
      if (!c || c.s === 'new') continue
      if (!isDue(c, now, today)) continue
      if (c.s === 'review') review.push([c.d, key])
      else if (c.d <= now + 20 * 60_000) learning.push([c.d, key])
    }
    if (!r || r.s === 'new') {
      if (fresh.length < newLeft) fresh.push(`${it.id}:r`)
    } else if (it.kind !== 'sentence' && state.settings.production && (!p || p.s === 'new')) {
      // la production se débloque quand la reconnaissance est solide (≥ 3 jours)
      if (r.s === 'review' && r.i >= 3 && freshProd.length < prodLeft) freshProd.push(`${it.id}:p`)
    }
  }
  // Apprentissage : ce qui est dû d'abord ; révisions : les plus en retard d'abord
  learning.sort((a, b) => a[0] - b[0])
  review.sort((a, b) => a[0] - b[0])
  return {
    learning: learning.map((x) => x[1]),
    review: review.map((x) => x[1]),
    fresh,
    freshProd,
    newLeft,
    prodLeft
  }
}

/** Mélange : révisions d'abord, nouvelles cartes glissées régulièrement. */
export function interleave(q: QueueBuild): string[] {
  const out: string[] = [...q.learning]
  const news = [...q.fresh, ...q.freshProd]
  const rev = [...q.review]
  if (!rev.length) return [...out, ...news]
  const every = Math.max(2, Math.floor(rev.length / (news.length + 1)) + 1)
  let ni = 0
  rev.forEach((id, i) => {
    out.push(id)
    if ((i + 1) % every === 0 && ni < news.length) out.push(news[ni++])
  })
  while (ni < news.length) out.push(news[ni++])
  return out
}

export function countDue(state: AppState, items: Item[], f: Filter, now: number, extraNew = 0) {
  const q = buildQueue(state, items, f, now, extraNew)
  return {
    learning: q.learning.length,
    review: q.review.length,
    fresh: q.fresh.length + q.freshProd.length,
    total: q.learning.length + q.review.length + q.fresh.length + q.freshProd.length
  }
}
