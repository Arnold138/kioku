// v1.15 — La chambre d'étude : paliers, heure du soleil et météo.
// Logique pure (testée) ; le rendu WebGL est dans roomGl.ts, le composant dans RoomScene.tsx.

/** Une amélioration tous les ROOM_EVERY mots retenus (sens japonais → français). */
export const ROOM_EVERY = 50

/** Objets peints révélés entre deux tableaux (4 tableaux → 3 transitions). */
export const ROOM_COUNTS = [8, 4, 4] as const
export const ROOM_REWARDS = [
  'Guirlande lumineuse', 'Grande plante', 'Plante sur le rebord', 'Deuxième plante sur le rebord',
  'Plante près de la fenêtre', 'Pile de livres', 'Pot à crayons', 'Plante au premier plan',
  "Bougie sur l'étagère", 'Plante suspendue', 'Étagère de livres', 'Plante près de la lampe',
  'Calligraphie 七転八起', 'Livres sur le bureau', 'Livres au sol', 'Tapis',
] as const
export const ROOM_TOTAL = ROOM_REWARDS.length

/** Ampoules et bougie qui scintillent, par tableau : [x, y, objet] (0 = déjà dans le tableau, n = n-ième objet révélé). */
export const ROOM_BULBS: Array<Array<[number, number, number]>> = [
  [[113.7, 408.2, 2], [131.9, 169.2, 1], [79.3, 489.7, 2], [180.1, 90.2, 1], [124.4, 250.6, 1]],
  [[113.7, 408.2, 0], [131.9, 169.2, 0], [79.3, 489.7, 0], [180.1, 90.2, 0], [124.4, 250.6, 0], [1110.6, 112.4, 1], [1015.1, 240.7, 2]],
  [[1110.6, 112.4, 0], [114, 407.5, 0], [132.1, 168.6, 0], [79.7, 488.4, 0], [180.3, 90, 0], [124.5, 249.7, 0], [1015.1, 240.7, 0]],
  [[1110.5, 112.7, 0], [126, 408.5, 0], [80, 489.4, 0], [181.2, 90.3, 0], [1015.5, 241.2, 0], [142.9, 169.4, 0], [135.9, 250.8, 0]],
]

/** Nombre d'améliorations débloquées pour un nombre de mots retenus. */
export function roomStep(words: number): number {
  return Math.max(0, Math.min(ROOM_TOTAL, Math.floor(Math.max(0, words) / ROOM_EVERY)))
}

/** Tableau affiché (k) et nombre d'objets du tableau suivant déjà révélés (p). */
export function roomPos(step: number): { k: number; p: number } {
  let k = 0
  let n = Math.max(0, Math.min(ROOM_TOTAL, Math.floor(step)))
  while (k < ROOM_COUNTS.length && n >= ROOM_COUNTS[k]) { n -= ROOM_COUNTS[k]; k++ }
  return { k, p: n }
}

/** Prochaine amélioration : son nom et le nombre de mots retenus qu'il faut atteindre (null si tout est débloqué). */
export function nextRoomReward(words: number): { name: string; at: number; left: number } | null {
  const n = roomStep(words)
  if (n >= ROOM_TOTAL) return null
  const at = (n + 1) * ROOM_EVERY
  return { name: ROOM_REWARDS[n], at, left: at - Math.max(0, words) }
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
