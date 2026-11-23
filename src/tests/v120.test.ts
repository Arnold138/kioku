import { beforeEach, describe, expect, it } from 'vitest'
import { answer, dayNumber, newCard, FIRST_EASY_INTERVAL, type CardState } from '../lib/scheduler'
import { emptyState } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL, buildQueue } from '../lib/queue'
import { useStore } from '../lib/store'

const NOW = Date.now()
const today = dayNumber(NOW)
const rev = (o: Partial<CardState> = {}): CardState => ({ ...newCard(NOW - 20 * 86_400_000), s: 'review', i: 8, d: today - 1, r: 4, ...o })
const words = baseItems.filter((i) => i.kind === 'word')

describe('v1.20 — dans la manche, une carte revient jusqu\'à « Bien »', () => {
  beforeEach(() => {
    useStore.getState().init()
    const st = emptyState()
    st.settings = { ...st.settings, reviewsPerDay: 0, newPerDay: 0, production: false, chunk: 5 }
    words.slice(0, 10).forEach((w) => (st.cards[`${w.id}:r`] = rev()))
    useStore.setState({ state: st })
  })

  it('Oublié, Oublié, Hésitant… la carte revient dans la même manche ; la manche ne se termine qu\'après « Bien »', () => {
    useStore.getState().startSession(ALL)
    const target = useStore.getState().session!.current!
    const plan = [1, 1, 3, 4] as const
    let k = 0
    let guard = 0
    const seenTarget: number[] = []
    while (!useStore.getState().session!.pause && !useStore.getState().session!.finished && guard++ < 40) {
      const s = useStore.getState().session!
      useStore.getState().reveal()
      if (s.current === target) {
        seenTarget.push(s.round)
        useStore.getState().rate(plan[k++])
      } else useStore.getState().rate(4)
    }
    expect(seenTarget).toEqual([1, 1, 1, 1]) // 4 fois, toutes dans la manche 1
    expect(useStore.getState().session!.pause).toBe(true) // puis la manche se termine
    const card = useStore.getState().state.cards[target]
    expect(card.s).toBe('review')
    expect(card.d).toBeGreaterThan(today)
  })

  it('Hésitant sur une carte en révision : elle revient dans la manche, sans changer son planning les fois suivantes', () => {
    useStore.getState().startSession(ALL)
    const target = useStore.getState().session!.current!
    useStore.getState().reveal()
    useStore.getState().rate(3)
    const after1 = useStore.getState().state.cards[target]
    let guard = 0
    while (useStore.getState().session!.current !== target && guard++ < 10) {
      useStore.getState().reveal()
      useStore.getState().rate(4)
    }
    expect(useStore.getState().session!.current).toBe(target)
    useStore.getState().reveal()
    useStore.getState().rate(4)
    const after2 = useStore.getState().state.cards[target]
    expect(after2.d).toBe(after1.d)
    expect(after2.i).toBe(after1.i)
  })

  it('annuler une réponse retire la copie remise en fin de manche', () => {
    useStore.getState().startSession(ALL)
    const target = useStore.getState().session!.current!
    const before = useStore.getState().session!.queue.length
    useStore.getState().reveal()
    useStore.getState().rate(1)
    expect(useStore.getState().session!.queue.filter((k) => k === target)).toHaveLength(1)
    useStore.getState().undo()
    const s = useStore.getState().session!
    expect(s.current).toBe(target)
    expect(s.queue.filter((k) => k === target)).toHaveLength(0)
    expect(s.queue.length).toBe(before)
  })
})

describe('v1.20 — « Facile » éloigne vraiment la carte', () => {
  it('au moins 2 semaines, et au moins le double de l\'intervalle d\'avant', () => {
    expect(FIRST_EASY_INTERVAL).toBe(14)
    expect(answer(newCard(NOW), 5, NOW, today).nextDays).toBeGreaterThanOrEqual(14)
    expect(answer(rev({ i: 1, e: 1.3 }), 5, NOW, today).nextDays).toBeGreaterThanOrEqual(14)
    expect(answer(rev({ i: 20 }), 5, NOW, today).nextDays).toBeGreaterThanOrEqual(40)
  })

  it('l\'autre sens (FR → JP) attend au moins une semaine après ta dernière révision du mot', () => {
    const st = emptyState()
    st.settings = { ...st.settings, production: true, prodPerDay: 10, newPerDay: 0 }
    const w = words[0]
    // « Facile » hier : intervalle 14 jours → la carte FR → JP ne doit pas arriver aujourd'hui
    st.cards[`${w.id}:r`] = { ...rev(), i: 14, d: today + 13 }
    expect(buildQueue(st, baseItems, ALL, NOW).freshProd).not.toContain(`${w.id}:p`)
    // révisé il y a 10 jours : elle peut arriver
    st.cards[`${w.id}:r`] = { ...rev(), i: 14, d: today + 4 }
    expect(buildQueue(st, baseItems, ALL, NOW).freshProd).toContain(`${w.id}:p`)
  })
})
