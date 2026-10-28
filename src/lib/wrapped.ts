/**
 * v1.12 — Kioku Wrapped : le récap d'un mois ou d'une année.
 * Calculé à partir de ce que la sauvegarde contient déjà (compteurs du jour, trophées, écoutes, cartes) : rien n'est ajouté.
 */
import type { AppState } from './state'
import { dayTotal, goalMet } from './state'
import type { Item } from './deck'
import { HARD_CREDIT, isKnown, misses } from './scheduler'
import { ACHIEVEMENTS } from './achievements'
import { listenHistory } from './rewards'
import { oralHistory } from './oral'

export interface Period {
  kind: 'month' | 'year'
  year: number
  /** 1 → 12 (mois seulement) */
  month?: number
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export const periodLabel = (p: Period) => (p.kind === 'year' ? `${p.year}` : `${MONTHS[(p.month ?? 1) - 1]} ${p.year}`)

const inPeriod = (day: string, p: Period) => day.startsWith(p.kind === 'year' ? `${p.year}-` : `${p.year}-${String(p.month).padStart(2, '0')}-`)
const tInPeriod = (t: number, p: Period) => {
  const d = new Date(t)
  return d.getFullYear() === p.year && (p.kind === 'year' || d.getMonth() + 1 === p.month)
}

export interface Wrapped {
  period: Period
  days: number
  cards: number
  minutes: number
  xp: number
  newWords: number
  /** % de cartes retenues (Difficile compte pour 35 %) */
  accuracy: number | null
  bestDay: { day: string; n: number } | null
  /** meilleure suite de jours (objectif atteint) dans la période */
  bestRun: number
  listens: number
  orals: number
  trophies: Array<{ name: string; emoji: string; tier: string }>
  /** le mot le plus raté que tu as fini par retenir */
  comeback: { jp: string; fr: string; misses: number } | null
  /** le kanji présent dans le plus de mots que tu as retenus */
  kanji: { ch: string; words: number } | null
}

export function computeWrapped(state: AppState, items: Item[], p: Period): Wrapped {
  const days = Object.keys(state.daily).filter((d) => inPeriod(d, p)).sort()
  let cards = 0
  let sec = 0
  let xp = 0
  let newWords = 0
  let ok = 0
  let bestDay: Wrapped['bestDay'] = null
  let studied = 0
  for (const d of days) {
    const t = dayTotal(state, d)
    if (t.n > 0) studied++
    cards += t.n
    sec += t.sec
    xp += t.xp
    newWords += t.nw
    ok += t.ok + (t.hd ?? 0) * HARD_CREDIT
    if (!bestDay || t.n > bestDay.n) bestDay = { day: d, n: t.n }
  }
  let run = 0
  let bestRun = 0
  let prev = ''
  for (const d of days.filter((x) => goalMet(state, x))) {
    run = prev && Math.round((Date.parse(d) - Date.parse(prev)) / 86_400_000) === 1 ? run + 1 : 1
    bestRun = Math.max(bestRun, run)
    prev = d
  }
  const trophies = ACHIEVEMENTS.filter((a) => state.ach[a.id] && tInPeriod(state.ach[a.id], p)).map((a) => ({ name: a.name, emoji: a.emoji, tier: a.tier }))

  let comeback: Wrapped['comeback'] = null
  const kanjiCount = new Map<string, number>()
  for (const it of items) {
    if (it.kind !== 'word') continue
    const c = state.cards[`${it.id}:r`]
    if (!c || !isKnown(c)) continue
    const m = misses(c)
    if (m >= 2 && (!comeback || m > comeback.misses)) comeback = { jp: it.jp, fr: it.fr, misses: m }
    for (const ch of new Set([...it.jp].filter((x) => /[一-鿿]/.test(x)))) kanjiCount.set(ch, (kanjiCount.get(ch) ?? 0) + 1)
  }
  let kanji: Wrapped['kanji'] = null
  for (const [ch, n] of kanjiCount) if (!kanji || n > kanji.words) kanji = { ch, words: n }

  return {
    period: p,
    days: studied,
    cards,
    minutes: Math.round(sec / 60),
    xp,
    newWords,
    accuracy: cards >= 10 ? Math.round((ok / cards) * 100) : null,
    bestDay: bestDay && bestDay.n > 0 ? bestDay : null,
    bestRun,
    listens: listenHistory(state.ach).filter((l) => tInPeriod(l.t, p)).length,
    orals: oralHistory(state.ach).filter((l) => tInPeriod(l.t, p)).length,
    trophies,
    comeback,
    kanji
  }
}

export const prettyDay = (day: string) => {
  const d = new Date(day + 'T12:00:00Z')
  return `${d.getUTCDate() === 1 ? '1er' : d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
