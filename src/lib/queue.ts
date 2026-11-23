import { isOptIn, type Item } from './deck'
import type { AppState } from './state'
import { dayTotal } from './state'
import { dayKey, dayNumber, isDue, type CardState } from './scheduler'
import { inTheme } from './themes'
import { naturalSentences } from './natural'
import { clozeFor } from './cloze'
import { formsFor } from './conjugate'

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
  /** nouvelles cartes à trous (v1.13, quota à part) */
  freshCloze: string[]
  /** nouvelles cartes de forme (v1.14, quota à part) */
  freshForm?: string[]
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
  const freshCloze: string[] = []
  // v1.13 : cartes à trous, avec leur propre quota (0 = désactivées)
  const clozeOn = (state.settings.clozePerDay ?? 0) > 0
  const clozeLeft = !clozeOn ? 0 : f.free ? cap : Math.max(0, (state.settings.clozePerDay ?? 0) - (dt.nc ?? 0))
  // v1.14 : cartes de forme (verbes, adjectifs), avec leur propre quota (0 = désactivées)
  const freshForm: string[] = []
  const formOn = (state.settings.formsPerDay ?? 0) > 0
  const formLeft = !formOn ? 0 : f.free ? cap : Math.max(0, (state.settings.formsPerDay ?? 0) - (dt.nf ?? 0))

  const list = items.filter((it) => passes(it, f)).sort((a, b) => a.order - b.order)
  // v1.18 : un seul exercice par mot / phrase et par jour (comme les « cartes sœurs » d'Anki).
  // Une carte ratée revient une seule fois (apprentissage) ; le reste du mot attend un autre jour.
  // (une révision encore due n'a pas été faite aujourd'hui, même si sa date de modification l'est)
  const touched = (c?: CardState) => !!c && c.s !== 'new' && dayNumber(c.t) === today && !(c.s === 'review' && isDue(c, now, today))
  const freshWords: Item[] = []
  const freshSentences: Item[] = []
  for (const it of list) {
    const r = state.cards[`${it.id}:r`]
    const p = state.cards[`${it.id}:p`]
    const cz = it.kind === 'word' ? state.cards[`${it.id}:c`] : undefined
    const fm = it.kind === 'word' ? state.cards[`${it.id}:f`] : undefined
    const all = [[`${it.id}:r`, r], [`${it.id}:p`, p], [`${it.id}:c`, cz], [`${it.id}:f`, fm]] as const
    const seenToday = all.some(([, c]) => touched(c))
    if (scope !== 'new') {
      const lrn = all.filter(([, c]) => c && c.s !== 'new' && c.s !== 'review' && isDue(c, now, today) && c.d <= now + 20 * 60_000)
      if (lrn.length) {
        learning.push([lrn[0][1]!.d, lrn[0][0]])
        continue
      }
      if (seenToday) continue
      const due = all.filter(([, c]) => c && c.s === 'review' && isDue(c, now, today)) as Array<readonly [string, CardState]>
      if (due.length) {
        // la carte du mot la plus à risque d'être oubliée (la plus en retard par rapport à son intervalle)
        const [key, c] = due.reduce((a, b) => (overdue(b[1], today) > overdue(a[1], today) ? b : a))
        review.push([c.d, key, c])
        continue
      }
    } else if (seenToday) continue
    if (!r || r.s === 'new') {
      // les decks « à la demande » (phrases des vidéos) n'alimentent pas les nouvelles cartes du jour
      if (!(f.deck === 'all' && isOptIn(it.deck))) (it.kind === 'sentence' ? freshSentences : freshWords).push(it)
      continue
    }
    if (it.kind !== 'sentence' && state.settings.production && (!p || p.s === 'new') && r.s === 'review' && r.i >= 3 && freshProd.length < prodLeft) {
      // la production se débloque quand la reconnaissance est solide (≥ 3 jours)
      freshProd.push(`${it.id}:p`)
      continue
    }
    // v1.13 : la carte à trous se débloque quand le mot est retenu et qu'une phrase le contient
    if (clozeOn && scope !== 'new' && it.kind === 'word' && (!cz || cz.s === 'new') && r.s === 'review' && r.i >= 3 && freshCloze.length < clozeLeft && clozeFor(it, items, today)) {
      freshCloze.push(`${it.id}:c`)
      continue
    }
    // v1.14 : la carte de forme se débloque quand le verbe / l'adjectif est retenu
    if (formOn && scope !== 'new' && it.kind === 'word' && (!fm || fm.s === 'new') && r.s === 'review' && r.i >= 3 && freshForm.length < formLeft && formsFor(it).length) {
      freshForm.push(`${it.id}:f`)
    }
  }
  // v1.18 : nouvelles cartes : un mot, une phrase, un mot… ; les phrases tournent entre les thèmes
  fresh.push(...mixFresh(freshWords, rotateThemes(freshSentences), newLeft).map((it) => `${it.id}:r`))
  // Apprentissage : ce qui est dû d'abord
  learning.sort((a, b) => a[0] - b[0])
  // Quota quotidien de révisions (0 = illimité). Ne concerne ni l'apprentissage en cours, ni les séances libres.
  // v1.18 : priorité aux cartes les plus à risque d'être oubliées (souvent des mots appris il y a longtemps).
  let kept = review
  const quota = state.settings.reviewsPerDay
  if (!f.free && scope !== 'practice' && quota > 0) {
    const left = Math.max(0, quota - (dt.rv ?? 0)) + (f.moreReviews ?? 0)
    if (review.length > left) {
      kept = [...review].sort((a, b) => overdue(b[2], today) - overdue(a[2], today) || a[0] - b[0]).slice(0, left)
    }
  }
  // v1.18 : une phrase ne sert qu'une fois par jour (carte de phrase ou carte à trous qui l'utilise)
  const byIdLocal = new Map(list.map((it) => [it.id, it]))
  const usedSentences = new Set<string>()
  for (const k of [...learning.map((x) => x[1]), ...kept.map((x) => x[1]), ...fresh]) {
    const it = byIdLocal.get(k.slice(0, k.lastIndexOf(':')))
    if (it?.kind === 'sentence') usedSentences.add(it.id)
  }
  const clozeFree = (key: string): boolean => {
    if (!key.endsWith(':c')) return true
    const w = byIdLocal.get(key.slice(0, -2))
    const cz = w && clozeFor(w, items, today)
    if (!cz || usedSentences.has(cz.sentence.id)) return false
    usedSentences.add(cz.sentence.id)
    return true
  }
  const learningKeys = learning.map((x) => x[1]).filter(clozeFree)
  kept = kept.filter((x) => clozeFree(x[1]))
  const freshClozeKept = freshCloze.filter(clozeFree)
  // révisions mélangées : jamais deux cartes du même thème à la suite quand on peut l'éviter
  const reviewKeys = spread(kept.map((x) => x[1]), (k) => groupOf(byIdLocal.get(k.slice(0, k.lastIndexOf(':')))), today)
  // Phrases naturelles (vidéos) : quelques-unes par jour, choisies parmi ce que tu sais déjà lire
  let freshNat: string[] = []
  const natLeft = Math.max(0, (state.settings.naturalPerDay ?? 0) - (dt.nv ?? 0))
  if (natLeft > 0 && !f.free && scope === 'normal' && f.deck === 'all' && f.pos === 'all' && !f.theme && !f.ids) {
    freshNat = naturalSentences(state, items, natLeft).map((it) => `${it.id}:r`)
  }
  return {
    learning: learningKeys,
    review: reviewKeys,
    deferred: review.length - kept.length,
    fresh,
    freshProd,
    freshNat,
    freshCloze: freshClozeKept,
    freshForm,
    newLeft,
    prodLeft
  }
}

