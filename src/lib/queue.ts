import { isOptIn, type Item } from './deck'
import type { AppState } from './state'
import { dayTotal } from './state'
import { dayKey, dayNumber, isDue, type CardState } from './scheduler'
import { inTheme } from './themes'
import { naturalSentences } from './natural'

export type PosGroup = 'all' | 'verbs' | 'adjs' | 'nouns' | 'others'
/** normal = révisions dues + nouvelles (planning habituel) · new = nouvelles seulement · practice = entraînement libre sans toucher au planning */
export type Scope = 'normal' | 'new' | 'practice'
export interface Filter {
  deck: string // 'all' ou id de deck
  pos: PosGroup
  theme?: string // id de thème (mots uniquement)
  scope?: Scope // défaut : normal
  free?: boolean // séance libre : ignore la limite quotidienne de nouvelles cartes
  limit?: number // nombre max de cartes (séance libre)
  moreReviews?: number // révisions supplémentaires au-delà du quota du jour (« Encore 10 révisions »)
  cap?: number // nombre max de cartes pour toute la séance (séance de 2 minutes)
  ids?: string[] // ne garder que ces éléments (ex. mots difficiles)
  keys?: string[] // séance d'entraînement sur ces cartes précises (id de carte), dans cet ordre (ex. points faibles)
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
  if (f.ids && !f.ids.includes(it.id)) return false
  if (f.deck !== 'all' && it.deck !== f.deck) return false
  if (f.theme) {
    if (it.kind !== 'word' || !inTheme(it.id, f.theme)) return false
  }
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
  /** phrases naturelles des vidéos du jour (hors quota de mots) */
  freshNat: string[]
  newLeft: number
  prodLeft: number
  /** Révisions dues mais reportées à un autre jour à cause du quota quotidien. */
  deferred: number
}

