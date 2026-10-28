/**
 * v1.11 — Le village : une image vivante de ce que tu as appris.
 *
 * Rien n'est enregistré en plus dans la sauvegarde : tout est recalculé à partir de tes cartes.
 *   • un bâtiment par thème de vocabulaire (et un pour les verbes, un pour les adjectifs) ;
 *     il grandit avec le % de mots RETENUS du thème (terrain → cabane → maison → boutique illuminée) ;
 *   • des feuilles mortes sur les bâtiments dont des cartes attendent une révision ;
 *   • une ville par niveau JLPT (Shirakawa-gō N5, Nara N4, Kyoto N3, Osaka N2, Tokyo N1) :
 *     une ville s'ouvre quand le niveau d'avant est « solide » (80 % des mots retenus) ;
 *   • un monument par ville, construit quand son niveau est solide ;
 *   • des enseignes en japonais dont les kanji inconnus s'affichent en « ？ ».
 * Seules les phrases d'habitants comprises sont gardées, dans `ach` (clés « h:<jour>:<id> »).
 */
import type { AppState } from './state'
import type { Item, Level } from './deck'
import { dayKey, dayNumber, isDue, isKnown } from './scheduler'
import { inTheme } from './themes'
import { contextIndex } from './context'

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export const JLPT: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
/** Un niveau est « solide » quand 80 % de ses mots sont retenus. */
export const SOLID = 0.8

export interface City {
  lvl: JlptLevel
  id: string
  kanji: string
  name: string
  cefr: string
  monument: { kanji: string; name: string; kind: 'torii' | 'pagoda' | 'gate' | 'castle' | 'tower' }
}

export const CITIES: City[] = [
  { lvl: 'N5', id: 'shirakawa', kanji: '白川郷', name: 'Shirakawa-gō', cefr: 'A1', monument: { kanji: '鳥居', name: 'Le torii', kind: 'torii' } },
  { lvl: 'N4', id: 'nara', kanji: '奈良', name: 'Nara', cefr: 'A2', monument: { kanji: '五重塔', name: 'La pagode', kind: 'pagoda' } },
  { lvl: 'N3', id: 'kyoto', kanji: '京都', name: 'Kyoto', cefr: 'B1', monument: { kanji: '山門', name: 'La porte du temple', kind: 'gate' } },
  { lvl: 'N2', id: 'osaka', kanji: '大阪', name: 'Osaka', cefr: 'B2', monument: { kanji: '大阪城', name: 'Le château', kind: 'castle' } },
  { lvl: 'N1', id: 'tokyo', kanji: '東京', name: 'Tokyo', cefr: 'C1', monument: { kanji: '東京塔', name: 'La tour', kind: 'tower' } }
]

export type Stage = 0 | 1 | 2 | 3
export const STAGES = ['Terrain', 'Cabane', 'Maison', 'Boutique illuminée'] as const
/** Paliers (part des mots retenus) pour passer à la cabane, à la maison, à la boutique illuminée. */
export const STAGE_AT = [0.1, 0.4, 0.75] as const
export const stageOf = (pct: number): Stage => (pct >= STAGE_AT[2] ? 3 : pct >= STAGE_AT[1] ? 2 : pct >= STAGE_AT[0] ? 1 : 0)

export interface BuildingDef {
  id: string
  /** kanji de l'icône */
  icon: string
  /** enseigne (en japonais) */
  sign: string
  label: string
  /** dessin dans la scène */
  shape: 'shop' | 'shrine' | 'house' | 'school' | 'station' | 'hall'
  match: (it: Item) => boolean
}

const theme = (t: string) => (it: Item) => inTheme(it.id, t)