/** Retard relatif d'une révision : 1 = due aujourd'hui pile, 2 = deux fois son intervalle… (plus c'est grand, plus le risque d'oubli est grand). */
export function overdue(c: CardState, today: number): number {
  return (today - c.d + c.i) / Math.max(1, c.i)
}

/** Groupe d'une carte pour varier : thème de la phrase, vidéo, ou nature du mot. */
function groupOf(it: Item | undefined): string {
  if (!it) return '?'
  if (it.kind === 'sentence') return it.note ?? it.deck
  return `${it.kind}:${it.pos}`
}

/** Tirage pseudo-aléatoire stable pour la journée (la file ne change pas d'un rechargement à l'autre). */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mélange stable sur la journée, puis évite deux cartes du même groupe à la suite. */
export function spread<T>(xs: T[], group: (x: T) => string, seed: number): T[] {
  const rnd = seeded(seed * 7919 + xs.length)
  const pool = [...xs]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const out: T[] = []
  let last = ''
  while (pool.length) {
    let i = pool.findIndex((x) => group(x) !== last)
    if (i < 0) i = 0
    const [x] = pool.splice(i, 1)
    last = group(x)
    out.push(x)
  }
  return out
}

/** Phrases dans l'ordre, mais en tournant entre les thèmes (resto, courses, gare…) : jamais deux fois le même à la suite. */
export function rotateThemes(sentences: Item[]): Item[] {
  const byTheme = new Map<string, Item[]>()
  for (const s of sentences) {
    const t = s.note ?? s.deck
    const l = byTheme.get(t) ?? []
    l.push(s)
    byTheme.set(t, l)
  }
  // les thèmes passent dans l'ordre de leur première phrase (la vie quotidienne d'abord)
  const lists = [...byTheme.values()].sort((a, b) => a[0].order - b[0].order)
  const out: Item[] = []
  for (let k = 0; out.length < sentences.length; k++) for (const l of lists) if (l[k]) out.push(l[k])
  return out
}

