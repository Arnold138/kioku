/**
 * v1.13 — Tracé des kanji, vérifié trait par trait.
 * Données : KanjiVG (© Ulrich Apel, CC BY-SA 3.0), seulement les kanji des mots de l'app (src/data/kanjivg.json),
 * chargées à la demande et gardées hors ligne. Pour chaque trait : son dessin (`s`) et 8 points repères (`p`).
 */
import type { AppState } from './state'
import type { Item } from './deck'
import { isKnown } from './scheduler'

export interface KanjiStrokes {
  /** chemins SVG des traits, dans l'ordre (repère 109 × 109) */
  s: string[]
  /** 8 points (x, y) par trait, à intervalles réguliers du début à la fin */
  p: number[][]
}

let data: Promise<Record<string, KanjiStrokes>> | null = null
export function loadKanjiData(): Promise<Record<string, KanjiStrokes>> {
  data ??= import('../data/kanjivg.json').then((m) => (m.default ?? m) as unknown as Record<string, KanjiStrokes>)
  return data
}

export type Pt = [number, number]

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function pathLength(pts: Pt[]): number {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i])
  return l
}

/** Ré-échantillonne un tracé en `n` points régulièrement espacés. */
export function resample(pts: Pt[], n = 8): Pt[] {
  if (pts.length === 0) return []
  if (pts.length === 1) return Array.from({ length: n }, () => pts[0])
  const total = pathLength(pts)
  if (total === 0) return Array.from({ length: n }, () => pts[0])
  const step = total / (n - 1)
  const out: Pt[] = [pts[0]]
  let acc = 0
  let i = 1
  let prev = pts[0]
  while (out.length < n - 1 && i < pts.length) {
    const d = dist(prev, pts[i])
    if (acc + d >= step) {
      const t = (step - acc) / d
      const q: Pt = [prev[0] + t * (pts[i][0] - prev[0]), prev[1] + t * (pts[i][1] - prev[1])]
      out.push(q)
      prev = q
      acc = 0
    } else {
      acc += d
      prev = pts[i]
      i++
    }
  }
  while (out.length < n) out.push(pts[pts.length - 1])
  return out
}

const toPts = (flat: number[]): Pt[] => {
  const out: Pt[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
  return out
}

export interface StrokeCheck {
  ok: boolean
  /** tracé dans le mauvais sens */
  reversed: boolean
  /** écart moyen (unités du repère 109) */
  score: number
}

/** Seuil d'écart moyen accepté : environ 15 % de la case. */
export const STROKE_TOLERANCE = 16

/** Compare un trait tracé au trait attendu (forme, place et sens). */
export function checkStroke(user: Pt[], ref: number[]): StrokeCheck {
  const r = toPts(ref)
  const u = resample(user, r.length)
  const fwd = u.reduce((n, p, i) => n + dist(p, r[i]), 0) / r.length
  const rev = u.reduce((n, p, i) => n + dist(p, r[r.length - 1 - i]), 0) / r.length
  const lenRef = pathLength(r)
  const lenUser = pathLength(user)
  // un tout petit trait (un point) n'est accepté que si le trait attendu est lui aussi très court
  const sizeOk = lenRef < 12 ? lenUser < 40 : lenUser > lenRef * 0.35 && lenUser < lenRef * 2.5
  const reversed = rev + 4 < fwd && rev < STROKE_TOLERANCE
  return { ok: sizeOk && !reversed && fwd < STROKE_TOLERANCE, reversed, score: Math.round(fwd * 10) / 10 }
}

/** Kanji (dans l'ordre) d'un texte, présents dans les données. */
export function kanjiIn(text: string, known: Record<string, KanjiStrokes>): string[] {
  return [...new Set([...text].filter((c) => !!known[c]))]
}

/** Kanji à tracer : ceux de tes mots retenus, les plus récemment travaillés d'abord. */
export function pickTraceWords(state: AppState, items: Item[], n: number, known: Record<string, KanjiStrokes>): Array<{ ch: string; word: Item }> {
  const words = items
    .filter((it) => (it.kind === 'word' || it.kind === 'custom') && kanjiIn(it.jp, known).length > 0)
    .map((it) => ({ it, c: state.cards[`${it.id}:r`] }))
    .filter((x) => x.c && isKnown(x.c))
    .sort((a, b) => b.c!.t - a.c!.t)
  const out: Array<{ ch: string; word: Item }> = []
  const seen = new Set<string>()
  for (const { it } of words) {
    for (const ch of kanjiIn(it.jp, known)) {
      if (seen.has(ch)) continue
      seen.add(ch)
      out.push({ ch, word: it })
      if (out.length >= n * 4) break
    }
    if (out.length >= n * 4) break
  }
  // un peu de hasard parmi les plus récents, pour ne pas toujours tracer les mêmes
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.slice(0, n)
}

// ───────── XP et historique (dans `ach`, clés « tk:<sans-faute>:<total>:<date> ») ─────────
export const TRACE_XP = 12
export const TRACE_PERFECT_BONUS = 6
export const traceKey = (perfect: number, total: number, t: number) => `tk:${perfect}:${total}:${t}`

export function traceReward(mistakes: number[]): { xp: number; perfect: number; total: number } {
  const perfect = mistakes.filter((m) => m === 0).length
  return { xp: mistakes.length * TRACE_XP + perfect * TRACE_PERFECT_BONUS, perfect, total: mistakes.length }
}

export function tracedPerfect(ach: Record<string, number>): number {
  let n = 0
  for (const k of Object.keys(ach)) {
    if (!k.startsWith('tk:')) continue
    const v = Number(k.split(':')[1])
    if (Number.isFinite(v)) n += v
  }
  return n
}
