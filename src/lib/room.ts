// v1.15 / v1.16 — La chambre d'étude : livres, heure du soleil et météo.
// Logique pure (testée) ; le rendu WebGL est dans roomGl.ts, le composant dans RoomScene.tsx.

/**
 * v1.16 — Les livres de la chambre.
 * Points : 1 par mot retenu, 3 par phrase retenue. Un livre de plus sur la pile tous les ROOM_EVERY points,
 * comptés depuis l'installation de la v1.16 (repère `m:chambre16` dans `ach`).
 */
export const ROOM_EVERY = 25
export const ROOM_SENTENCE_POINTS = 3
/** Livres peints de la pile au pied du lit, révélés du bas vers le haut. */
export const ROOM_TOTAL = 6
export const ROOM_BASE_KEY = 'm:chambre16'

/** Ampoules et bougies qui scintillent (coordonnées dans la peinture 1136 × 1408). */
export const ROOM_BULBS: Array<[number, number]> = [[882.8, 308.5], [1110.1, 63.5], [32.2, 83.3], [139.2, 135.0], [202.2, 163.6], [809.3, 178.4], [103.0, 99.5], [260.3, 194.2], [721.2, 175.0], [887.4, 214.3], [282.5, 440.3], [825.0, 389.0], [77.4, 66.2], [230.1, 161.1], [455.8, 177.4], [867.4, 147.9], [798.7, 179.4], [306.5, 210.2], [181.6, 140.8], [890.1, 149.3], [304.4, 281.4], [284.5, 389.9], [417.3, 193.5], [284.5, 335.3], [364.6, 200.6], [879.9, 215.3], [310.0, 237.0], [776.4, 172.7]]

/** Points d'apprentissage : mots retenus + 3 × phrases retenues. */
export function roomPoints(p: { wordsKnownR: number; sentencesKnown: number }): number {
  return Math.max(0, p.wordsKnownR) + ROOM_SENTENCE_POINTS * Math.max(0, p.sentencesKnown)
}

/** Repère enregistré dans `ach` : points au premier lancement de la v1.16, + 1 (une valeur 0 serait ignorée à la synchro). */
export function roomBase(ach: Record<string, number>, points: number): number {
  const v = ach[ROOM_BASE_KEY]
  return v ? v - 1 : points
}

/** Nombre de livres posés sur la pile. */
export function roomBooks(points: number, base: number): number {
  return Math.max(0, Math.min(ROOM_TOTAL, Math.floor((points - base) / ROOM_EVERY)))
}

/** Prochain livre : son numéro et les points qu'il manque (null si la pile est complète). */
export function nextRoomBook(points: number, base: number): { n: number; left: number } | null {
  const n = roomBooks(points, base)
  if (n >= ROOM_TOTAL) return null
  return { n: n + 1, left: base + (n + 1) * ROOM_EVERY - points }
}

/** Pose le repère au premier lancement (ne change rien s'il existe déjà). */
export function withRoomBase<T extends { ach: Record<string, number> }>(state: T, points: number): T {
  if (state.ach[ROOM_BASE_KEY]) return state
  return { ...state, ach: { ...state.ach, [ROOM_BASE_KEY]: Math.max(0, Math.floor(points)) + 1 } }
}

// ───────────── Heure du soleil ─────────────
/** Valence (Drôme) — lieu fixe, aucune autorisation demandée au téléphone. */
export const VALENCE = { lat: 44.93, lon: 4.89 }

/** Hauteur du soleil au-dessus de l'horizon, en degrés (formule astronomique simplifiée, précise à ~1°). */
export function sunElevation(date: Date, lat = VALENCE.lat, lon = VALENCE.lon): number {
  const rad = Math.PI / 180
  const d = date.getTime() / 864e5 + 2440587.5 - 2451545
  const g = (357.529 + 0.98560028 * d) * rad
  const q = 280.459 + 0.98564736 * d
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad
  const e = (23.439 - 3.6e-7 * d) * rad
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))
  const dec = Math.asin(Math.sin(e) * Math.sin(L))
  const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24
  const ha = (gmst * 15 + lon) * rad - ra
  return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad
}

export interface Phase { day: number; dusk: number; night: number }

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Jour au-dessus de 10°, nuit sous −10°, crépuscule (ou aube) entre les deux, avec des fondus doux. */
export function phaseFromElevation(elev: number): Phase {
  const day = smooth(3, 10, elev)
  const night = smooth(-3, -10, elev)
  return { day, night, dusk: Math.max(0, 1 - day - night) }
}

/** Réglage « Ciel » : 'auto' suit le soleil ; sinon l'heure est figée (aube = crépuscule). */
export function roomPhase(setting: string | undefined, date: Date): Phase {
  if (setting === 'jour') return { day: 1, dusk: 0, night: 0 }
  if (setting === 'nuit') return { day: 0, dusk: 0, night: 1 }
  if (setting === 'aube') return { day: 0, dusk: 1, night: 0 }
  return phaseFromElevation(sunElevation(date))
}

// ───────────── Météo ─────────────
export interface Weather { rain: number; cloud: number }
export type WeatherSetting = 'auto' | 'pluie' | 'nuages' | 'clair'

export const WEATHER: Record<Exclude<WeatherSetting, 'auto'>, Weather> = {
  pluie: { rain: 1, cloud: 0.9 },
  nuages: { rain: 0, cloud: 1 },
  clair: { rain: 0, cloud: 0.15 },
}

/** Code météo Open-Meteo (WMO) → pluie / nuages. Neige et brouillard : ciel couvert. */
export function weatherFromCode(code: number): Weather {
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return WEATHER.pluie
  if ([2, 3, 45, 48, 71, 73, 75, 77, 85, 86].includes(code)) return WEATHER.nuages
  return { rain: 0, cloud: code === 1 ? 0.35 : 0.15 }
}

const WX_CACHE = 'kioku:meteo' // hors sauvegarde : simple cache de l'appareil
const WX_TTL = 30 * 60_000

/** Météo actuelle à Valence (Open-Meteo, gratuit, sans clé), gardée 30 min. null si hors ligne. */
export async function fetchWeather(now = Date.now()): Promise<Weather | null> {
  try {
    const c = JSON.parse(localStorage.getItem(WX_CACHE) || 'null') as { t: number; code: number } | null
    if (c && now - c.t < WX_TTL) return weatherFromCode(c.code)
  } catch { /* cache illisible : on refait la requête */ }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${VALENCE.lat}&longitude=${VALENCE.lon}&current=weather_code`
    const r = await fetch(url)
    if (!r.ok) return null
    const j = await r.json()
    const code = Number(j?.current?.weather_code)
    if (!Number.isFinite(code)) return null
    try { localStorage.setItem(WX_CACHE, JSON.stringify({ t: now, code })) } catch { /* stockage plein : sans importance */ }
    return weatherFromCode(code)
  } catch {
    return null
  }
}

/** Météo à afficher : réglage figé, sinon la vraie météo, sinon pluie (le tableau d'origine). */
export function roomWeather(setting: WeatherSetting | undefined, real: Weather | null): Weather {
  if (setting && setting !== 'auto') return WEATHER[setting]
  return real ?? WEATHER.pluie
}