/** Nouvelles cartes du jour : un mot, une phrase, un mot, une phrase… */
export function mixFresh(words: Item[], sentences: Item[], n: number): Item[] {
  const out: Item[] = []
  let w = 0
  let s = 0
  while (out.length < n && (w < words.length || s < sentences.length)) {
    if (w < words.length && (out.length % 2 === 0 || s >= sentences.length)) out.push(words[w++])
    else if (s < sentences.length) out.push(sentences[s++])
  }
  return out
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
    const cz = state.cards[`${it.id}:c`]
    if (cz && cz.s !== 'new') out.push(`${it.id}:c`)
    const fm = state.cards[`${it.id}:f`]
    if (fm && fm.s !== 'new') out.push(`${it.id}:f`)
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
  const freshItems: Item[] = []
  for (const it of sentences) {
    const key = `${it.id}:r`
    const c = state.cards[key]
    if (!c || c.s === 'new') {
      if (!isOptIn(it.deck)) freshItems.push(it)
    }
    else if (isDue(c, now, today) && (c.s === 'review' || c.d <= now + 20 * 60_000)) due.push([c.d, key])
  }
  due.sort((a, b) => a[0] - b[0])
  const fresh = rotateThemes(freshItems).map((it) => `${it.id}:r`)
  return [...due.map((d) => d[1]), ...fresh].slice(0, n)
}

/** Mélange : révisions d'abord, nouvelles cartes glissées régulièrement. */
export function interleave(q: QueueBuild): string[] {
  const out: string[] = [...q.learning]
  const news = [...q.fresh, ...q.freshProd, ...q.freshNat, ...(q.freshCloze ?? []), ...(q.freshForm ?? [])]
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
    fresh: q.fresh.length + q.freshProd.length + q.freshNat.length + q.freshCloze.length + (q.freshForm?.length ?? 0),
    deferred: q.deferred,
    total: q.learning.length + q.review.length + q.fresh.length + q.freshProd.length + q.freshNat.length + q.freshCloze.length + (q.freshForm?.length ?? 0)
  }
}

/** Repère de la mise à jour v1.18 dans `ach` : la limite de révisions par jour a été retirée une fois (choix d'Arnold). */
export const UNLIMITED_KEY = 'm:revisions18'

/** v1.18 : toutes les révisions dues chaque jour (limite retirée une seule fois ; on peut la remettre dans Réglages). */
export function withUnlimitedReviews(state: AppState, now: number): AppState {
  if (state.ach[UNLIMITED_KEY]) return state
  const settings = state.settings.reviewsPerDay > 0 ? { ...state.settings, reviewsPerDay: 0, _t: Math.max(now, state.settings._t + 1) } : state.settings
  return { ...state, settings, ach: { ...state.ach, [UNLIMITED_KEY]: 1 } }
}
