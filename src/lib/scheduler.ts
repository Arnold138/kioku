// Moteur de répétition espacée inspiré d'Anki (SM-2 modifié) avec 5 niveaux de réponse.
//
// Étapes d'apprentissage : 1 min → 10 min → (jour 1)
// Révisions : intervalle × facilité (ease), comme Anki.
// Oubli : la carte repart en réapprentissage (10 min), puis revient à 25 % de son ancien intervalle.

export type Rating = 1 | 2 | 3 | 4 | 5 // Oublié · Difficile · Hésitant · Bien · Facile
export type Stage = 'new' | 'learning' | 'review' | 'relearning'

export interface CardState {
  s: Stage
  st: number // index d'étape (apprentissage)
  e: number // facilité (ease)
  i: number // intervalle en jours (révision)
  d: number // échéance : ms (apprentissage) ou numéro de jour (révision)
  r: number // nombre de révisions
  l: number // nombre d'oublis (lapses)
  li: number // intervalle prévu après réapprentissage
  t: number // date de dernière modification (ms)
}

export const LEARN_STEPS = [1, 10] // minutes
export const RELEARN_STEPS = [10] // minutes
export const START_EASE = 2.5
export const MIN_EASE = 1.3
export const MAX_INTERVAL = 3650
export const GRADUATE_INTERVAL = 1
export const EASY_INTERVAL = 4
export const LAPSE_FACTOR = 0.25
export const MATURE_DAYS = 21

export const RATING_LABELS: Record<Rating, string> = {
  1: 'Oublié',
  2: 'Difficile',
  3: 'Hésitant',
  4: 'Bien',
  5: 'Facile'
}

const MIN = 60_000
const DAY_MS = 86_400_000
const ROLLOVER_H = 4 // le "jour" change à 4 h du matin, comme Anki

/** Numéro de jour local (change à 4 h du matin). */
export function dayNumber(now: number, tzOffsetMin = -new Date(now).getTimezoneOffset()): number {
  return Math.floor((now + tzOffsetMin * MIN - ROLLOVER_H * 60 * MIN) / DAY_MS)
}

export function dayKey(dn: number): string {
  return new Date(dn * DAY_MS + 12 * 3600_000).toISOString().slice(0, 10)
}

export function newCard(now = Date.now()): CardState {
  return { s: 'new', st: 0, e: START_EASE, i: 0, d: 0, r: 0, l: 0, li: 1, t: now }
}

const clampEase = (e: number) => Math.max(MIN_EASE, Math.round(e * 100) / 100)

function reviewInterval(c: CardState, rating: Rating): number {
  const prev = Math.max(c.i, 1)
  let ivl: number
  switch (rating) {
    case 2:
      ivl = prev * 1.2
      break
    case 3:
      ivl = prev * (1 + (c.e - 1) * 0.5)
      break
    case 4:
      ivl = prev * c.e
      break
    default:
      ivl = prev * c.e * 1.3
  }
  return Math.min(MAX_INTERVAL, Math.max(prev + 1, Math.round(ivl)))
}

const easeDelta: Record<Rating, number> = { 1: -0.2, 2: -0.15, 3: -0.05, 4: 0, 5: 0.15 }

export interface Outcome {
  card: CardState
  /** Délai avant la prochaine apparition, en minutes (apprentissage) ou jours (révision). */
  nextMinutes?: number
  nextDays?: number
}

/** Applique une réponse à une carte. `today` = numéro de jour courant. */
export function answer(card: CardState, rating: Rating, now: number, today: number): Outcome {
  const c: CardState = { ...card, t: now }
  const learningLike = c.s === 'new' || c.s === 'learning' || c.s === 'relearning'

  if (learningLike) {
    const steps = c.s === 'relearning' ? RELEARN_STEPS : LEARN_STEPS
    let step = c.s === 'new' ? 0 : c.st
    if (c.s === 'new') c.s = 'learning'
    c.r += 1

    const graduate = (days: number): Outcome => {
      c.s = 'review'
      c.st = 0
      c.i = Math.min(MAX_INTERVAL, Math.max(1, days))
      c.d = today + c.i
      return { card: c, nextDays: c.i }
    }
    const stay = (minutes: number, newStep = step): Outcome => {
      c.st = newStep
      c.d = now + minutes * MIN
      return { card: c, nextMinutes: minutes }
    }
    const lapseIvl = c.s === 'relearning' ? c.li : GRADUATE_INTERVAL

    switch (rating) {
      case 1:
        return stay(steps[0], 0)
      case 2:
        return stay(c.s === 'relearning' ? steps[step] : Math.max(steps[step], 5), step)
      case 3:
        return stay(steps[step] === steps[0] && steps.length > 1 ? steps[1] : steps[step], step)
      case 4:
        if (step + 1 < steps.length) return stay(steps[step + 1], step + 1)
        return graduate(lapseIvl)
      default:
        return graduate(c.s === 'relearning' ? c.li + 1 : EASY_INTERVAL)
    }
  }

  // Carte en révision
  c.r += 1
  if (rating === 1) {
    c.l += 1
    c.e = clampEase(c.e + easeDelta[1])
    c.li = Math.max(1, Math.round(c.i * LAPSE_FACTOR))
    c.s = 'relearning'
    c.st = 0
    c.d = now + RELEARN_STEPS[0] * MIN
    return { card: c, nextMinutes: RELEARN_STEPS[0] }
  }
  const ivl = reviewInterval(c, rating)
  c.e = clampEase(c.e + easeDelta[rating])
  c.i = ivl
  c.d = today + ivl
  return { card: c, nextDays: ivl }
}

/** Prévisualisation des 5 boutons : texte court (« 10 min », « 3 j »…). */
export function previewLabels(card: CardState, now: number, today: number): Record<Rating, string> {
  const out = {} as Record<Rating, string>
  ;([1, 2, 3, 4, 5] as Rating[]).forEach((r) => {
    const o = answer(card, r, now, today)
    out[r] = formatDelay(o)
  })
  return out
}

export function formatDelay(o: Outcome): string {
  if (o.nextMinutes !== undefined) return `${o.nextMinutes} min`
  const d = o.nextDays ?? 0
  if (d < 30) return `${d} j`
  if (d < 365) return `${Math.round((d / 30) * 10) / 10} mois`.replace('.', ',')
  return `${Math.round((d / 365) * 10) / 10} an`.replace('.', ',')
}

export const isDue = (c: CardState, now: number, today: number): boolean => {
  if (c.s === 'new') return false
  if (c.s === 'review') return c.d <= today
  return c.d <= now
}

export const isMature = (c: CardState) => c.s === 'review' && c.i >= MATURE_DAYS
/** "Connue" : sortie de l'apprentissage et intervalle ≥ 3 jours. */
export const isKnown = (c: CardState) => c.s === 'review' && c.i >= 3
