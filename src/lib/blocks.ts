// v1.17 — Les phrases par blocs.
// Une phrase est découpée en blocs (今日は / 今から / 買い物に / 行きます). Une nouvelle phrase passe par 4 étapes :
// Découvre → Reconstruis → Change un bloc → Dis-la de mémoire. Ensuite, aux révisions : tu la reconstruis depuis
// le français, puis, quand elle tient une semaine, tu la dis de mémoire. Logique pure (testée) ; l'écran est dans BlockCard.tsx.
import { useEffect, useState } from 'react'
import type { CardState, Rating } from './scheduler'
import { normalizeJa } from './oral'
import { canon } from './typing'
import { isKana, katakanaToHiragana, toRomaji } from './romaji'

export interface Block { jp: string; kana: string }
/** Variante : les blocs i à j remplacés par un nouveau bloc, avec la traduction de la nouvelle phrase. */
export interface Variant { i: number; j: number; jp: string; kana: string; fr: string }
export interface SentenceBlocks { blocks: Block[]; variant?: Variant }

type Raw = Record<string, { b: Array<[string, string]>; v?: Variant }>

/** Les phrases durcissent en « de mémoire » à partir d'une semaine d'intervalle. */
export const RECALL_FROM_DAYS = 7

let data: Raw | null = null
const waiting = new Set<() => void>()
/** Chargé à part (≈ 150 Ko) dès que l'app démarre, gardé hors ligne comme le reste. */
export const blocksLoaded: Promise<void> = import('../data/blocks.json')
  .then((m) => {
    data = (m.default ?? m) as unknown as Raw
    waiting.forEach((f) => f())
  })
  .catch(() => { /* sans les blocs, les phrases restent des cartes normales */ })

/** Pour les tests : données injectées directement. */
export function setBlocksData(d: Raw | null) { data = d }

export function blocksFor(itemId: string): SentenceBlocks | null {
  const r = data?.[itemId]
  if (!r || !r.b.length) return null
  return { blocks: r.b.map(([jp, kana]) => ({ jp, kana })), variant: r.v }
}

/** Rafraîchit l'écran quand les blocs arrivent. */
export function useBlocksReady(): boolean {
  const [ready, setReady] = useState(!!data)
  useEffect(() => {
    if (data) { setReady(true); return }
    const f = () => setReady(true)
    waiting.add(f)
    return () => { waiting.delete(f) }
  }, [])
  return ready
}

export type BlockMode = 'learn' | 'rebuild' | 'recall'

/** Nouvelle phrase → les 4 étapes ; phrase en cours ou récente → Reconstruis ; phrase solide (≥ 7 j) → De mémoire. */
export function blockMode(card: CardState | undefined): BlockMode {
  if (!card || card.s === 'new') return 'learn'
  if (card.s === 'review' && card.i >= RECALL_FROM_DAYS) return 'recall'
  return 'rebuild'
}

export type Step = 'discover' | 'rebuild' | 'change' | 'recall'

/** Étapes à faire pour cette carte (une phrase d'un seul bloc n'a rien à reconstruire). */
export function stepsFor(mode: BlockMode, sb: SentenceBlocks): Step[] {
  const canRebuild = sb.blocks.length >= 2
  if (mode === 'recall') return ['recall']
  if (mode === 'rebuild') return canRebuild ? ['rebuild'] : ['recall']
  const s: Step[] = ['discover']
  if (canRebuild) s.push('rebuild')
  if (sb.variant) s.push('change')
  s.push('recall')
  return s
}

/** Mélange déterministe si on lui donne un tirage (tests), sinon Math.random. Jamais dans l'ordre exact si on peut l'éviter. */
export function shuffled<T>(xs: T[], rnd = Math.random): T[] {
  const a = xs.map((x, i) => ({ x, i }))
  for (let k = 0; k < 4; k++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    if (a.length < 2 || a.some((y, i) => y.i !== i)) break
  }
  if (a.length >= 2 && a.every((y, i) => y.i === i)) a.push(a.shift()!)
  return a.map((y) => y.x)
}

/** Une pièce à placer pour « Reconstruis » : un bloc de la phrase (pos = sa place) ou un intrus (pos = -1). */
export interface Piece { key: string; jp: string; kana: string; pos: number }

