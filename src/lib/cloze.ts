/**
 * v1.13 — Cartes à trous : une phrase réelle avec un mot que tu connais caché ; tu écris le mot.
 *
 * Une carte à trous a l'identifiant « <mot>:c ». Elle se débloque quand le mot est retenu (sens japonais → français,
 * 3 jours ou plus) et qu'une phrase du deck (vidéos, phrases, exemples) le contient. Elle suit le même planning FSRS
 * que les autres cartes. Une ancienne version de l'app ne la voit pas mais la garde telle quelle à la synchro.
 */
import type { Item } from './deck'
import { contextIndex } from './context'
import { katakanaToHiragana, toRomaji } from './romaji'
import { checkTyped, type TypedResult } from './typing'
import { dayNumber } from './scheduler'

const VERB_LIKE = new Set(['v', 'i'])

export interface Cloze {
  sentence: Item
  /** mots de la phrase (en kana), comme découpés dans le deck */
  tokens: string[]
  /** position du mot caché */
  index: number
  /** le mot tel qu'il est écrit dans la phrase (forme conjuguée éventuelle) */
  answer: string
}

/**
 * Phrase de la carte à trous. v1.18 : elle change d'un jour à l'autre parmi toutes les phrases où l'on peut cacher
 * le mot (au lieu de toujours la même), pour ne pas revoir la même phrase pour plusieurs mots.
 */
let cache: { key: string; map: Map<string, Cloze[]> } | null = null
export function clozeFor(word: Item, items: Item[], day = dayNumber(Date.now())): Cloze | null {
  if (word.kind !== 'word') return null
  const key = String(items.length)
  if (!cache || cache.key !== key) cache = { key, map: new Map() }
  let all = cache.map.get(word.id)
  if (!all) {
    all = findClozes(word, items)
    cache.map.set(word.id, all)
  }
  if (!all.length) return null
  let h = 0
  for (const ch of word.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return all[(h + day) % all.length]
}

function findClozes(word: Item, items: Item[]): Cloze[] {
  const sentences = contextIndex(items).get(word.id) ?? []
  const kana = katakanaToHiragana(word.kana)
  const stem = VERB_LIKE.has(word.pos) && kana.length > 1 ? kana.slice(0, -1) : null
  const out: Cloze[] = []
  for (const s of sentences) {
    const tokens = s.kana.split(/\s+/).filter(Boolean)
    if (tokens.length < 3) continue
    let index = tokens.findIndex((t) => katakanaToHiragana(t.replace(/[。、！？!?]/g, '')) === kana)
    if (index < 0 && stem && stem.length >= 2) index = tokens.findIndex((t) => katakanaToHiragana(t).startsWith(stem) && t.length <= stem.length + 6)
    if (index < 0) continue
    out.push({ sentence: s, tokens, index, answer: tokens[index].replace(/[。、！？!?]/g, '') })
    if (out.length >= 6) break
  }
  return out
}

/** Ta réponse est bonne si elle correspond au mot (kanji, kana, rōmaji) ou à la forme exacte de la phrase. */
export function checkCloze(word: Item, cloze: Cloze, raw: string): TypedResult {
  const a = checkTyped(word, raw)
  if (a.ok || a.script === 'vide') return a
  const asWritten: Item = { ...word, jp: cloze.answer, kana: cloze.answer, romaji: toRomaji(cloze.answer), alt: [] }
  const b = checkTyped(asWritten, raw)
  return b.ok ? b : a
}

export const isClozeKey = (cardKey: string) => cardKey.endsWith(':c')
