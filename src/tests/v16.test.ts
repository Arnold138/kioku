import { describe, it, expect, beforeEach } from 'vitest'
import { dayNumber, newCard, type CardState } from '../lib/scheduler'
import { emptyState, DEFAULT_SETTINGS } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL } from '../lib/queue'
import { useStore, splitRounds } from '../lib/store'

const today = dayNumber(Date.now())
const due = (extra: Partial<CardState> = {}): CardState => ({ ...newCard(), s: 'review', i: 8, d: today - 1, r: 4, ...extra })
const ids = (n: number) => Array.from({ length: n }, (_, i) => `k${i}`)

describe('découpage en manches (v1.5)', () => {
  it('70 cartes en manches de 10 → 7 manches de 10', () => {
    const r = splitRounds(ids(70), 10)
    expect(r.rounds).toBe(7)
    expect(r.first).toHaveLength(10)
    expect(r.later).toHaveLength(60)
  })
  it('une séance courte reste en un seul morceau', () => {
    expect(splitRounds(ids(15), 10).rounds).toBe(1)
    expect(splitRounds(ids(40), 0).rounds).toBe(1)
  })
  it('des manches de tailles proches, sans petite manche à la fin', () => {
    const r = splitRounds(ids(24), 10)
    expect(r.rounds).toBe(2)
    expect(r.first).toHaveLength(12)
  })
  it('réglage par défaut : 10 cartes par manche', () => {
    expect(DEFAULT_SETTINGS.chunk).toBe(10)
  })
})

describe('séance en manches dans le store (v1.5)', () => {
  beforeEach(() => {
    useStore.getState().init()
    const st = emptyState()
    st.settings = { ...st.settings, reviewsPerDay: 0, newPerDay: 0, naturalPerDay: 0, production: false }
    baseItems.filter((i) => i.kind === 'word').slice(0, 30).forEach((w) => (st.cards[`${w.id}:r`] = due()))
    useStore.setState({ state: st })
  })

  const playRound = (missFirst = false) => {
    let guard = 0
    let missed = false
    while (!useStore.getState().session!.pause && !useStore.getState().session!.finished && guard++ < 60) {
      useStore.getState().reveal()
      if (missFirst && !missed) {
        missed = true
        useStore.getState().rate(1)
      } else useStore.getState().rate(4)
    }
  }

  it('pause après chaque manche, les ratés reviennent avant la pause, puis on continue', () => {
    useStore.getState().startSession(ALL)
    const s0 = useStore.getState().session!
    expect(s0.rounds).toBe(3)
    expect(s0.total).toBe(30)
    playRound(true)
    const s1 = useStore.getState().session!
    expect(s1.pause).toBe(true)
    expect(s1.learn).toHaveLength(0) // la carte ratée a été revue dans la manche
    expect(s1.answered - s1.roundFrom.answered).toBe(11)
    useStore.getState().continueRound()
    const s2 = useStore.getState().session!
    expect(s2.pause).toBe(false)
    expect(s2.round).toBe(2)
    expect(s2.current).not.toBeNull()
    playRound()
    useStore.getState().continueRound()
    playRound()
    expect(useStore.getState().session!.finished).toBe(true)
  })

  it('arrêter pendant la pause termine la séance, le reste reste à réviser', () => {
    useStore.getState().startSession(ALL)
    playRound()
    useStore.getState().stopRounds()
    const s = useStore.getState().session!
    expect(s.finished).toBe(true)
    expect(s.later).toHaveLength(20)
    const stillDue = Object.values(useStore.getState().state.cards).filter((c) => c.d <= today).length
    expect(stillDue).toBe(20)
  })

  it('annuler depuis la pause remet la dernière carte à l\'écran', () => {
    useStore.getState().startSession(ALL)
    playRound()
    useStore.getState().undo()
    const s = useStore.getState().session!
    expect(s.pause).toBe(false)
    expect(s.current).not.toBeNull()
    useStore.getState().reveal()
    useStore.getState().rate(4)
    expect(useStore.getState().session!.pause).toBe(true)
  })
})

describe('astuce (v1.5)', () => {
  it('une astuce ajoutée sur une carte jamais vue est gardée, la carte reste nouvelle', () => {
    useStore.getState().init()
    useStore.setState({ state: emptyState() })
    const w = baseItems.find((i) => i.kind === 'word')!
    useStore.getState().setMemo(`${w.id}:r`, 'table → on mange à table')
    const c = useStore.getState().state.cards[`${w.id}:r`]
    expect(c.m).toBe('table → on mange à table')
    expect(c.s).toBe('new')
  })
})
