/**
 * v1.6 — Récompenses : XP de l'écoute, combos, défis du jour et statistiques des trophées.
 *
 * ⚠️ Aucun nouveau champ dans la sauvegarde : tout l'historique est rangé dans `ach` (comme les examens « x: »),
 * sous forme de clés. Une ancienne version de l'app conserve ces clés telles quelles à la synchro.
 *   l:<m>:<ok>:<total>:<t>   une écoute terminée (m = s mots · p phrases · d dictée ; « s » = toutes les écoutes « sens » avant la v1.6)
 *   cb:<jour>:<palier>       un combo de <palier> bonnes réponses d'affilée atteint ce jour-là (5, 10, 20, 30, 50, 100)
 *   q:<jour>:<id>            un défi du jour réussi ; q:<jour>:all = les trois défis du jour réussis
 *   g:<jour>                 objectif du jour atteint (depuis la v1.0)
 */
import type { AppState } from './state'
import { dayTotal } from './state'
import { dayKey, dayNumber } from './scheduler'
import { examHistory } from './exam'

// ───────────────────────── Écoute ─────────────────────────
export type ListenMode = 's' | 'p' | 'd'

/** XP par bonne réponse : l'écoute rapporte plus qu'une carte (≈ 10 XP). */
export const LISTEN_XP_PER: Record<ListenMode, number> = { s: 15, p: 18, d: 20 }
export const LISTEN_XP_BASE = 10 // participation
export const LISTEN_XP_PERFECT = 50 // 10/10

/** Multiplicateur de combo pendant l'écoute (n-ième bonne réponse d'affilée). */
export function listenMult(streak: number): number {
  return streak >= 8 ? 1.6 : streak >= 5 ? 1.4 : streak >= 3 ? 1.2 : 1
}

export interface ListenReward {
  ok: number
  total: number
  /** XP des bonnes réponses, sans combo */
  answers: number
  /** XP en plus grâce aux combos */
  combo: number
  perfect: number
  base: number
  total_xp: number
  bestCombo: number
}

export function listenReward(mode: ListenMode, results: boolean[]): ListenReward {
  const per = LISTEN_XP_PER[mode]
  let streak = 0
  let best = 0
  let answers = 0
  let combo = 0
  for (const ok of results) {
    if (!ok) {
      streak = 0
      continue
    }
    streak++
    best = Math.max(best, streak)
    answers += per
    combo += per * (listenMult(streak) - 1)
  }
  const ok = results.filter(Boolean).length
  const total = results.length
  const perfect = total >= 10 && ok === total ? LISTEN_XP_PERFECT : 0
  const comboR = Math.round(combo)
  return { ok, total, answers, combo: comboR, perfect, base: LISTEN_XP_BASE, total_xp: LISTEN_XP_BASE + answers + comboR + perfect, bestCombo: best }
}

export const listenKey = (m: ListenMode, ok: number, total: number, t: number) => `l:${m}:${ok}:${total}:${t}`

export interface ListenRecord {
  mode: ListenMode
  ok: number
  total: number
  t: number
}

export function listenHistory(ach: Record<string, number>): ListenRecord[] {
  const out: ListenRecord[] = []
  for (const key of Object.keys(ach)) {
    if (!key.startsWith('l:')) continue
    const [, m, ok, total, t] = key.split(':')
    if (m !== 's' && m !== 'p' && m !== 'd') continue
    const rec = { mode: m as ListenMode, ok: Number(ok), total: Number(total), t: Number(t) }
    if (!Number.isFinite(rec.ok) || !Number.isFinite(rec.total) || !Number.isFinite(rec.t) || rec.total <= 0) continue
    out.push(rec)
  }
  return out.sort((a, b) => a.t - b.t)
}

const isPerfect = (r: ListenRecord) => r.total >= 10 && r.ok === r.total

// ───────────────────────── Combos (cartes) ─────────────────────────
export const COMBO_STEPS = [5, 10, 20, 30, 50, 100]

/** XP en plus sur une carte réussie pendant un combo. */
export function cardComboBonus(streak: number): number {
  return streak >= 50 ? 8 : streak >= 20 ? 5 : streak >= 10 ? 3 : streak >= 5 ? 2 : 0
}

