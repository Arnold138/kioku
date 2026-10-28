/**
 * v1.12 — Le parchemin d'or : chaque kanji d'un mot SOLIDE (révision à 21 jours ou plus, sens japonais → français)
 * s'inscrit en encre dorée. Les kanji des mots retenus mais pas encore solides sont écrits à l'encre noire.
 * Rien n'est stocké : tout vient de tes cartes.
 */
import type { AppState } from './state'
import type { Item } from './deck'
import { isKnown, isMature } from './scheduler'

const KANJI = /[一-鿿]/

export interface ScrollKanji {
  ch: string
  gold: boolean
  /** nombre de tes mots (retenus) qui l'utilisent */
  words: number
  /** un mot exemple */
  example: { jp: string; fr: string }
}

export function scrollKanji(state: AppState, items: Item[]): ScrollKanji[] {
  const map = new Map<string, ScrollKanji>()
  const sorted = [...items].filter((it) => it.kind === 'word' || it.kind === 'custom').sort((a, b) => a.order - b.order)
  for (const it of sorted) {
    const c = state.cards[`${it.id}:r`]
    if (!c || !isKnown(c)) continue
    const gold = isMature(c)
    for (const ch of new Set([...it.jp].filter((x) => KANJI.test(x)))) {
      const cur = map.get(ch)
      if (cur) {
        cur.words++
        if (gold && !cur.gold) {
          cur.gold = true
          cur.example = { jp: it.jp, fr: it.fr }
        }
      } else map.set(ch, { ch, gold, words: 1, example: { jp: it.jp, fr: it.fr } })
    }
  }
  return [...map.values()]
}

export const goldCount = (list: ScrollKanji[]) => list.filter((k) => k.gold).length
