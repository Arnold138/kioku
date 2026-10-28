/**
 * v1.12 — Fêtes de saison : un mini-deck de 15 mots par fête, aux vraies dates japonaises.
 * Apprends 12 mots sur 15 (retenus) pendant la fête pour gagner sa décoration dans ton village.
 * La décoration est rangée dans `ach` (« fe:<fête>:<année> ») : elle reste pour toujours, et la fête revient l'année suivante.
 */
import festivalsJson from '../data/festivals.json'
import type { AppState } from './state'
import type { Item } from './deck'
import { isKnown } from './scheduler'
import { toRomaji } from './romaji'

export interface Festival {
  id: string
  jp: string
  name: string
  /** du jour (mois, jour) au jour (mois, jour), inclus ; peut chevaucher le Nouvel An */
  from: [number, number]
  to: [number, number]
  reward: string
  /** couleur d'accent de la carte */
  hue: string
}

export const FESTIVALS: Festival[] = [
  { id: 'shogatsu', jp: 'お正月', name: 'Shōgatsu, le Nouvel An', from: [12, 26], to: [1, 15], reward: 'un kadomatsu devant le monument', hue: '#b91c1c' },
  { id: 'hanami', jp: '花見', name: 'Hanami, les cerisiers', from: [3, 15], to: [4, 30], reward: 'un cerisier en fleurs', hue: '#be185d' },
  { id: 'tanabata', jp: '七夕', name: 'Tanabata, la fête des étoiles', from: [6, 25], to: [7, 15], reward: 'un bambou couvert de vœux', hue: '#1d4ed8' },
  { id: 'natsu', jp: '夏祭り', name: 'Natsu matsuri, la fête d\'été', from: [7, 20], to: [8, 31], reward: 'une guirlande de lanternes', hue: '#c2410c' },
  { id: 'tsukimi', jp: 'お月見', name: 'Tsukimi, la lune d\'automne', from: [9, 10], to: [10, 10], reward: 'des dango et des herbes de la pampa', hue: '#4338ca' },
  { id: 'momiji', jp: '紅葉狩り', name: 'Momiji-gari, les feuilles d\'automne', from: [10, 15], to: [11, 30], reward: 'des érables rouges', hue: '#9a3412' }
]

export const FESTIVAL_GOAL = 12
export const FESTIVAL_DECK = 'fetes'

interface RawFestWord { jp: string; kana: string; fr: string; pos: string }
const RAW = festivalsJson as Record<string, RawFestWord[]>

/** Les mots des fêtes, comme des cartes (deck « fetes », niveau « Saison » : ils ne comptent pas dans ton niveau JLPT). */
export const FESTIVAL_ITEMS: Item[] = FESTIVALS.flatMap((f, fi) =>
  (RAW[f.id] ?? []).map<Item>((w, i) => ({
    id: `fe-${f.id}-${i + 1}`,
    kind: 'word',
    jp: w.jp,
    kana: w.kana,
    romaji: toRomaji(w.kana),
    fr: w.fr,
    pos: w.pos,
    lvl: 'Saison',
    deck: FESTIVAL_DECK,
    order: 500000 + fi * 100 + i,
    note: f.jp
  }))
)

const md = (m: number, d: number) => m * 100 + d

/** La fête en cours à cette date (ou aucune). */
export function activeFestival(date: Date): Festival | null {
  const x = md(date.getMonth() + 1, date.getDate())
  for (const f of FESTIVALS) {
    const a = md(...f.from)
    const b = md(...f.to)
    if (a <= b ? x >= a && x <= b : x >= a || x <= b) return f
  }
  return null
}

/** Année de la fête (le Nouvel An qui commence fin décembre compte pour l'année qui arrive). */
export function festivalYear(f: Festival, date: Date): number {
  const y = date.getFullYear()
  return f.from[0] > f.to[0] && date.getMonth() + 1 === 12 ? y + 1 : y
}

/** Dernier jour de la fête, en toutes lettres (« 30 novembre »). */
export function festivalEnd(f: Festival): string {
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${f.to[1] === 1 ? '1er' : f.to[1]} ${months[f.to[0] - 1]}`
}

export const festivalKey = (id: string, year: number) => `fe:${id}:${year}`
export const festivalItems = (id: string) => FESTIVAL_ITEMS.filter((it) => it.id.startsWith(`fe-${id}-`))

export function festivalProgress(state: AppState, id: string): { known: number; total: number; done: boolean } {
  const list = festivalItems(id)
  const known = list.filter((it) => {
    const c = state.cards[`${it.id}:r`]
    return !!c && isKnown(c)
  }).length
  return { known, total: list.length, done: known >= FESTIVAL_GOAL }
}

/** Décorations gagnées (toutes années confondues). */
export function earnedDecorations(ach: Record<string, number>): string[] {
  const out = new Set<string>()
  for (const k of Object.keys(ach)) if (k.startsWith('fe:')) out.add(k.split(':')[1])
  return [...out]
}