/** Pièces mélangées. En révision, la variante sert d'intrus (un bloc qui ressemble mais n'est pas dans la phrase). */
export function rebuildPieces(sb: SentenceBlocks, withDecoy: boolean, rnd = Math.random): Piece[] {
  const ps: Piece[] = sb.blocks.map((b, i) => ({ key: `b${i}`, jp: b.jp, kana: b.kana, pos: i }))
  const v = sb.variant
  if (withDecoy && v && v.i === v.j && !sb.blocks.some((b) => b.jp === v.jp)) ps.push({ key: 'x', jp: v.jp, kana: v.kana, pos: -1 })
  return shuffled(ps, rnd)
}

/** Les blocs i..j d'origine, recollés (ce que la variante remplace). */
export function originalPart(sb: SentenceBlocks): Block | null {
  const v = sb.variant
  if (!v) return null
  const part = sb.blocks.slice(v.i, v.j + 1)
  return { jp: part.map((b) => b.jp).join(''), kana: part.map((b) => b.kana).join('') }
}

/** La phrase après le changement. */
export function variantSentence(sb: SentenceBlocks): Block | null {
  const v = sb.variant
  if (!v) return null
  const b = [...sb.blocks.slice(0, v.i), { jp: v.jp, kana: v.kana }, ...sb.blocks.slice(v.j + 1)]
  return { jp: b.map((x) => x.jp).join(''), kana: b.map((x) => x.kana).join(' ') }
}

/** Choix pour « Change un bloc » : le bon bloc, le bloc d'origine et un intrus pris dans une autre phrase. */
export function changeChoices(sb: SentenceBlocks, decoys: string[], rnd = Math.random): Array<{ jp: string; ok: boolean }> {
  const v = sb.variant
  const orig = originalPart(sb)
  if (!v || !orig) return []
  const out = [{ jp: v.jp, ok: true }, { jp: orig.jp, ok: false }]
  const pool = decoys.filter((d) => d !== v.jp && d !== orig.jp)
  if (pool.length) out.push({ jp: pool[Math.floor(rnd() * pool.length)], ok: false })
  return shuffled(out, rnd)
}

/** Blocs de variantes d'autres phrases, pour servir d'intrus. */
export function variantPool(exceptId: string, n = 40): string[] {
  if (!data) return []
  const out: string[] = []
  for (const [id, r] of Object.entries(data)) {
    if (id === exceptId || !r.v) continue
    out.push(r.v.jp)
    if (out.length >= n) break
  }
  return out
}

// ───────── « Dis-la de mémoire » ─────────
const strip = (s: string) => katakanaToHiragana(normalizeJa(s))

export interface RecallCheck {
  /** bloc par bloc : retrouvé dans ta réponse ? */
  hits: boolean[]
  ok: boolean
  /** une bonne partie (au moins la moitié des blocs) */
  partial: boolean
}

/**
 * Compare ta réponse (dite au micro ou écrite : kanji, kana ou rōmaji) à la phrase, bloc par bloc.
 * Un bloc compte s'il apparaît dans ce que tu as dit, en kanji ou en kana. Réussi si presque tous les blocs y sont
 * (tous jusqu'à 3 blocs, un oubli permis à partir de 4) : le micro du téléphone écrit parfois un mot autrement.
 */
