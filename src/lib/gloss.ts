// v1.17 — Toucher un mot d'une phrase : sa forme de base, sa lecture, son sens et la grammaire.
// Données préparées à l'avance (scripts/blocks/gloss.py), chargées à part dès le démarrage.
import { useEffect, useState } from 'react'

export interface Gloss {
  /** tel qu'écrit dans la phrase */
  s: string
  r: string
  /** forme du dictionnaire (verbes, adjectifs) si elle diffère */
  base?: string
  baseR?: string
  fr?: string
  /** forme grammaticale ou tournure (« passé poli », « 〜てもいいですか : puis-je… ? ») */
  g?: string
}
type Raw = Record<string, string[][]>

let data: Raw | null = null
const waiting = new Set<() => void>()
export const glossLoaded: Promise<void> = import('../data/gloss.json')
  .then((m) => { data = (m.default ?? m) as unknown as Raw; waiting.forEach((f) => f()) })
  .catch(() => { /* sans les données, les phrases s'affichent simplement */ })

export function setGlossData(d: Raw | null) { data = d }

export function useGlossReady(): boolean {
  const [ready, setReady] = useState(!!data)
  useEffect(() => {
    if (data) { setReady(true); return }
    const f = () => setReady(true)
    waiting.add(f)
    return () => { waiting.delete(f) }
  }, [])
  return ready
}

/** Un morceau de la phrase : un mot à toucher (avec son index), ou de la ponctuation. */
export type Piece = { text: string; i: number } | { text: string; i: -1 }

/** Mots d'une phrase, recalés sur le texte affiché (la ponctuation reste du texte simple). null si ça ne colle pas. */
export function glossPieces(id: string, jp: string): { words: Gloss[]; pieces: Piece[] } | null {
  const raw = data?.[id]
  if (!raw?.length) return null
  const words: Gloss[] = raw.map(([s, r, base, baseR, fr, g]) => ({ s, r, base: base || undefined, baseR: baseR || undefined, fr: fr || undefined, g: g || undefined }))
  const pieces: Piece[] = []
  let pos = 0
  for (let i = 0; i < words.length; i++) {
    const at = jp.indexOf(words[i].s, pos)
    if (at < 0) return null
    const gap = jp.slice(pos, at)
    if (gap && /[^\s、。，．,.!?！？「」『』（）()・…〜~ー：:；;"'“”]/.test(gap)) return null // du texte qui ne serait pas expliqué
    if (gap) pieces.push({ text: gap, i: -1 })
    pieces.push({ text: words[i].s, i })
    pos = at + words[i].s.length
  }
  if (pos < jp.length) pieces.push({ text: jp.slice(pos), i: -1 })
  return { words, pieces }
}

/** Mots compris dans un passage de la phrase (un bloc). */
export function glossInRange(id: string, jp: string, start: number, end: number): Gloss[] {
  const g = glossPieces(id, jp)
  if (!g) return []
  const out: Gloss[] = []
  let pos = 0
  for (const p of g.pieces) {
    const a = pos, b = pos + p.text.length
    if (p.i >= 0 && a < end && b > start) out.push(g.words[p.i])
    pos = b
  }
  return out
}
