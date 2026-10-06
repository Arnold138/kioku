import type { CardState } from './scheduler'
import { dayKey, dayNumber, isKnown, isMature } from './scheduler'
import type { CustomCard, Item } from './deck'
import { parseCardId } from './deck'

// ───────────────────────── Types ─────────────────────────
export interface Settings {
  newPerDay: number
  prodPerDay: number
  goal: number
  reading: 'always' | 'tap' | 'never'
  autoPlay: boolean
  production: boolean
  theme: 'auto' | 'light' | 'dark'
  /** Phrases à traduire en début de séance (0 = aucune). Ajouté en v1.1 — absent des anciennes sauvegardes. */
  preSentences: 0 | 1 | 2
  /** Saisie au clavier sur les cartes de production (FR → JP). Ajouté en v1.1. */
  typing: boolean
  /** Maximum de révisions (cartes déjà apprises) proposées par jour ; 0 = illimité. Ajouté en v1.3 — absent des anciennes sauvegardes. */
  reviewsPerDay: number
  /** Retire peu à peu l'aide à la lecture (rōmaji, puis kana) sur les cartes solides. Ajouté en v1.3. */
  fade: boolean
  /** Gestes : glisser la carte à droite = Bien, à gauche = Oublié. Ajouté en v1.3. */
  swipe: boolean
  _t: number
}

/** Compteurs d'une journée pour UN appareil (fusion sans conflit : max par champ). */
export interface DayStat {
  n: number // cartes répondues
  nw: number // nouvelles cartes de reconnaissance introduites
  np: number // nouvelles cartes de production introduites
  ok: number // réponses ≥ Difficile (mémorisées)
  xp: number
  sec: number // secondes passées
  rv?: number // révisions de cartes déjà apprises (compte pour le quota du jour). Ajouté en v1.3 — optionnel
}

export interface AppState {
  v: 1
  cards: Record<string, CardState>
  custom: Record<string, CustomCard>
  daily: Record<string, Record<string, DayStat>>
  ach: Record<string, number>
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 15,
  prodPerDay: 8,
  goal: 20,
  reading: 'always',
  autoPlay: false,
  production: true,
  theme: 'auto',
  preSentences: 0,
  typing: false,
  reviewsPerDay: 30,
  fade: true,
  swipe: true,
  _t: 0
}

export const emptyState = (): AppState => ({
  v: 1,
  cards: {},
  custom: {},
  daily: {},
  ach: {},
  settings: { ...DEFAULT_SETTINGS }
})

const emptyDay = (): DayStat => ({ n: 0, nw: 0, np: 0, ok: 0, xp: 0, sec: 0 })

// ───────────────────────── Fusion (synchro multi-appareils) ─────────────────────────
export function mergeStates(a: AppState, b: AppState): AppState {
  const cards: Record<string, CardState> = { ...a.cards }
  for (const [id, c] of Object.entries(b.cards)) {
    const mine = cards[id]
    if (!mine || c.t > mine.t) cards[id] = c
  }
  const custom: Record<string, CustomCard> = { ...a.custom }
  for (const [id, c] of Object.entries(b.custom)) {
    const mine = custom[id]
    if (!mine || c.t > mine.t) custom[id] = c
  }
  const daily: AppState['daily'] = {}
  for (const src of [a.daily, b.daily]) {
    for (const [day, devs] of Object.entries(src)) {
      const target = (daily[day] ??= {})
      for (const [dev, st] of Object.entries(devs)) {
        const cur = target[dev]
        target[dev] = cur
          ? {
              n: Math.max(cur.n, st.n),
              nw: Math.max(cur.nw, st.nw),
              np: Math.max(cur.np, st.np),
              ok: Math.max(cur.ok, st.ok),
              xp: Math.max(cur.xp, st.xp),
              sec: Math.max(cur.sec, st.sec),
              ...(cur.rv !== undefined || st.rv !== undefined ? { rv: Math.max(cur.rv ?? 0, st.rv ?? 0) } : {})
            }
          : { ...st }
      }
    }
  }
  const ach: Record<string, number> = { ...a.ach }
  for (const [id, t] of Object.entries(b.ach)) ach[id] = ach[id] ? Math.min(ach[id], t) : t
  const settings = b.settings._t > a.settings._t ? b.settings : a.settings
  return { v: 1, cards, custom, daily, ach, settings: { ...DEFAULT_SETTINGS, ...settings } }
}

/** Nettoie un état importé/reçu (robustesse). */
export function sanitize(raw: unknown): AppState {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<AppState>
  return {
    v: 1,
    cards: r.cards && typeof r.cards === 'object' ? r.cards : {},
    custom: r.custom && typeof r.custom === 'object' ? r.custom : {},
    daily: r.daily && typeof r.daily === 'object' ? r.daily : {},
    ach: r.ach && typeof r.ach === 'object' ? r.ach : {},
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) }
  }
}

