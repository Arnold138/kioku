// Indicateurs pour « voir où j'en suis » : mots difficiles, prévision des révisions, feuille de route par niveau.
import type { Item } from './deck'
import type { AppState } from './state'
import { isKnown, isMature, dayNumber, dayKey, type CardState } from './scheduler'
import { posGroup, type PosGroup } from './queue'
import { THEMES, inTheme } from './themes'

export const LEECH_AT = 4 // nombre d'oublis à partir duquel un mot devient « difficile »

export interface Leech {
  item: Item
  lapses: number
  key: string // carte la plus oubliée (id de carte)
}

/** Mots oubliés au moins `LEECH_AT` fois (reconnaissance ou production), les plus difficiles d'abord. */
export function leeches(state: AppState, items: Item[]): Leech[] {
  const out: Leech[] = []
  for (const it of items) {
    let best: Leech | null = null
    for (const dir of ['r', 'p'] as const) {
      const key = `${it.id}:${dir}`
      const c = state.cards[key]
      if (c && c.l >= LEECH_AT && (!best || c.l > best.lapses)) best = { item: it, lapses: c.l, key }
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => b.lapses - a.lapses)
}

export interface ForecastDay {
  dn: number
  n: number
  label: string
}

const DOW = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

/** Révisions attendues sur les `days` prochains jours (le jour 0 inclut ce qui est déjà en retard). */
export function forecast(state: AppState, now: number, days = 7): ForecastDay[] {
  const today = dayNumber(now)
  const counts = new Array<number>(days).fill(0)
  for (const c of Object.values(state.cards)) {
    if (c.s === 'new') continue
    const off = c.s === 'review' ? c.d - today : Math.floor((dayNumber(c.d) - today))
    const i = Math.max(0, off)
    if (i < days) counts[i]++
  }
  return counts.map((n, i) => ({
    dn: today + i,
    n,
    label: i === 0 ? 'Auj.' : i === 1 ? 'Dem.' : DOW[new Date((today + i) * 86400000 + 43200000).getUTCDay()]
  }))
}

// ───────── Feuille de route par niveau ─────────
export interface Slice {
  id: string
  label: string
  known: number
  total: number
  pct: number
}

export interface LevelReport {
  lvl: 'N5' | 'N4' | 'N3'
  total: number
  known: number // mots reconnus (intervalle ≥ 3 jours)
  solid: number // mots solides (intervalle ≥ 21 jours)
  seen: number
  pct: number
  byPos: Slice[]
}

const POS_LABELS: Record<PosGroup, string> = { all: 'Tout', verbs: 'Verbes', adjs: 'Adjectifs', nouns: 'Noms', others: 'Autres mots' }

const slice = (id: string, label: string, known: number, total: number): Slice => ({ id, label, known, total, pct: total ? known / total : 0 })

export function levelReports(state: AppState, items: Item[]): LevelReport[] {
  const out: LevelReport[] = []
  for (const lvl of ['N5', 'N4', 'N3'] as const) {
    const words = items.filter((i) => i.kind === 'word' && i.lvl === lvl)
    let known = 0
    let solid = 0
    let seen = 0
    const pos: Record<string, { k: number; t: number }> = {}
    for (const w of words) {
      const c: CardState | undefined = state.cards[`${w.id}:r`]
      const g = posGroup(w.pos)
      const p = (pos[g] ??= { k: 0, t: 0 })
      p.t++
      if (c && c.s !== 'new') seen++
      if (c && isKnown(c)) {
        known++
        p.k++
      }
      if (c && isMature(c)) solid++
    }
    const byPos = (['verbs', 'adjs', 'nouns', 'others'] as PosGroup[])
      .filter((g) => pos[g])
      .map((g) => slice(g, POS_LABELS[g], pos[g].k, pos[g].t))
    out.push({ lvl, total: words.length, known, solid, seen, pct: words.length ? known / words.length : 0, byPos })
  }
  return out
}

/** Couverture par thème (tous niveaux confondus) : ce qui est solide, ce qui reste à faire. */
export function themeCoverage(state: AppState, items: Item[]): Array<Slice & { emoji: string }> {
  return THEMES.map((t) => {
    let known = 0
    let total = 0
    for (const w of items) {
      if (w.kind !== 'word' || !inTheme(w.id, t.id)) continue
      total++
      const c = state.cards[`${w.id}:r`]
      if (c && isKnown(c)) known++
    }
    return { ...slice(t.id, t.label, known, total), emoji: t.emoji }
  })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.pct - a.pct)
}

/** Dernier jour sans révision manquée, etc. — utilitaire pour l'affichage des jours. */
export const dayLabel = (dn: number) => dayKey(dn)
