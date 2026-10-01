import wordsJson from '../data/words.json'
import sentencesJson from '../data/sentences.json'
import videoJson from '../data/video.json'
import { toRomaji } from './romaji'

export type Level = 'N5' | 'N4' | 'N3' | 'Perso'
export type Kind = 'word' | 'sentence' | 'custom'
export type Dir = 'r' | 'p' // r = reconnaissance (JP→FR) · p = production (FR→JP)

export interface Item {
  id: string // w12 · s3 · c-xxxx
  kind: Kind
  jp: string
  kana: string
  romaji: string
  fr: string
  pos: string
  lvl: Level
  deck: string
  order: number
  note?: string
  alt?: string[]
}

export interface CustomCard {
  id: string
  jp: string
  kana: string
  fr: string
  note?: string
  t: number // dernière modification
  del?: boolean
}

export const POS_LABEL: Record<string, string> = {
  n: 'nom', v: 'verbe', i: 'adjectif en い', na: 'adjectif en な', adv: 'adverbe', pron: 'pronom',
  num: 'nombre', conj: 'conjonction', ex: 'expression', adj: 'adjectif', pre: 'préfixe', part: 'particule',
  phrase: 'phrase', perso: 'perso'
}

export interface DeckInfo {
  id: string
  name: string
  sub: string
  emoji: string
  hue: number
  /** deck de phrases (pas de filtre « type de mots » ni de thème) */
  sentences?: boolean
  /** n'entre jamais dans les nouvelles cartes du jour : on ne l'étudie que si on le choisit (Réviser librement) */
  optIn?: boolean
}

export const DECKS: DeckInfo[] = [
  { id: 'N5', name: 'Essentiels N5', sub: 'Les mots de base', emoji: '🌱', hue: 145 },
  { id: 'N4', name: 'Courants N4', sub: 'Vie quotidienne', emoji: '🌿', hue: 175 },
  { id: 'N3', name: 'Fréquents N3', sub: 'Vers l\'intermédiaire', emoji: '🌳', hue: 215 },
  { id: 'phrases', name: 'Phrases', sub: 'À traduire dans la tête', emoji: '💬', hue: 280, sentences: true },
  { id: 'vid1', name: 'Vidéo · Shopping', sub: 'Ken, balade à Taipei', emoji: '🛍️', hue: 340, sentences: true, optIn: true },
  { id: 'vid2', name: 'Vidéo · Loisirs', sub: 'Conversation avec Ayano', emoji: '🎧', hue: 195, sentences: true, optIn: true },
  { id: 'perso', name: 'Mes cartes', sub: 'Vidéos, animés, notes', emoji: '⭐', hue: 35, sentences: true }
]
export const deckInfo = (id: string): DeckInfo | undefined => DECKS.find((d) => d.id === id)
export const isOptIn = (deckId: string): boolean => !!deckInfo(deckId)?.optIn

interface RawWord { id: number; jp: string; kana: string; fr: string; pos: string; lvl: string; o: number; alt?: string[] }
interface RawSentence { id: number; jp: string; kana: string; fr: string; lvl: string; theme: string }
interface RawVideo { id: string; jp: string; kana: string; fr: string }

// Les phrases sont réparties parmi les mots (N5 avec N5, N4 avec N4) pour varier les séances.
const SENT_RANGE: Record<string, [number, number]> = { N5: [0, 677], N4: [677, 638] }
const sentByLvl: Record<string, number> = {}
;(sentencesJson as RawSentence[]).forEach((s) => (sentByLvl[s.lvl] = (sentByLvl[s.lvl] ?? 0) + 1))
const sentSeen: Record<string, number> = {}
const sentenceOrder = (s: RawSentence): number => {
  const [base, size] = SENT_RANGE[s.lvl] ?? [1315, 685]
  const k = (sentSeen[s.lvl] = (sentSeen[s.lvl] ?? -1) + 1)
  return base + ((k + 0.5) / sentByLvl[s.lvl]) * size
}

const BASE_ITEMS: Item[] = [
  ...(wordsJson as RawWord[]).map<Item>((w) => ({
    id: `w${w.id}`,
    kind: 'word',
    jp: w.jp,
    kana: w.kana,
    romaji: toRomaji(w.kana),
    fr: w.fr,
    pos: w.pos,
    lvl: w.lvl as Level,
    deck: w.lvl,
    order: w.o,
    alt: w.alt
  })),
  ...(sentencesJson as RawSentence[]).map<Item>((s) => ({
    id: `s${s.id}`,
    kind: 'sentence',
    jp: s.jp,
    kana: s.kana,
    romaji: toRomaji(s.kana),
    fr: s.fr,
    pos: 'phrase',
    lvl: s.lvl as Level,
    deck: 'phrases',
    order: sentenceOrder(s),
    note: s.theme
  }))
]

// Phrases tirées des deux vidéos : dans l'ordre de la vidéo.
const VIDEO_ITEMS: Item[] = (videoJson as RawVideo[]).map<Item>((v) => {
  const first = v.id.startsWith('v1')
  const n = Number(v.id.split('-')[1])
  return {
    id: v.id,
    kind: 'sentence',
    jp: v.jp,
    kana: v.kana,
    romaji: toRomaji(v.kana),
    fr: v.fr,
    pos: 'phrase',
    lvl: first ? 'N4' : 'N3',
    deck: first ? 'vid1' : 'vid2',
    order: 400000 + (first ? 0 : 1000) + n,
    note: first ? 'Vidéo Shopping' : 'Vidéo Loisirs'
  }
})
BASE_ITEMS.push(...VIDEO_ITEMS)

const baseById = new Map(BASE_ITEMS.map((i) => [i.id, i]))

export function customToItem(c: CustomCard, index: number): Item {
  return {
    id: c.id,
    kind: 'custom',
    jp: c.jp,
    kana: c.kana,
    romaji: toRomaji(c.kana || c.jp),
    fr: c.fr,
    pos: 'perso',
    lvl: 'Perso',
    deck: 'perso',
    order: 200000 + index,
    note: c.note
  }
}

export function buildCatalog(custom: Record<string, CustomCard>): { items: Item[]; byId: Map<string, Item> } {
  const customItems = Object.values(custom)
    .filter((c) => !c.del)
    .sort((a, b) => a.t - b.t)
    .map(customToItem)
  const items = [...BASE_ITEMS, ...customItems]
  const byId = new Map(baseById)
  customItems.forEach((c) => byId.set(c.id, c))
  return { items, byId }
}

export const baseItems = BASE_ITEMS
export const cardId = (itemId: string, dir: Dir) => `${itemId}:${dir}`
export const parseCardId = (id: string): { itemId: string; dir: Dir } => {
  const [itemId, dir] = id.split(':')
  return { itemId, dir: dir as Dir }
}

export function matchesSearch(it: Item, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return (
    it.jp.toLowerCase().includes(s) ||
    it.kana.includes(s) ||
    it.romaji.includes(s.replace(/\s+/g, ' ')) ||
    it.fr.toLowerCase().includes(s)
  )
}
