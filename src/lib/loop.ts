// v1.21 — Écoute en boucle : une liste de lecture faite pour toi.
// Tes mots les plus ratés, des mots pas encore vus, des phrases et (v1.22) des blocs. Les mots que tu connais bien n'y sont pas.
import { isOptIn, type Item } from './deck'
import { isNaturalId } from './natural'
import { misses, type CardState } from './scheduler'
import chunks from '../data/chunks.json'

export type LoopTag = 'miss' | 'new' | 'phrase' | 'block'
/** Ce qu'on écoute : un mot, une phrase, ou (v1.22) un bloc de phrase avec son explication. */
export interface LoopCard { id: string; jp: string; kana: string; fr: string; note?: string }
export interface LoopEntry { it: LoopCard; tag: LoopTag; label: string }

/** v1.22 — Blocs de phrases (« je ne sais pas », « c'est bien ce que je pensais »…) avec la structure expliquée. */
export const BLOCKS: LoopCard[] = (chunks as Array<{ id: number; jp: string; kana: string; fr: string; note: string }>).map((c) => ({ ...c, id: `k${c.id}` }))

/** Format d'écoute : tout mélangé, ou seulement des mots, des phrases ou des blocs. */
export type LoopFormat = 'mix' | 'words' | 'phrases' | 'blocks'
export const LOOP_FORMATS: Array<{ id: LoopFormat; label: string }> = [
  { id: 'mix', label: 'Tout' }, { id: 'words', label: 'Mots' }, { id: 'phrases', label: 'Phrases' }, { id: 'blocks', label: 'Blocs' },
]

export const LOOP_DURATIONS = [5, 10, 15, 20] as const // minutes
export const LOOP_GAPS = [4, 6, 8, 10, 15] as const // secondes pour réfléchir
export interface LoopPrefs { dur: number; gap: number; fmt: LoopFormat }
export const DEFAULT_LOOP: LoopPrefs = { dur: 10, gap: 6, fmt: 'mix' }
const LS_LOOP = 'kioku:ecoute'

export function loadLoopPrefs(): LoopPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(LS_LOOP) ?? 'null') as Partial<LoopPrefs> | null
    return {
      dur: LOOP_DURATIONS.includes(p?.dur as never) ? (p!.dur as number) : DEFAULT_LOOP.dur,
      gap: LOOP_GAPS.includes(p?.gap as never) ? (p!.gap as number) : DEFAULT_LOOP.gap,
      fmt: LOOP_FORMATS.some((f) => f.id === p?.fmt) ? (p!.fmt as LoopFormat) : DEFAULT_LOOP.fmt,
    }
  } catch {
    return DEFAULT_LOOP
  }
}
export function saveLoopPrefs(p: LoopPrefs) {
  try { localStorage.setItem(LS_LOOP, JSON.stringify(p)) } catch { /* navigation privée */ }
}

/** Un mot « bien connu » : intervalle long et réussi 2 fois de suite, ou très long. Il ne passe pas dans l'écoute. */
export const wellKnown = (c: CardState | undefined): boolean => !!c && c.s === 'review' && (c.i >= 60 || (c.i >= 21 && (c.ok ?? 0) >= 2))

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }

/**
 * Construit la liste : on alterne raté → nouveau → phrase → bloc (selon le format choisi). Les ratés d'abord les plus ratés,
 * les mots nouveaux dans l'ordre où tu vas les apprendre, les phrases mélangées (autrement chaque jour).
 */
export function buildLoop(cards: Record<string, CardState>, items: Item[], day: number, max = 90, fmt: LoopFormat = 'mix'): LoopEntry[] {
  const seenIds = new Set(Object.keys(cards).map((k) => k.slice(0, k.lastIndexOf(':'))))
  const seen = (it: Item) => seenIds.has(it.id)
  const words = items.filter((it) => it.kind === 'word' && !isOptIn(it.deck))
  const missed = words
    .map((it) => ({ it, n: Math.max(misses(cards[`${it.id}:r`]), misses(cards[`${it.id}:p`])) }))
    .filter((x) => x.n > 0 && !wellKnown(cards[`${x.it.id}:r`]))
    .sort((a, b) => b.n - a.n || a.it.order - b.it.order)
  const fresh = words.filter((it) => !seen(it)).sort((a, b) => a.order - b.order)
  const phrases = items
    .filter((it) => it.kind === 'sentence' && !isNaturalId(it.id) && !isOptIn(it.deck) && !wellKnown(cards[`${it.id}:r`]))
    .sort((a, b) => hash(a.id + day) - hash(b.id + day))

  const out: LoopEntry[] = []
  const blocks = [...BLOCKS].sort((a, b) => hash(a.id + day) - hash(b.id + day))
  const all: Record<LoopTag, LoopEntry[]> = {
    miss: missed.map(({ it, n }) => ({ it, tag: 'miss', label: `mot difficile · raté ${n} fois` })),
    new: fresh.map((it) => ({ it, tag: 'new', label: 'nouveau mot' })),
    phrase: phrases.map((it) => ({ it, tag: 'phrase', label: 'phrase' })),
    block: blocks.map((it) => ({ it, tag: 'block', label: 'bloc' })),
  }
  const tags: LoopTag[] = fmt === 'words' ? ['miss', 'new'] : fmt === 'phrases' ? ['phrase'] : fmt === 'blocks' ? ['block'] : ['miss', 'new', 'phrase', 'block']
  const lists: Array<[LoopEntry[], number]> = tags.map((t) => [all[t], 0])
  while (out.length < max && lists.some(([l, i]) => i < l.length)) {
    for (const slot of lists) {
      if (out.length >= max) break
      const [l, i] = slot
      if (i < l.length) { out.push(l[i]); slot[1] = i + 1 }
    }
  }
  return out
}

/**
 * v1.21 — Mode voiture : comprend « bien », « facile », « encore », « difficile » (et « hésitant », « oublié »).
 * Renvoie la note, ou null si rien de reconnu. On regarde toutes les propositions du téléphone.
 */
export function carCommand(alts: string[]): 1 | 2 | 3 | 4 | 5 | null {
  for (const raw of alts) {
    const t = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (/\bdifficile\b/.test(t)) return 2
    if (/\bfacile\b/.test(t)) return 5
    if (/\b(encore|oublie|rate|non)\b/.test(t)) return 1
    if (/\bhesit/.test(t)) return 3
    if (/\b(bien|ok|oui|bon)\b/.test(t)) return 4
  }
  return null
}
