// « Phrases naturelles » : phrases du japonais parlé (vidéos) glissées dans l'apprentissage.
// On choisit celles dont presque tous les mots font déjà partie de ce que tu connais : tu peux les comprendre, et c'est du japonais de la vraie vie.
import type { Item } from './deck'
import type { AppState } from './state'
import { isKnown } from './scheduler'

/** Phrase issue d'une vidéo (ids `v1-12`, `v2-5`, `v3-40`). */
export const isNaturalId = (id: string): boolean => /^v\d+-\d+$/.test(id)

const GRAMMAR = new Set([
  'は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'か', 'ね', 'よ', 'へ', 'や', 'から', 'まで', 'より', 'って', 'じゃ', 'ば', 'し',
  'です', 'ます', 'でした', 'ました', 'ません', 'でしょう', 'だ', 'だった', 'じゃない', 'ない', 'た', 'て', 'で', 'ください', 'ですか', 'ますか',
  'ちょっと', 'あの', 'えっと', 'ええ', 'はい', 'うん', 'ああ', 'まあ', 'あっ', 'えー', 'ねえ'
])

interface Known {
  exact: Set<string>
  stems: Map<string, string[]> // premier kana → radicaux (verbes, adjectifs en い)
}

let cache: { cards: AppState['cards']; n: number; known: Known } | null = null

function knownWords(state: AppState, items: Item[]): Known {
  if (cache && cache.cards === state.cards && cache.n === items.length) return cache.known
  const exact = new Set<string>()
  const stems = new Map<string, string[]>()
  for (const it of items) {
    if (it.kind !== 'word') continue
    const c = state.cards[`${it.id}:r`]
    if (!c || !isKnown(c)) continue
    exact.add(it.kana)
    if ((it.pos === 'v' || it.pos === 'i') && it.kana.length > 2) {
      const stem = it.kana.slice(0, -1)
      const list = stems.get(stem[0]) ?? []
      list.push(stem)
      stems.set(stem[0], list)
    }
  }
  const known = { exact, stems }
  cache = { cards: state.cards, n: items.length, known }
  return known
}

const tokenKnown = (t: string, k: Known): boolean => k.exact.has(t) || (k.stems.get(t[0])?.some((s) => t.startsWith(s) && t.length <= s.length + 6) ?? false)

export interface NaturalScore {
  item: Item
  known: number
  unknown: number
}

/** Mesure combien de mots d'une phrase tu connais déjà. */
export function scoreSentence(it: Item, k: Known): NaturalScore {
  let known = 0
  let unknown = 0
  for (const t of it.kana.split(/\s+/).filter(Boolean)) {
    if (GRAMMAR.has(t)) continue
    if (tokenKnown(t, k)) known++
    else unknown++
  }
  return { item: it, known, unknown }
}

/** Phrases de vidéos pas encore vues, presque entièrement composées de mots connus (au plus 1 mot nouveau). */
export function naturalSentences(state: AppState, items: Item[], n: number): Item[] {
  if (n <= 0) return []
  const k = knownWords(state, items)
  if (!k.exact.size) return []
  const out: NaturalScore[] = []
  for (const it of items) {
    if (it.kind !== 'sentence' || !isNaturalId(it.id)) continue
    const c = state.cards[`${it.id}:r`]
    if (c && c.s !== 'new') continue
    if (it.jp.length > 36 || it.jp.length < 5) continue
    const sc = scoreSentence(it, k)
    if (sc.known >= 2 && sc.unknown <= 1) out.push(sc)
  }
  out.sort((a, b) => a.unknown - b.unknown || b.known - a.known || a.item.order - b.item.order)
  return out.slice(0, n).map((x) => x.item)
}

/** Phrases naturelles à retenir après une séance : elles reprennent des mots que tu viens de voir. */
export function sentencesForWords(
  state: AppState,
  items: Item[],
  wordIds: string[],
  index: Map<string, Item[]>,
  n = 3
): Item[] {
  const seen = new Set<string>()
  const out: Item[] = []
  const k = knownWords(state, items)
  const cand: Array<{ it: Item; hits: number; unknown: number }> = []
  for (const w of wordIds) {
    for (const s of index.get(w) ?? []) {
      if (!isNaturalId(s.id) || seen.has(s.id)) continue
      seen.add(s.id)
      const c = state.cards[`${s.id}:r`]
      if (c && c.s !== 'new') continue
      if (s.jp.length > 40) continue
      cand.push({ it: s, hits: wordIds.filter((x) => (index.get(x) ?? []).some((y) => y.id === s.id)).length, unknown: scoreSentence(s, k).unknown })
    }
  }
  cand.sort((a, b) => b.hits - a.hits || a.unknown - b.unknown || a.it.order - b.it.order)
  for (const c of cand) {
    if (out.length >= n) break
    out.push(c.it)
  }
  return out
}