export const BUILDINGS: BuildingDef[] = [
  { id: 'nourriture', icon: '食', sign: 'ラーメン屋', label: 'Nourriture', shape: 'shop', match: theme('nourriture') },
  { id: 'verbes', icon: '動', sign: '神社', label: 'Verbes', shape: 'shrine', match: (it) => it.pos === 'v' },
  { id: 'lieux', icon: '駅', sign: '駅', label: 'Lieux & transports', shape: 'station', match: theme('lieux') },
  { id: 'ecole_travail', icon: '学', sign: '学校', label: 'École & travail', shape: 'school', match: theme('ecole_travail') },
  { id: 'maison', icon: '家', sign: '家', label: 'Maison & objets', shape: 'house', match: theme('maison') },
  { id: 'adjectifs', icon: '美', sign: '庭園', label: 'Adjectifs', shape: 'hall', match: (it) => it.pos === 'i' || it.pos === 'na' },
  { id: 'famille', icon: '族', sign: '長屋', label: 'Famille & personnes', shape: 'house', match: theme('famille') },
  { id: 'temps', icon: '時', sign: '時計台', label: 'Temps & calendrier', shape: 'hall', match: theme('temps') },
  { id: 'meteo', icon: '天', sign: '公園', label: 'Météo & nature', shape: 'hall', match: theme('meteo') },
  { id: 'corps', icon: '体', sign: '病院', label: 'Corps & santé', shape: 'school', match: theme('corps') },
  { id: 'vetements', icon: '服', sign: '呉服屋', label: 'Vêtements & couleurs', shape: 'shop', match: theme('vetements') },
  { id: 'loisirs', icon: '遊', sign: '劇場', label: 'Loisirs & culture', shape: 'hall', match: theme('loisirs') },
  { id: 'emotions', icon: '心', sign: '茶屋', label: 'Émotions & caractère', shape: 'shop', match: theme('emotions') },
  { id: 'nombres', icon: '数', sign: '銀行', label: 'Nombres & quantités', shape: 'station', match: theme('nombres') },
  { id: 'animaux', icon: '犬', sign: '牧場', label: 'Animaux', shape: 'house', match: theme('animaux') },
  { id: 'tech', icon: '話', sign: '郵便局', label: 'Communication', shape: 'station', match: theme('tech') }
]

export interface Building extends BuildingDef {
  total: number
  known: number
  pct: number
  stage: Stage
  /** cartes à revoir (feuilles à balayer) */
  leaves: number
}

const recKey = (it: Item) => `${it.id}:r`

/** Les bâtiments d'une ville : seulement les mots de son niveau. */
export function buildingsFor(state: AppState, items: Item[], lvl: JlptLevel, now = Date.now()): Building[] {
  const today = dayNumber(now)
  const words = items.filter((it) => it.kind === 'word' && it.lvl === (lvl as Level))
  return BUILDINGS.map((b) => {
    let total = 0
    let known = 0
    let leaves = 0
    for (const it of words) {
      if (!b.match(it)) continue
      total++
      const c = state.cards[recKey(it)]
      if (!c) continue
      if (isKnown(c)) known++
      if (isDue(c, now, today)) leaves++
    }
    const pct = total ? known / total : 0
    return { ...b, total, known, pct, stage: stageOf(pct), leaves }
  }).filter((b) => b.total >= 3)
}

export interface LevelProgress {
  lvl: JlptLevel
  total: number
  known: number
  pct: number
  solid: boolean
}

export function levelProgress(state: AppState, items: Item[]): LevelProgress[] {
  const acc: Record<string, { total: number; known: number }> = {}
  for (const it of items) {
    if (it.kind !== 'word') continue
    const a = (acc[it.lvl] ??= { total: 0, known: 0 })
    a.total++
    const c = state.cards[recKey(it)]
    if (c && isKnown(c)) a.known++
  }
  return JLPT.map((lvl) => {
    const a = acc[lvl] ?? { total: 0, known: 0 }
    const pct = a.total ? a.known / a.total : 0
    return { lvl, total: a.total, known: a.known, pct, solid: a.total > 0 && pct >= SOLID }
  })
}

export interface CityStatus extends City {
  unlocked: boolean
  /** le niveau de la ville n'a pas encore de mots dans l'app (N2, N1) */
  noWords: boolean
  progress: LevelProgress
  /** avancement du monument (0 → 1, construit à 1) */
  monumentPct: number
  built: boolean
}

export function cityStatuses(state: AppState, items: Item[]): CityStatus[] {
  const lp = levelProgress(state, items)
  return CITIES.map((c, i) => {
    const p = lp[i]
    const unlocked = i === 0 || lp[i - 1].solid
    return { ...c, unlocked, noWords: p.total === 0, progress: p, monumentPct: Math.min(1, p.pct / SOLID), built: p.solid }
  })
}

/** La ville que tu construis en ce moment : la plus avancée des villes ouvertes qui ont des mots. */
export function currentCity(cities: CityStatus[]): CityStatus {
  const open = cities.filter((c) => c.unlocked && !c.noWords)
  return open[open.length - 1] ?? cities[0]
}

// ───────────────────────── Enseignes ─────────────────────────
const KANJI = /[一-鿿々]/

/** Tous les kanji présents dans des mots retenus (sens japonais → français). */
export function knownKanji(state: AppState, items: Item[]): Set<string> {
  const out = new Set<string>()
  for (const it of items) {
    if (it.kind !== 'word' && it.kind !== 'custom') continue
    const c = state.cards[recKey(it)]
    if (!c || !isKnown(c)) continue
    for (const ch of it.jp) if (KANJI.test(ch)) out.add(ch)
  }
  return out
}

