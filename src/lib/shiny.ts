/**
 * v1.11 — Cartes shiny (holographiques).
 *
 *   • « récupérée » : un mot raté au moins 3 fois, puis réussi 3 fois d'affilée, devient shiny pour toujours ;
 *   • « chanceuse » : à chaque révision, une carte sur 80 sort en shiny (tirage fixe pour une carte et un jour,
 *     le même sur tous tes appareils).
 * Une carte qui devient shiny est rangée dans ta collection : clé « sh:<carte> » dans `ach` (synchronisée).
 * XP : ×5 quand la carte sort en shiny chanceuse ou au moment où elle est récupérée (si tu la réussis : Bien ou Facile) ;
 * ×2 ensuite pour les cartes déjà dans ta collection.
 */
import type { CardState } from './scheduler'
import { misses } from './scheduler'

export const SHINY_ODDS = 80
export const SHINY_MULT = 5
export const COLLECTION_MULT = 2
export const RECOVER_MISSES = 3
export const RECOVER_STREAK = 3

export const shinyKey = (cardKey: string) => `sh:${cardKey}`

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Tirage du jour : une carte sur 80 environ. */
export const isLucky = (cardKey: string, day: string): boolean => hash(`${cardKey}|${day}`) % SHINY_ODDS === 0

/** Mot difficile récupéré : raté au moins 3 fois, puis réussi 3 fois d'affilée. */
export const isRecovered = (c: CardState | undefined): boolean => !!c && misses(c) >= RECOVER_MISSES && (c.w ?? 0) >= RECOVER_STREAK

export type ShinyKind = 'lucky' | 'collection' | null

/** Comment la carte s'affiche avant la réponse. */
export function shinyBefore(ach: Record<string, number>, cardKey: string, day: string, isNew: boolean): ShinyKind {
  if (ach[shinyKey(cardKey)]) return 'collection'
  if (!isNew && isLucky(cardKey, day)) return 'lucky'
  return null
}

export interface ShinyOutcome {
  /** multiplicateur d'XP de la réponse */
  mult: number
  /** la carte entre dans la collection à cette réponse */
  joins: boolean
  /** la carte vient d'être récupérée (mot difficile réussi 3 fois d'affilée) */
  recovered: boolean
}

/** Effet d'une réponse : `before` = affichage avant la réponse, `next` = carte après la réponse. */
export function shinyOutcome(before: ShinyKind, next: CardState, rating: number, inCollection: boolean): ShinyOutcome {
  const success = rating >= 4
  const recovered = !inCollection && isRecovered(next) && success
  if (recovered) return { mult: SHINY_MULT, joins: true, recovered: true }
  if (before === 'lucky' && success) return { mult: SHINY_MULT, joins: !inCollection, recovered: false }
  if (before === 'collection' && success) return { mult: COLLECTION_MULT, joins: false, recovered: false }
  return { mult: 1, joins: false, recovered: false }
}

export const shinyCount = (ach: Record<string, number>): number => Object.keys(ach).filter((k) => k.startsWith('sh:')).length
