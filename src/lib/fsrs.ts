// FSRS-5 — l'algorithme de répétition espacée moderne d'Anki (paramètres par défaut, sans hasard).
//
// Chaque carte a une « mémoire » :
//   • stabilité S (jours) : le temps au bout duquel tu as encore 90 % de chances de t'en souvenir ;
//   • difficulté D (1 → 10) : à quel point la carte résiste.
// À chaque réponse, S et D sont recalculés ; l'intervalle suivant est choisi pour que tu aies
// « rétention visée » (90 % par défaut) de chances de t'en souvenir le jour où la carte revient.
//
// Les 5 boutons de Kioku sont reliés aux 4 notes de FSRS :
//   Oublié → Again · Difficile → demi-raté (entre Again et Hard, voir plus bas) · Hésitant → Hard · Bien → Good · Facile → Easy

/** Paramètres par défaut de FSRS-5 (w0 … w18). */
export const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698,
  0.2315, 2.9898, 0.51655, 0.6621
] as const

const DECAY = -0.5
const FACTOR = 19 / 81 // avec DECAY = -0,5 : R(S jours) = 90 %
export const DEFAULT_RETENTION = 0.9
export const MIN_STABILITY = 0.1

export interface Memory {
  /** stabilité, en jours */
  s: number
  /** difficulté, de 1 à 10 */
  d: number
}

/** Note FSRS (1 = Again, 2 = Hard, 3 = Good, 4 = Easy). « Difficile » de Kioku = 1,5 (demi-raté). */
export type Grade = 1 | 1.5 | 2 | 3 | 4

const clampD = (d: number) => Math.min(10, Math.max(1, d))
const clampS = (s: number) => Math.max(MIN_STABILITY, s)

/** Probabilité de se souvenir après `elapsed` jours pour une stabilité `s`. */
export function retrievability(elapsed: number, s: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, elapsed)) / s, DECAY)
}

/** Intervalle (jours, non arrondi) pour atteindre la rétention visée. */
export function intervalFor(s: number, retention = DEFAULT_RETENTION): number {
  return (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)
}

const initD = (g: Grade) => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1)

function initS(g: Grade): number {
  if (g === 1.5) return Math.sqrt(W[0] * W[1]) // vague souvenir : entre « Oublié » et « Hésitant »
  return W[g - 1]
}

function nextD(d: number, g: Grade): number {
  const delta = -W[6] * (g - 3)
  const damped = d + (delta * (10 - d)) / 9 // plus la carte est difficile, moins elle peut le devenir encore
  return clampD(W[7] * initD(4) + (1 - W[7]) * damped) // léger retour vers la moyenne
}

/** Même jour (étapes d'apprentissage) : petite variation de la stabilité. */
const shortTermS = (s: number, g: number) => s * Math.exp(W[17] * (g - 3 + W[18]))

function recallS(m: Memory, r: number, g: 2 | 3 | 4): number {
  const hard = g === 2 ? W[15] : 1
  const easy = g === 4 ? W[16] : 1
  return m.s * (1 + Math.exp(W[8]) * (11 - m.d) * Math.pow(m.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy)
}

function forgetS(m: Memory, r: number): number {
  const s = W[11] * Math.pow(m.d, -W[12]) * (Math.pow(m.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))
  return Math.min(s, m.s)
}

/**
 * Nouvelle mémoire après une réponse.
 * `elapsed` = jours depuis la réponse précédente (0 = même jour, étapes d'apprentissage).
 */
export function nextMemory(m: Memory | null, g: Grade, elapsed: number): Memory {
  if (!m) return { s: clampS(initS(g)), d: initD(g) }
  const d = nextD(m.d, g)
  let s: number
  if (elapsed <= 0) {
    // même jour : variation courte ; Difficile ≈ Oublié mais garde au moins la moitié de la stabilité
    s = g === 1.5 ? Math.max(shortTermS(m.s, 1), m.s * 0.5) : shortTermS(m.s, g)
    if (g >= 3) s = Math.max(s, m.s) // une réussite ne fait jamais baisser la mémoire
  } else {
    const r = retrievability(elapsed, m.s)
    if (g === 1) s = forgetS(m, r)
    else if (g === 1.5) s = Math.min(m.s, Math.max(forgetS(m, r), m.s * 0.5)) // demi-raté : on garde la moitié (règle v1.7)
    else s = recallS(m, r, g)
  }
  return { s: clampS(s), d }
}

/**
 * Reprise de l'historique : estime la mémoire FSRS d'une carte à partir de son état actuel
 * (intervalle, facilité, oublis), comme le fait Anki quand on active FSRS sur un vieux paquet.
 * L'ancien planning visait ~90 % de réussite : la stabilité vaut donc à peu près l'intervalle,
 * et la facilité (ease) donne la difficulté (une facilité basse = une carte difficile).
 */
export function memoryFromSm2(ease: number, intervalDays: number): Memory {
  const s = clampS(Math.max(1, intervalDays))
  // facilité = facteur de croissance de S pour « Bien » à 90 % → on résout en D
  const k = Math.exp(W[8]) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - DEFAULT_RETENTION)) - 1)
  const d = clampD(11 - Math.max(0, ease - 1) / k)
  return { s, d: Math.round(d * 100) / 100 }
}
