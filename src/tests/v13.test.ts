import { describe, it, expect } from 'vitest'
import { dayNumber, dayKey, newCard } from '../lib/scheduler'
import { emptyState, mergeStates, sanitize, dayTotal, type AppState } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL, buildQueue, countDue } from '../lib/queue'

const NOW = Date.UTC(2026, 9, 6, 12)

/** État avec `n` cartes de reconnaissance dues (en retard de 2 jours), les premières étant les plus « oubliées ». */
function backlog(n: number): AppState {
  const st = emptyState()
  const today = dayNumber(NOW)
  baseItems.slice(0, n).forEach((it, i) => {
    st.cards[`${it.id}:r`] = { ...newCard(NOW), s: 'review', i: 5, d: today - 2, r: 3, l: i === n - 1 ? 4 : 0, e: 2.5 }
  })
  return st
}

describe('quota de révisions par jour (v1.3)', () => {
  it('limite les révisions proposées au quota', () => {
    const st = backlog(120)
    st.settings.reviewsPerDay = 25
    const q = buildQueue(st, baseItems, ALL, NOW)
    expect(q.review.length).toBe(25)
    expect(q.deferred).toBe(95)
  })

  it('0 = illimité', () => {
    const st = backlog(120)
    st.settings.reviewsPerDay = 0
    const q = buildQueue(st, baseItems, ALL, NOW)
    expect(q.review.length).toBe(120)
    expect(q.deferred).toBe(0)
  })

  it('les cartes les plus difficiles passent en premier', () => {
    const st = backlog(120)
    st.settings.reviewsPerDay = 10
    const hardest = `${baseItems[119].id}:r`
    expect(buildQueue(st, baseItems, ALL, NOW).review).toContain(hardest)
  })

  it('tient compte des révisions déjà faites aujourd\'hui', () => {
    const st = backlog(120)
    st.settings.reviewsPerDay = 25
    st.daily[dayKey(dayNumber(NOW))] = { dev: { n: 15, nw: 0, np: 0, ok: 15, xp: 0, sec: 0, rv: 15 } }
    expect(buildQueue(st, baseItems, ALL, NOW).review.length).toBe(10)
    st.daily[dayKey(dayNumber(NOW))].dev.rv = 25
    expect(buildQueue(st, baseItems, ALL, NOW).review.length).toBe(0)
    expect(countDue(st, baseItems, ALL, NOW).deferred).toBe(120)
  })

  it('une ancienne sauvegarde (sans réglage ni compteur) reste valide', () => {
    const old = { v: 1, cards: {}, custom: {}, daily: { '2026-10-05': { dev: { n: 3, nw: 1, np: 0, ok: 3, xp: 10, sec: 20 } } }, ach: {}, settings: { newPerDay: 15 } }
    const st = sanitize(old)
    expect(st.settings.reviewsPerDay).toBe(30)
    expect(dayTotal(st, '2026-10-05').n).toBe(3)
    expect(dayTotal(st, '2026-10-05').rv).toBe(0)
    const m = mergeStates(st, emptyState())
    expect(m.daily['2026-10-05'].dev.n).toBe(3)
  })

  it('la séance libre ignore le quota', () => {
    const st = backlog(120)
    st.settings.reviewsPerDay = 10
    const q = buildQueue(st, baseItems, { ...ALL, free: true }, NOW)
    expect(q.review.length).toBe(120)
  })
})
