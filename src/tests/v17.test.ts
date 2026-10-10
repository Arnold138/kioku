import { describe, it, expect, beforeEach } from 'vitest'
import { dayKey, dayNumber, newCard, type CardState } from '../lib/scheduler'
import { emptyState, mergeStates, sanitize, totalXp, dayTotal } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL } from '../lib/queue'
import { useStore } from '../lib/store'
import { ACHIEVEMENTS, TIERS } from '../lib/achievements'
import {
  cardComboBonus,
  challengesFor,
  challengeProgress,
  comboStepsReached,
  listenHistory,
  listenKey,
  listenReward,
  rewardStats
} from '../lib/rewards'

const NOW = Date.now()
const today = dayNumber(NOW)
const day = dayKey(today)
const due = (extra: Partial<CardState> = {}): CardState => ({ ...newCard(), s: 'review', i: 8, d: today - 1, r: 4, ...extra })
const tenOk = Array(10).fill(true)

describe('XP de l\'écoute (v1.6)', () => {
  it('10/10 en écoute de mots rapporte bien plus qu\'avant (20 XP) et plus qu\'une manche de cartes', () => {
    const r = listenReward('s', tenOk)
    expect(r.answers).toBe(150)
    expect(r.perfect).toBe(50)
    expect(r.bestCombo).toBe(10)
    expect(r.total_xp).toBeGreaterThanOrEqual(250)
  })
  it('la dictée et les phrases rapportent plus que les mots', () => {
    expect(listenReward('d', tenOk).total_xp).toBeGreaterThan(listenReward('p', tenOk).total_xp)
    expect(listenReward('p', tenOk).total_xp).toBeGreaterThan(listenReward('s', tenOk).total_xp)
  })
  it('pas de bonus « sans faute » à 9/10, et un raté casse le combo', () => {
    const r = listenReward('s', [true, true, true, true, false, true, true, true, true, true])
    expect(r.perfect).toBe(0)
    expect(r.bestCombo).toBe(5)
    expect(r.total_xp).toBeLessThan(listenReward('s', tenOk).total_xp)
  })
  it('même à 0/10, on gagne l\'XP de participation', () => {
    expect(listenReward('s', Array(10).fill(false)).total_xp).toBe(10)
  })
  it('historique : anciennes clés (avant v1.6) et nouvelles clés sont relues', () => {
    const ach = { 'l:s:4:10:1000': 1000, [listenKey('p', 10, 10, 2000)]: 2000, [listenKey('d', 7, 10, 3000)]: 3000, 'x:N5:m:3:12:4000': 4000 }
    const h = listenHistory(ach)
    expect(h.map((l) => l.mode)).toEqual(['s', 'p', 'd'])
  })
})

describe('combos (v1.6)', () => {
  it('bonus de combo sur les cartes, par paliers', () => {
    expect(cardComboBonus(4)).toBe(0)
    expect(cardComboBonus(5)).toBe(2)
    expect(cardComboBonus(10)).toBe(3)
    expect(cardComboBonus(25)).toBe(5)
    expect(cardComboBonus(60)).toBe(8)
  })
  it('paliers franchis', () => {
    expect(comboStepsReached(4, 5)).toEqual([5])
    expect(comboStepsReached(0, 10)).toEqual([5, 10])
    expect(comboStepsReached(10, 11)).toEqual([])
  })
})

describe('défis du jour (v1.6)', () => {
  it('3 défis, toujours les mêmes pour une date (cartes · écoute · bonus)', () => {
    const a = challengesFor('2026-10-11', 20)
    const b = challengesFor('2026-10-11', 20)
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
    expect(a).toHaveLength(3)
    expect(a[1].id.startsWith('l')).toBe(true)
  })
  it('les défis changent d\'un jour à l\'autre', () => {
    const ids = new Set(Array.from({ length: 30 }, (_, i) => challengesFor(dayKey(today + i), 20).map((c) => c.id).join()))
    expect(ids.size).toBeGreaterThan(5)
  })
})