/** Construit les files du jour. Les identifiants sont des « card ids » : `w12:r`, `w12:p`. */
export function buildQueue(state: AppState, items: Item[], f: Filter, now: number, extraNew = 0): QueueBuild {
  const today = dayNumber(now)
  const dt = dayTotal(state, dayKey(today))
  const scope = f.scope ?? 'normal'
  const cap = f.limit != null ? f.limit + extraNew : 1_000_000
  // séance libre : on choisit soi-même combien de nouvelles cartes ; sinon limites du jour
  const newLeft = f.free ? cap : Math.max(0, state.settings.newPerDay + extraNew - dt.nw)
  const prodLeft = !state.settings.production ? 0 : f.free ? cap : Math.max(0, state.settings.prodPerDay + Math.floor(extraNew / 2) - dt.np)

  const learning: Array<[number, string]> = []
  const review: Array<[number, string, CardState]> = []
  const fresh: string[] = []
  const freshProd: string[] = []

  const list = items.filter((it) => passes(it, f)).sort((a, b) => a.order - b.order)
  for (const it of list) {
    const r = state.cards[`${it.id}:r`]
    const p = state.cards[`${it.id}:p`]
    for (const [key, c] of [[`${it.id}:r`, r], [`${it.id}:p`, p]] as const) {
      if (scope === 'new') break
      if (!c || c.s === 'new') continue
      if (!isDue(c, now, today)) continue
      if (c.s === 'review') review.push([c.d, key, c])
      else if (c.d <= now + 20 * 60_000) learning.push([c.d, key])
    }
    if (!r || r.s === 'new') {
      // les decks « à la demande » (phrases des vidéos) n'alimentent pas les nouvelles cartes du jour
      if (fresh.length < newLeft && !(f.deck === 'all' && isOptIn(it.deck))) fresh.push(`${it.id}:r`)
    } else if (it.kind !== 'sentence' && state.settings.production && (!p || p.s === 'new')) {
      // la production se débloque quand la reconnaissance est solide (≥ 3 jours)
      if (r.s === 'review' && r.i >= 3 && freshProd.length < prodLeft) freshProd.push(`${it.id}:p`)
    }
  }
  // Apprentissage : ce qui est dû d'abord ; révisions : les plus en retard d'abord
  learning.sort((a, b) => a[0] - b[0])
  // Quota quotidien de révisions (0 = illimité). Ne concerne ni l'apprentissage en cours, ni les séances libres.
  // Priorité : les cartes les plus difficiles (plus d'oublis, facilité basse), puis les plus en retard.
  let kept = review
  const quota = state.settings.reviewsPerDay
  if (!f.free && scope !== 'practice' && quota > 0) {
    const left = Math.max(0, quota - (dt.rv ?? 0)) + (f.moreReviews ?? 0)
    if (review.length > left) {
      kept = [...review].sort((a, b) => b[2].l - a[2].l || a[2].e - b[2].e || a[0] - b[0]).slice(0, left)
    }
  }
  kept.sort((a, b) => a[0] - b[0])
  // Phrases naturelles (vidéos) : quelques-unes par jour, choisies parmi ce que tu sais déjà lire
  let freshNat: string[] = []
  const natLeft = Math.max(0, (state.settings.naturalPerDay ?? 0) - (dt.nv ?? 0))
  if (natLeft > 0 && !f.free && scope === 'normal' && f.deck === 'all' && f.pos === 'all' && !f.theme && !f.ids) {
    freshNat = naturalSentences(state, items, natLeft).map((it) => `${it.id}:r`)
  }
  return {
    learning: learning.map((x) => x[1]),
    review: kept.map((x) => x[1]),
    deferred: review.length - kept.length,
    fresh,
    freshProd,
    freshNat,
    newLeft,
    prodLeft
  }
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Entraînement libre : toutes les cartes déjà vues du filtre, dans le désordre. Les réponses ne modifient PAS le planning. */
export function buildPractice(state: AppState, items: Item[], f: Filter, extraNew = 0): string[] {
  if (f.keys) {
    // cartes choisies (points faibles, ratés de la séance) : dans l'ordre donné, seulement celles déjà commencées
    const ok = f.keys.filter((k) => state.cards[k] && state.cards[k].s !== 'new')
    return f.limit != null ? ok.slice(0, f.limit + extraNew) : ok
  }
  const out: string[] = []
  for (const it of items) {
    if (!passes(it, f)) continue
    const r = state.cards[`${it.id}:r`]
    const p = state.cards[`${it.id}:p`]
    const started = !!r && r.s !== 'new'
    if (started) out.push(`${it.id}:r`)
    if (it.kind !== 'sentence' && (started || (!!p && p.s !== 'new'))) out.push(`${it.id}:p`)
  }
  shuffle(out)
  return f.limit != null ? out.slice(0, f.limit + extraNew) : out
}

/** Phrases d'échauffement : d'abord les phrases à revoir, sinon de nouvelles phrases (les plus fréquentes). */
export function pickWarmup(state: AppState, items: Item[], n: number, now: number): string[] {
  if (n <= 0) return []
  const today = dayNumber(now)
  const sentences = items.filter((i) => i.kind === 'sentence').sort((a, b) => a.order - b.order)
  const due: Array<[number, string]> = []
  const fresh: string[] = []
  for (const it of sentences) {
    const key = `${it.id}:r`
    const c = state.cards[key]
    if (!c || c.s === 'new') {
      if (!isOptIn(it.deck)) fresh.push(key)
    }
    else if (isDue(c, now, today) && (c.s === 'review' || c.d <= now + 20 * 60_000)) due.push([c.d, key])
  }
  due.sort((a, b) => a[0] - b[0])
  return [...due.map((d) => d[1]), ...fresh].slice(0, n)
}

/** Mélange : révisions d'abord, nouvelles cartes glissées régulièrement. */
export function interleave(q: QueueBuild): string[] {
  const out: string[] = [...q.learning]
  const news = [...q.fresh, ...q.freshProd, ...q.freshNat]
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
    fresh: q.fresh.length + q.freshProd.length + q.freshNat.length,
    deferred: q.deferred,
    total: q.learning.length + q.review.length + q.fresh.length + q.freshProd.length + q.freshNat.length
  }
}
