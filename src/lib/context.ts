// « Mot en contexte » : pour un mot, retrouve des phrases réelles (phrases du deck, vidéos) qui l'utilisent.
// Les phrases des vidéos (japonais parlé par un natif) passent en premier.
import type { Item } from './deck'
import { hasKanji } from './aid'
import { toRomaji } from './romaji'
import examplesJson from '../data/examples.json'

/** Phrases d'exemple écrites pour les mots qui n'apparaissent dans aucune phrase réelle (src/data/examples.json). */
const EXAMPLES = examplesJson as Record<string, { jp: string; kana: string; fr: string }>
export function exampleFor(wordId: string): Item | undefined {
  const e = EXAMPLES[wordId]
  if (!e) return undefined
  return { id: `ex:${wordId}`, kind: 'sentence', jp: e.jp, kana: e.kana, romaji: toRomaji(e.kana), fr: e.fr, pos: 'phrase', lvl: 'N5', deck: 'exemples', order: 0, note: 'Exemple' }
}

const isKanji = (ch: string | undefined) => !!ch && /[一-鿿]/.test(ch)

/** `needle` apparaît dans `hay` sans être collé à un autre kanji (évite « 行 » dans « 銀行 »). */
function includesStandalone(hay: string, needle: string): boolean {
  let from = 0
  for (;;) {
    const i = hay.indexOf(needle, from)
    if (i < 0) return false
    const before = hay[i - 1]
    const after = hay[i + needle.length]
    const edgeKanji = isKanji(needle[0]) || isKanji(needle[needle.length - 1])
    if (!edgeKanji || ((!isKanji(needle[0]) || !isKanji(before)) && (!isKanji(needle[needle.length - 1]) || !isKanji(after)))) return true
    from = i + 1
  }
}

const VERB_LIKE = new Set(['v', 'i'])

function stemOf(it: Item): { jp: string; kana: string } {
  // verbes et adjectifs en い : on retire la dernière syllabe (mot de dictionnaire → radical)
  if (VERB_LIKE.has(it.pos) && it.jp.length > 1) return { jp: it.jp.slice(0, -1), kana: it.kana.slice(0, -1) }
  return { jp: it.jp, kana: it.kana }
}

export function matchesWord(word: Item, sentence: Item): boolean {
  const tokens = sentence.kana.split(/\s+/).filter(Boolean)
  // 1. le mot exact, en kana, comme mot entier de la phrase
  if (word.kana.length >= 2 && tokens.includes(word.kana)) return true
  const stem = stemOf(word)
  // 2. forme conjuguée : un mot de la phrase commence par le radical (≥ 2 kana)
  if (VERB_LIKE.has(word.pos) && stem.kana.length >= 2 && tokens.some((t) => t.startsWith(stem.kana) && t.length <= stem.kana.length + 6)) return true
  // 3. écriture en kanji
  if (hasKanji(word.jp)) {
    const needle = VERB_LIKE.has(word.pos) ? stem.jp : word.jp
    if (needle && hasKanji(needle) && includesStandalone(sentence.jp, needle)) return true
  }
  return false
}

const SOURCE_RANK: Record<string, number> = { vid3: 0, vid1: 0, vid2: 0, phrases: 1, perso: 2 }

/** Index mot → phrases (max 2), calculé une fois par catalogue. */
export function buildContextIndex(items: Item[]): Map<string, Item[]> {
  const sentences = items.filter((i) => i.kind === 'sentence' || (i.kind === 'custom' && i.jp.length > 6))
  const out = new Map<string, Item[]>()
  for (const w of items) {
    if (w.kind !== 'word') continue
    const hits: Item[] = []
    for (const s of sentences) {
      if (s.jp.length > 60) continue
      if (matchesWord(w, s)) hits.push(s)
    }
    hits.sort((a, b) => (SOURCE_RANK[a.deck] ?? 3) - (SOURCE_RANK[b.deck] ?? 3) || Math.abs(a.jp.length - 16) - Math.abs(b.jp.length - 16))
    const ex = exampleFor(w.id)
    const picked = hits.slice(0, 2)
    // un exemple écrit complète seulement s'il reste de la place (les vraies phrases passent d'abord)
    if (ex && picked.length < 2) picked.push(ex)
    if (picked.length) out.set(w.id, picked)
  }
  return out
}

let cache: { key: number; idx: Map<string, Item[]> } | null = null
export function contextFor(word: Item, items: Item[]): Item[] {
  if (word.kind !== 'word') return []
  if (!cache || cache.key !== items.length) cache = { key: items.length, idx: buildContextIndex(items) }
  return cache.idx.get(word.id) ?? []
}