/** Une enseigne : chaque kanji encore inconnu est remplacé par « ？ ». */
export function signText(sign: string, kanji: Set<string>): { text: string; hidden: number } {
  let hidden = 0
  const text = [...sign]
    .map((ch) => {
      if (KANJI.test(ch) && !kanji.has(ch)) {
        hidden++
        return '？'
      }
      return ch
    })
    .join('')
  return { text, hidden }
}

// ───────────────────────── Habitants ─────────────────────────
export interface VillagerLine {
  id: string
  jp: string
  kana: string
  fr: string
  /** le mot récent que la phrase reprend */
  word: string
  speaker: string
}

const SPEAKERS = ['Tama, le chat', 'la marchande de ramen', 'le vieux moine', 'l\'écolière', 'le chef de gare', 'la grand-mère du quartier']

export const villagerKey = (day: string, id: string) => `h:${day}:${id}`
export const VILLAGER_XP = 10
export const VILLAGER_PER_DAY = 3

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Une phrase qui reprend un mot appris récemment (les 7 derniers jours d'abord), différente chaque jour. */
export function villagerLine(state: AppState, items: Item[], now = Date.now(), skip: string[] = []): VillagerLine | null {
  const idx = contextIndex(items)
  const day = dayKey(dayNumber(now))
  const recent: Array<{ it: Item; t: number }> = []
  for (const it of items) {
    if (it.kind !== 'word') continue
    const c = state.cards[recKey(it)]
    if (!c || !isKnown(c) || !idx.has(it.id)) continue
    recent.push({ it, t: c.t })
  }
  if (!recent.length) return null
  recent.sort((a, b) => b.t - a.t)
  const pool = recent.slice(0, 25)
  const seen = new Set(skip)
  for (let k = 0; k < pool.length; k++) {
    const w = pool[(hash(day) + k) % pool.length].it
    const sentences = idx.get(w.id) ?? []
    const s = sentences.find((x) => !seen.has(x.id))
    if (!s) continue
    return { id: s.id, jp: s.jp, kana: s.kana, fr: s.fr, word: w.jp, speaker: SPEAKERS[hash(s.id + day) % SPEAKERS.length] }
  }
  return null
}

export function villagerCount(ach: Record<string, number>, day?: string): number {
  let n = 0
  for (const k of Object.keys(ach)) if (k.startsWith('h:') && (!day || k.startsWith(`h:${day}:`))) n++
  return n
}

// ───────────────────────── Mission du jour ─────────────────────────
/** Le bâtiment le plus couvert de feuilles (pour le message de la mission du jour). */
export function dirtiest(buildings: Building[]): Building | null {
  const withLeaves = buildings.filter((b) => b.leaves > 0)
  if (!withLeaves.length) return null
  return withLeaves.sort((a, b) => b.leaves - a.leaves)[0]
}

// ───────────────────────── Statistiques (trophées du village) ─────────────────────────
export interface VillageStats {
  /** bâtiments sortis de terre (cabane ou plus), toutes villes ouvertes */
  built: number
  houses: number
  lit: number
  cities: number
  monuments: number
  /** feuilles balayées = révisions de cartes déjà apprises, depuis toujours */
  swept: number
  villagers: number
}

export function villageStats(state: AppState, items: Item[], now = Date.now()): VillageStats {
  const cities = cityStatuses(state, items)
  let built = 0
  let houses = 0
  let lit = 0
  for (const c of cities) {
    if (!c.unlocked || c.noWords) continue
    for (const b of buildingsFor(state, items, c.lvl, now)) {
      if (b.stage >= 1) built++
      if (b.stage >= 2) houses++
      if (b.stage >= 3) lit++
    }
  }
  let swept = 0
  for (const devs of Object.values(state.daily)) for (const d of Object.values(devs)) swept += d.rv ?? 0
  return {
    built,
    houses,
    lit,
    cities: cities.filter((c) => c.unlocked).length,
    monuments: cities.filter((c) => c.built).length,
    swept,
    villagers: villagerCount(state.ach)
  }
}

// ───────────────────────── Ciel ─────────────────────────
export type Sky = 'nuit' | 'aube' | 'jour'
/** Ciel selon l'heure : aube de 5 h à 8 h et de 18 h à 20 h, jour de 8 h à 18 h, nuit sinon. */
export function skyFor(hour: number): Sky {
  if (hour >= 8 && hour < 18) return 'jour'
  if ((hour >= 5 && hour < 8) || (hour >= 18 && hour < 20)) return 'aube'
  return 'nuit'
}