export function checkRecall(sb: SentenceBlocks, answers: string[]): RecallCheck {
  const n = sb.blocks.length
  const hits = new Array<boolean>(n).fill(false)
  for (const raw of answers) {
    const a = raw.trim()
    if (!a) continue
    if (/^[A-Za-zāīūēōâîûêô\s'’\-.,!?]+$/.test(a)) {
      // rōmaji : on compare au rōmaji des kana, bloc par bloc
      const typed = canon(a)
      sb.blocks.forEach((b, i) => { if (typed.includes(canon(toRomaji(b.kana)))) hits[i] = true })
      continue
    }
    const s = strip(a)
    const asRomaji = isKana(a) ? canon(toRomaji(a)) : ''
    sb.blocks.forEach((b, i) => {
      const j = strip(b.jp)
      const k = strip(b.kana)
      if ((j && s.includes(j)) || (k && s.includes(k))) hits[i] = true
      else if (asRomaji && asRomaji.includes(canon(toRomaji(b.kana)))) hits[i] = true
    })
  }
  const got = hits.filter(Boolean).length
  const need = n <= 3 ? n : n - 1
  return { hits, ok: got >= need, partial: got * 2 >= n }
}

// ───────── Note proposée à la fin ─────────
/** Note suggérée (tu peux toujours en choisir une autre) : comme pour les cartes écrites, Bien si c'est juste. */
export function suggestRating(r: { mode: BlockMode; mistakes: number; recall?: RecallCheck | null; selfOk?: boolean | null; gaveUp?: boolean }): Rating {
  if (r.gaveUp) return 1
  if (r.selfOk != null) return r.selfOk ? (r.mistakes ? 3 : 4) : 1
  if (r.recall) {
    if (r.recall.ok) return r.mistakes ? 3 : 4
    return r.recall.partial ? 2 : 1
  }
  // Reconstruis seul (révision)
  return r.mistakes === 0 ? 4 : r.mistakes === 1 ? 3 : 2
}

// ───────── v1.19 : texte à trous par blocs ─────────
/** Blocs d'autres phrases, pour servir d'intrus. */
export function blockPool(exceptId: string, n = 400): Block[] {
  if (!data) return []
  const out: Block[] = []
  for (const [id, r] of Object.entries(data)) {
    if (id === exceptId) continue
    for (const [jp, kana] of r.b) out.push({ jp, kana })
    if (out.length >= n) break
  }
  return out
}

export interface GapPuzzle {
  /** places des blocs cachés (dans l'ordre de la phrase) */
  gaps: number[]
  /** blocs proposés : les bons + des intrus, mélangés */
  choices: Array<Block & { key: string; ok: boolean }>
}

const bare = (s: string) => s.replace(/[、。！？!?，．]/g, '')

/**
 * Phrase à trous : 1 bloc caché (2 à partir de 4 blocs), choisis différemment à chaque révision (`seed`).
 * Les intrus : la variante de la phrase si elle existe (un bloc qui ressemble), sinon des blocs d'autres phrases.
 */
export function gapPuzzle(sb: SentenceBlocks, seed: number, pool: Block[], rnd = Math.random): GapPuzzle {
  const n = sb.blocks.length
  const count = n >= 4 ? 2 : 1
  // on évite de cacher deux blocs identiques et les tout petits blocs quand on a le choix
  const cand = sb.blocks.map((b, i) => i).filter((i) => bare(sb.blocks[i].jp).length >= 2)
  const list = cand.length >= count ? cand : sb.blocks.map((_, i) => i)
  const gaps: number[] = []
  let k = Math.abs(Math.floor(seed)) % list.length
  while (gaps.length < count) {
    if (!gaps.includes(list[k])) gaps.push(list[k])
    k = (k + Math.max(1, Math.floor(list.length / count))) % list.length
    if (gaps.length < count && gaps.length === list.length) break
  }
  gaps.sort((a, b) => a - b)
  const right = gaps.map((i) => ({ ...sb.blocks[i], key: `g${i}`, ok: true }))
  const taken = new Set(right.map((c) => bare(c.jp)))
  sb.blocks.forEach((b) => taken.add(bare(b.jp)))
  const decoys: Array<Block & { key: string; ok: boolean }> = []
  const v = sb.variant
  if (v && v.i === v.j && gaps.includes(v.i) && !taken.has(bare(v.jp))) {
    decoys.push({ jp: v.jp, kana: v.kana, key: 'xv', ok: false })
    taken.add(bare(v.jp))
  }
  const want = count + 1
  const others = pool.filter((b) => !taken.has(bare(b.jp)) && bare(b.jp).length >= 2)
  for (let t = 0; decoys.length < want && others.length && t < 40; t++) {
    const b = others[Math.floor(rnd() * others.length)]
    if (taken.has(bare(b.jp))) continue
    taken.add(bare(b.jp))
    decoys.push({ ...b, key: `x${decoys.length}`, ok: false })
  }
  return { gaps, choices: shuffled([...right, ...decoys], rnd) }
}

/** Note proposée pour une phrase à trous : sans erreur Bien, 1 erreur Hésitant, plus Difficile, abandon Oublié. */
export function gapRating(mistakes: number, gaveUp = false): Rating {
  if (gaveUp) return 1
  return mistakes === 0 ? 4 : mistakes === 1 ? 3 : 2
}