/** Paliers franchis entre deux valeurs de combo (pour écrire les clés « cb: »). */
export function comboStepsReached(before: number, after: number): number[] {
  return COMBO_STEPS.filter((s) => before < s && after >= s)
}

export const comboKey = (day: string, step: number) => `cb:${day}:${step}`

export function bestCombo(ach: Record<string, number>, day?: string): number {
  let best = 0
  for (const key of Object.keys(ach)) {
    if (!key.startsWith('cb:')) continue
    const [, d, n] = key.split(':')
    if (day && d !== day) continue
    const v = Number(n)
    if (Number.isFinite(v)) best = Math.max(best, v)
  }
  return best
}

// ───────────────────────── Défis du jour ─────────────────────────
export interface TodayStats {
  n: number
  ok: number
  nw: number
  xp: number
  sec: number
  goalMet: boolean
  listens: ListenRecord[]
  exams: number
  combo: number
}

export function todayStats(state: AppState, day: string): TodayStats {
  const d = dayTotal(state, day)
  const sameDay = (t: number) => dayKey(dayNumber(t)) === day
  return {
    n: d.n,
    ok: d.ok,
    nw: d.nw + d.np,
    xp: d.xp,
    sec: d.sec,
    goalMet: d.n >= state.settings.goal,
    listens: listenHistory(state.ach).filter((l) => sameDay(l.t)),
    exams: examHistory(state.ach).filter((e) => sameDay(e.t)).length,
    combo: bestCombo(state.ach, day)
  }
}

export interface ChallengeDef {
  id: string
  emoji: string
  label: string
  target: number
  xp: number
  value: (t: TodayStats) => number
}

const listenAtLeast = (t: TodayStats, min: number, modes?: ListenMode[]) =>
  t.listens.some((l) => (!modes || modes.includes(l.mode)) && l.ok / l.total >= min / 10) ? 1 : 0

/** Trois familles : un défi « cartes », un défi « écoute », un défi « bonus ». */
function pools(goal: number): ChallengeDef[][] {
  const cards = Math.max(20, Math.round((goal * 1.5) / 5) * 5)
  return [
    [
      { id: 'cards', emoji: '🃏', label: `Répondre à ${cards} cartes`, target: cards, xp: 40, value: (t) => t.n },
      { id: 'ok', emoji: '🧠', label: `Retenir ${goal} cartes`, target: goal, xp: 40, value: (t) => t.ok },
      { id: 'new', emoji: '✨', label: 'Découvrir 5 nouvelles cartes', target: 5, xp: 35, value: (t) => t.nw },
      { id: 'combo10', emoji: '🔥', label: 'Atteindre un combo de 10', target: 10, xp: 45, value: (t) => t.combo }
    ],
    [
      { id: 'l7', emoji: '🎧', label: 'Une écoute à 7/10 ou plus', target: 1, xp: 40, value: (t) => listenAtLeast(t, 7) },
      { id: 'l2', emoji: '👂', label: 'Faire 2 écoutes', target: 2, xp: 40, value: (t) => t.listens.length },
      { id: 'l10', emoji: '💯', label: 'Une écoute parfaite (10/10)', target: 1, xp: 60, value: (t) => (t.listens.some(isPerfect) ? 1 : 0) },
      { id: 'ld6', emoji: '✍️', label: 'Une dictée à 6/10 ou plus', target: 1, xp: 50, value: (t) => listenAtLeast(t, 6, ['d']) },
      { id: 'lp7', emoji: '💬', label: 'Écoute de phrases à 7/10 ou plus', target: 1, xp: 50, value: (t) => listenAtLeast(t, 7, ['p']) }
    ],
    [
      { id: 'xp', emoji: '⚡', label: 'Gagner 300 XP aujourd\'hui', target: 300, xp: 40, value: (t) => t.xp },
      { id: 'time', emoji: '⏱️', label: 'Pratiquer 10 minutes', target: 600, xp: 35, value: (t) => t.sec },
      { id: 'exam', emoji: '📝', label: 'Terminer un test d\'examen', target: 1, xp: 50, value: (t) => t.exams },
      { id: 'goal', emoji: '🎯', label: 'Atteindre ton objectif du jour', target: 1, xp: 30, value: (t) => (t.goalMet ? 1 : 0) },
      { id: 'combo20', emoji: '🌋', label: 'Atteindre un combo de 20', target: 20, xp: 60, value: (t) => t.combo }
    ]
  ]
}