// ───────────────────────── Statistiques dérivées ─────────────────────────
export function dayTotal(state: AppState, day: string): DayStat {
  const devs = state.daily[day]
  const t = emptyDay()
  if (!devs) return t
  for (const d of Object.values(devs)) {
    t.n += d.n
    t.nw += d.nw
    t.np += d.np
    t.ok += d.ok
    t.xp += d.xp
    t.sec += d.sec
    t.rv = (t.rv ?? 0) + (d.rv ?? 0)
  }
  return t
}

export function totalXp(state: AppState): number {
  let xp = 0
  for (const devs of Object.values(state.daily)) for (const d of Object.values(devs)) xp += d.xp
  return xp
}

export function totalReviews(state: AppState): number {
  let n = 0
  for (const devs of Object.values(state.daily)) for (const d of Object.values(devs)) n += d.n
  return n
}

export function levelFromXp(xp: number) {
  // seuil du niveau L : 75·L·(L−1) XP  (niveau 2 = 150 XP, niveau 3 = 450 XP, niveau 10 = 6 750 XP)
  const level = Math.floor((1 + Math.sqrt(1 + xp / 18.75)) / 2)
  const start = 75 * level * (level - 1)
  const next = 75 * (level + 1) * level
  return { level, start, next, into: xp - start, span: next - start, pct: (xp - start) / (next - start) }
}

const TITLES: Array<[number, string, string]> = [
  [1, 'Nouveau venu', '新人'],
  [3, 'Curieux', '好奇心'],
  [5, 'Apprenti', '見習い'],
  [8, 'Étudiant assidu', '勤勉'],
  [12, 'Voyageur', '旅人'],
  [17, 'Lecteur', '読者'],
  [23, 'Conversationnel', '会話'],
  [30, 'Sensei en herbe', '先生'],
  [40, 'Maître des mots', '達人']
]
export function levelTitle(level: number): { fr: string; jp: string } {
  let cur = TITLES[0]
  for (const t of TITLES) if (level >= t[0]) cur = t
  return { fr: cur[1], jp: cur[2] }
}

export function goalMet(state: AppState, day: string): boolean {
  return dayTotal(state, day).n >= state.settings.goal
}

export function streaks(state: AppState, now = Date.now()) {
  const today = dayNumber(now)
  const met = (dn: number) => goalMet(state, dayKey(dn))
  let cur = 0
  let dn = met(today) ? today : today - 1
  while (met(dn)) {
    cur++
    dn--
  }
  // meilleure série
  const days = Object.keys(state.daily)
    .filter((d) => goalMet(state, d))
    .sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of days) {
    if (prev) {
      const diff = (Date.parse(d) - Date.parse(prev)) / 86400000
      run = Math.round(diff) === 1 ? run + 1 : 1
    } else run = 1
    best = Math.max(best, run)
    prev = d
  }
  return { current: cur, best: Math.max(best, cur), todayDone: met(today) }
}

export interface Counts {
  newLeft: number
  prodNewLeft: number
  learning: number
  review: number
}

export interface Progress {
  wordsKnownR: number
  wordsKnownP: number
  known: Record<string, { r: number; p: number; total: number }>
  matureCount: number
  seen: number
  sentencesKnown: number
  customCount: number
}

export function computeProgress(state: AppState, items: Item[]): Progress {
  const known: Progress['known'] = {}
  let wordsKnownR = 0
  let wordsKnownP = 0
  let matureCount = 0
  let seen = 0
  let sentencesKnown = 0
  let customCount = 0
  for (const it of items) {
    const k = (known[it.lvl] ??= { r: 0, p: 0, total: 0 })
    k.total++
    const r = state.cards[`${it.id}:r`]
    const p = state.cards[`${it.id}:p`]
    if (r && r.s !== 'new') seen++
    if (r && isKnown(r)) {
      k.r++
      if (it.kind === 'word') wordsKnownR++
      if (it.kind === 'sentence') sentencesKnown++
    }
    if (p && isKnown(p)) {
      k.p++
      if (it.kind === 'word') wordsKnownP++
    }
    if (r && isMature(r)) matureCount++
    if (it.kind === 'custom') customCount++
  }
  return { wordsKnownR, wordsKnownP, known, matureCount, seen, sentencesKnown, customCount }
}

export function retentionRate(state: AppState, lastDays = 30, now = Date.now()): number | null {
  const today = dayNumber(now)
  let n = 0
  let ok = 0
  for (let i = 0; i < lastDays; i++) {
    const d = dayTotal(state, dayKey(today - i))
    n += d.n
    ok += d.ok
  }
  return n >= 10 ? ok / n : null
}

export function idsFromCardKey(cardKey: string) {
  return parseCardId(cardKey)
}