describe('store : écoute, combos, défis, trophées (v1.6)', () => {
  beforeEach(() => {
    useStore.getState().init()
    const st = emptyState()
    st.settings = { ...st.settings, reviewsPerDay: 0, newPerDay: 0, naturalPerDay: 0, production: false, chunk: 0 }
    baseItems.filter((i) => i.kind === 'word').slice(0, 30).forEach((w) => (st.cards[`${w.id}:r`] = due()))
    useStore.setState({ state: st, session: null, toasts: [] })
  })

  it('une écoute parfaite crédite l\'XP détaillé, les trophées d\'écoute et le combo de 10', () => {
    const r = useStore.getState().recordListen({ mode: 's', results: tenOk })
    const st = useStore.getState().state
    expect(r.total_xp).toBeGreaterThanOrEqual(250)
    expect(st.ach.li1).toBeTruthy()
    expect(st.ach.lip1).toBeTruthy()
    expect(st.ach.cb10).toBeTruthy()
    expect(st.ach[`cb:${day}:10`]).toBeTruthy()
    // XP total = écoute + trophées (+ défis éventuels)
    expect(totalXp(st)).toBeGreaterThanOrEqual(r.total_xp + TIERS.bronze.xp * 3)
  })

  it('combo pendant une séance de cartes, remis à zéro par « Oublié », et l\'annulation le restaure', () => {
    useStore.getState().startSession(ALL)
    for (let i = 0; i < 6; i++) {
      useStore.getState().reveal()
      useStore.getState().rate(4)
    }
    expect(useStore.getState().session!.combo).toBe(6)
    useStore.getState().reveal()
    useStore.getState().rate(1)
    expect(useStore.getState().session!.combo).toBe(0)
    expect(useStore.getState().session!.bestCombo).toBe(6)
    useStore.getState().undo()
    expect(useStore.getState().session!.combo).toBe(6)
    expect(useStore.getState().state.ach[`cb:${day}:5`]).toBeTruthy()
  })

  it('un défi réussi n\'est crédité qu\'une fois', () => {
    const list = challengeProgress(useStore.getState().state, day)
    // on réussit le défi d'écoute du jour à coup sûr : 2 écoutes parfaites (une en phrases, une en dictée)
    useStore.getState().recordListen({ mode: 'p', results: tenOk })
    useStore.getState().recordListen({ mode: 'd', results: tenOk })
    const st = useStore.getState().state
    expect(st.ach[`q:${day}:${list[1].id}`]).toBeTruthy()
    const xp1 = totalXp(st)
    useStore.getState().refreshRewards()
    useStore.getState().refreshRewards()
    expect(totalXp(useStore.getState().state)).toBe(xp1)
  })

  it('les trophées rapportent selon leur rang', () => {
    expect(ACHIEVEMENTS.every((a) => TIERS[a.tier])).toBe(true)
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(90)
    expect(ACHIEVEMENTS.filter((a) => a.secret).length).toBeGreaterThanOrEqual(6)
  })
})

describe('sauvegarde et synchro (v1.6)', () => {
  it('aucun nouveau champ : tout passe par `ach`, conservé par sanitize et mergeStates (ancienne version comprise)', () => {
    const a = emptyState()
    const b = emptyState()
    a.ach[listenKey('d', 10, 10, 111)] = 111
    a.ach[`cb:${day}:20`] = 222
    b.ach[`q:${day}:l7`] = 333
    b.ach[`q:${day}:all`] = 333
    const merged = mergeStates(sanitize(JSON.parse(JSON.stringify(a))), sanitize(JSON.parse(JSON.stringify(b))))
    expect(Object.keys(merged.ach)).toHaveLength(4)
    const r = rewardStats(merged, NOW)
    expect(r.dicteePerfect).toBe(1)
    expect(r.bestCombo).toBe(20)
    expect(r.challenges).toBe(1)
    expect(r.challengeDays).toBe(1)
  })
  it('week-end studieux : objectif atteint un samedi et le dimanche qui suit', () => {
    const st = emptyState()
    st.ach['g:2026-10-10'] = 1 // samedi
    expect(rewardStats(st, NOW).weekend).toBe(false)
    st.ach['g:2026-10-11'] = 1 // dimanche
    expect(rewardStats(st, NOW).weekend).toBe(true)
  })
  it('meilleure journée et minutes viennent des compteurs du jour', () => {
    const st = emptyState()
    st.daily['2026-10-01'] = { a: { n: 120, nw: 0, np: 0, ok: 100, xp: 0, sec: 3600 } }
    expect(dayTotal(st, '2026-10-01').n).toBe(120)
    const r = rewardStats(st, NOW)
    expect(r.bestDay).toBe(120)
    expect(r.minutes).toBe(60)
  })
})
