import { describe, it, expect, beforeEach } from 'vitest'
import { answer, answerPractice, accuracyPct, misses, newCard, dayNumber, dayKey, START_EASE } from '../lib/scheduler'
import { emptyState, dayTotal, mergeStates, retentionRate } from '../lib/state'
import { todayStats } from '../lib/rewards'
import { baseItems } from '../lib/deck'
import { ALL } from '../lib/queue'
import { useStore } from '../lib/store'
import type { CardState } from '../lib/scheduler'

const now = Date.UTC(2026, 9, 13, 10)
const today = dayNumber(now)

describe('« Difficile » = demi-raté (vague souvenir)', () => {
  const rev = () => ({ ...newCard(now), s: 'review' as const, i: 10, d: today, e: START_EASE, r: 5 })

  it('en révision : la carte revient dans 10 min, puis à 50 % de son intervalle', () => {
    const o = answer(rev(), 2, now, today)
    expect(o.nextMinutes).toBe(10)
    expect(o.card.s).toBe('relearning')
    expect(o.card.li).toBe(5) // Oublié donnerait 3 (25 %)
    expect(o.card.e).toBeCloseTo(2.35)
    expect(o.card.l).toBe(0) // pas un « oubli » au sens Anki
    const back = answer(o.card, 4, now + 600_000, today)
    expect(back.card.s).toBe('review')
    expect(back.card.i).toBe(5)
  })

  it('compte comme un raté dans les points faibles', () => {
    const o = answer({ ...rev(), w: 2, f: 1 }, 2, now, today)
    expect(misses(o.card)).toBe(2)
    expect(o.card.w).toBe(0)
    expect(o.card.mt).toBe(now)
  })

  it('entraînement : Difficile compte comme une vraie révision', () => {
    const c = { ...rev(), d: today + 5 }
    expect(answerPractice(c, 2, now, today).card.s).toBe('relearning')
  })

  it('pourcentage : Difficile vaut 35 %', () => {
    expect(accuracyPct(10, 0, 0)).toBe(100)
    expect(accuracyPct(10, 0, 10)).toBe(35)
    expect(accuracyPct(10, 5, 5)).toBe(18)
    expect(accuracyPct(0, 0, 0)).toBe(0)
  })

  it('statistiques du jour : hd fusionné entre appareils et compté à 35 %', () => {
    const day = dayKey(today)
    const a = emptyState()
    const b = emptyState()
    a.daily[day] = { A: { n: 10, nw: 0, np: 0, ok: 6, hd: 4, xp: 0, sec: 0 } }
    b.daily[day] = { A: { n: 8, nw: 0, np: 0, ok: 5, hd: 3, xp: 0, sec: 0 }, B: { n: 10, nw: 0, np: 0, ok: 10, xp: 0, sec: 0 } }
    const m = mergeStates(a, b)
    expect(m.daily[day].A.hd).toBe(4)
    expect(dayTotal(m, day).hd).toBe(4)
    expect(retentionRate(m, 30, now)).toBeCloseTo((16 + 4 * 0.35) / 20)
    expect(todayStats(m, day).ok).toBe(17)
  })

  it('anciennes sauvegardes sans hd : rien ne change', () => {
    const s = emptyState()
    s.daily[dayKey(today)] = { A: { n: 10, nw: 0, np: 0, ok: 9, xp: 0, sec: 0 } }
    expect(retentionRate(s, 30, now)).toBeCloseTo(0.9)
  })
})

describe('« Difficile » pendant une séance', () => {
  beforeEach(() => {
    useStore.getState().init()
    const st = emptyState()
    const t = dayNumber(Date.now())
    const card = (): CardState => ({ ...newCard(Date.now()), s: 'review', i: 8, d: t - 1, r: 5 })
    baseItems.filter((i) => i.kind === 'word').slice(0, 20).forEach((w) => (st.cards[`${w.id}:r`] = card()))
    useStore.setState({ state: st })
  })

  it('fige le combo, compte dans les ratés, 35 % dans le pourcentage, et s\'annule proprement', () => {
    useStore.getState().startSession({ ...ALL, cap: 10 })
    const g = () => useStore.getState().session!
    useStore.getState().reveal(); useStore.getState().rate(4)
    useStore.getState().reveal(); useStore.getState().rate(4)
    expect(g().combo).toBe(2)
    const hardKey = g().current!
    useStore.getState().reveal(); useStore.getState().rate(2)
    expect(g().combo).toBe(2)
    expect(g().hard).toBe(1)
    expect(g().forgot).toBe(0)
    expect(g().missed).toContain(hardKey)
    const day = dayKey(dayNumber(Date.now()))
    expect(dayTotal(useStore.getState().state, day).ok).toBe(2)
    expect(dayTotal(useStore.getState().state, day).hd).toBe(1)
    useStore.getState().undo()
    expect(g().hard).toBe(0)
    expect(g().missed).not.toContain(hardKey)
    expect(dayTotal(useStore.getState().state, day).hd ?? 0).toBe(0)
  })
})