export const ALL_CHALLENGES_BONUS = 75

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Les 3 défis d'un jour : toujours les mêmes pour une date donnée (sur tous tes appareils). */
export function challengesFor(day: string, goal: number): ChallengeDef[] {
  return pools(goal).map((pool, i) => pool[hash(`${day}#${i}`) % pool.length])
}

export interface ChallengeProgress extends ChallengeDef {
  current: number
  done: boolean
  claimed: boolean
}

export function challengeProgress(state: AppState, day: string): ChallengeProgress[] {
  const t = todayStats(state, day)
  return challengesFor(day, state.settings.goal).map((c) => {
    const current = Math.min(c.target, c.value(t))
    return { ...c, current, done: current >= c.target, claimed: !!state.ach[`q:${day}:${c.id}`] }
  })
}

// ───────────────────────── Statistiques pour les trophées ─────────────────────────
export interface RewardStats {
  listens: number
  listenOk: number
  listenPerfect: number
  dicteePerfect: number
  phrasePerfect: number
  /** 3 écoutes parfaites d'affilée */
  listenTriple: boolean
  /** écoutes faites aujourd'hui */
  listensToday: number
  bestCombo: number
  challenges: number
  challengeDays: number
  /** meilleure suite de jours où les 3 défis sont réussis */
  challengeDaysRun: number
  goalDays: number
  bestDay: number
  minutes: number
  xpToday: number
  /** objectif atteint un samedi ET le dimanche qui suit */
  weekend: boolean
  /** a révisé aujourd'hui après au moins 7 jours sans réviser */
  comeback: boolean
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export function rewardStats(state: AppState, now = Date.now()): RewardStats {
  const lh = listenHistory(state.ach)
  let triple = false
  let run = 0
  for (const l of lh) {
    run = isPerfect(l) ? run + 1 : 0
    if (run >= 3) triple = true
  }
  const today = dayKey(dayNumber(now))
  const keys = Object.keys(state.ach)
  const qKeys = keys.filter((k) => k.startsWith('q:'))
  const fullDays = qKeys.filter((k) => k.endsWith(':all')).map((k) => k.split(':')[1]).sort()
  let fdRun = 0
  let fdBest = 0
  for (let i = 0; i < fullDays.length; i++) {
    fdRun = i > 0 && dayDiff(fullDays[i - 1], fullDays[i]) === 1 ? fdRun + 1 : 1
    fdBest = Math.max(fdBest, fdRun)
  }
  const goalDays = keys.filter((k) => k.startsWith('g:')).map((k) => k.slice(2))
  const goalSet = new Set(goalDays)
  const weekend = goalDays.some((d) => new Date(d + 'T12:00:00Z').getUTCDay() === 6 && goalSet.has(dayKey(Math.floor(Date.parse(d + 'T12:00:00Z') / 86_400_000) + 1)))
  let bestDay = 0
  let sec = 0
  const studied: string[] = []
  for (const d of Object.keys(state.daily)) {
    const t = dayTotal(state, d)
    bestDay = Math.max(bestDay, t.n)
    sec += t.sec
    if (t.n > 0) studied.push(d)
  }
  studied.sort()
  let comeback = false
  if (studied[studied.length - 1] === today && studied.length >= 2) comeback = dayDiff(studied[studied.length - 2], today) >= 7
  return {
    listens: lh.length,
    listenOk: lh.reduce((n, l) => n + l.ok, 0),
    listenPerfect: lh.filter(isPerfect).length,
    dicteePerfect: lh.filter((l) => l.mode === 'd' && isPerfect(l)).length,
    phrasePerfect: lh.filter((l) => l.mode === 'p' && isPerfect(l)).length,
    listenTriple: triple,
    listensToday: lh.filter((l) => dayKey(dayNumber(l.t)) === today).length,
    bestCombo: bestCombo(state.ach),
    challenges: qKeys.length - fullDays.length,
    challengeDays: fullDays.length,
    challengeDaysRun: fdBest,
    goalDays: goalDays.length,
    bestDay,
    minutes: Math.round(sec / 60),
    xpToday: dayTotal(state, today).xp,
    weekend,
    comeback
  }
}
