// Aide à la lecture qui s'efface peu à peu : plus une carte est solide, moins on affiche de béquilles.
//   carte jeune / fragile → kanji + kana + rōmaji
//   intervalle ≥ 21 jours  → kanji + kana (le rōmaji disparaît)
//   intervalle ≥ 60 jours  → kanji seul (le kana disparaît aussi)
// Un tap sur « Voir la lecture » affiche tout, à tout moment. Rien n'est stocké : c'est calculé à partir de l'intervalle.
import type { CardState } from './scheduler'
import type { Item } from './deck'

export type Aid = 'full' | 'kana' | 'none'

export const AID_KANA_AT = 21
export const AID_NONE_AT = 60

export const hasKanji = (s: string) => /[一-鿿]/.test(s)

export function aidLevel(card: CardState | undefined, it: Item, enabled: boolean): Aid {
  if (!enabled || !card || card.s !== 'review') return 'full'
  if (card.i >= AID_NONE_AT) return 'none'
  if (card.i >= AID_KANA_AT) return 'kana'
  return 'full'
}

/** Combien de mots (reconnaissance) se lisent déjà avec chaque niveau d'aide. */
export function aidCounts(cards: Record<string, CardState>, items: Item[]) {
  let noRomaji = 0
  let noAid = 0
  for (const it of items) {
    if (it.kind !== 'word') continue
    const c = cards[`${it.id}:r`]
    if (!c || c.s !== 'review') continue
    if (c.i >= AID_NONE_AT) noAid++
    else if (c.i >= AID_KANA_AT) noRomaji++
  }
  return { noRomaji: noRomaji + noAid, noAid }
}
