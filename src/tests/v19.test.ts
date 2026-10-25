import { describe, expect, it } from 'vitest'
import { answer, catchUpKnown, FIRST_GOOD_INTERVAL, dayNumber, isKnown, newCard, type CardState } from '../lib/scheduler'
import { CATCHUP_KEY, applyCatchUp, emptyState, mergeStates } from '../lib/state'
import { ACHIEVEMENTS } from '../lib/achievements'

const now = Date.UTC(2026, 9, 20, 12)
const today = dayNumber(now)

describe('v1.9 — cartes reconnues du premier coup', () => {
  it('« Bien » sur une nouvelle carte : retenue tout de suite, elle sort de la séance', () => {
    const o = answer(newCard(now), 4, now, today)
    expect(o.nextMinutes).toBeUndefined()
    expect(o.card.s).toBe('review')
    expect(o.card.d).toBe(today + 3)
    expect(isKnown(o.card)).toBe(true)
  })
  it('les ratés gardent le fonctionnement habituel', () => {
    expect(answer(newCard(now), 1, now, today).card.s).toBe('learning')
    expect(answer(newCard(now), 2, now, today).card.s).toBe('learning')
    expect(answer(newCard(now), 3, now, today).card.s).toBe('learning')
  })
})

describe('v1.9 — rattrapage des cartes déjà réussies', () => {
  const learning: CardState = { ...newCard(now - 86_400_000), s: 'learning', st: 1, r: 1, d: now - 1, t: now - 86_400_000 }
  const young: CardState = { ...newCard(now - 86_400_000), s: 'review', i: 1, d: today, r: 2, t: now - 86_400_000 }
  const missed: CardState = { ...young, f: 1 }
  const lapsed: CardState = { ...young, l: 1 }
  it('carte jamais ratée en apprentissage ou à 1-2 jours → retenue à 3 jours de sa dernière réponse', () => {
    const a = catchUpKnown(learning)!
    expect(a.s).toBe('review')
    expect(a.i).toBe(3)
    expect(a.d).toBe(dayNumber(learning.t) + 3)
    expect(a.t).toBe(learning.t)
    expect(isKnown(catchUpKnown(young)!)).toBe(true)
  })
  it('v1.9.1 : réussie en révision à 1-2 jours, même ratée avant → retenue', () => {
    expect(isKnown(catchUpKnown(missed)!)).toBe(true)
    expect(isKnown(catchUpKnown(lapsed)!)).toBe(true)
  })
  it('carte ratée encore en (ré)apprentissage, nouvelle ou déjà retenue : pas touchée', () => {
    expect(catchUpKnown({ ...learning, f: 1 })).toBeNull()
    expect(catchUpKnown({ ...young, s: 'relearning', l: 1 })).toBeNull()
    expect(catchUpKnown(newCard(now))).toBeNull()
    expect(catchUpKnown({ ...young, i: 5 })).toBeNull()
  })
  it('une seule fois : les cartes répondues après la mise à jour ne sont pas rattrapées', () => {
    const st = { ...emptyState(), cards: { a: learning, b: missed, x: { ...learning, f: 1 } } }
    const first = applyCatchUp(st, now)
    expect(first.changed).toBe(2)
    expect(first.state.cards.x.s).toBe('learning')
    expect(first.state.ach[CATCHUP_KEY]).toBe(now)
    expect(first.state.cards.a.s).toBe('review')
    // nouvelle carte répondue « Hésitant » après la mise à jour : reste en apprentissage
    const later: CardState = { ...learning, t: now + 60_000 }
    const again = applyCatchUp({ ...first.state, cards: { ...first.state.cards, c: later } }, now + 120_000)
    expect(again.state.cards.c.s).toBe('learning')
    expect(applyCatchUp(again.state, now + 180_000).changed).toBe(0)
  })
  it('synchro : deux appareils donnent le même résultat, une vraie réponse plus récente gagne', () => {
    const phone = applyCatchUp({ ...emptyState(), cards: { a: learning } }, now).state
    const mac = applyCatchUp({ ...emptyState(), cards: { a: learning } }, now + 5000).state
    const merged = mergeStates(mac, phone)
    expect(merged.cards.a).toEqual(phone.cards.a)
    expect(merged.ach[CATCHUP_KEY]).toBe(now)
    const reviewed: CardState = { ...phone.cards.a, i: 8, d: today + 8, t: now + 10_000 }
    expect(mergeStates(mac, { ...phone, cards: { a: reviewed } }).cards.a.i).toBe(8)
  })
})

describe('v1.9 — trophées intermédiaires', () => {
  it('identifiants uniques', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('paliers de mots tous les 100 jusqu\'à 1 000', () => {
    for (let n = 100; n <= 1000; n += 100) expect(ACHIEVEMENTS.some((a) => a.id === 'k' + n)).toBe(true)
  })
  it('paliers de révisions tous les 500 jusqu\'à 3 000', () => {
    for (let n = 500; n <= 3000; n += 500) expect(ACHIEVEMENTS.some((a) => a.id === 'r' + n)).toBe(true)
  })
})

describe('v1.9.1 — toute révision réussie rend la carte retenue', () => {
  it('révision à 1 jour avec une facilité basse : Bien → 3 jours, Facile → 7 jours', () => {
    const c: CardState = { ...newCard(now), s: 'review', i: 1, d: today, e: 1.3, r: 6, l: 2 }
    expect(answer(c, 4, now, today).nextDays).toBe(FIRST_GOOD_INTERVAL)
    expect(answer(c, 5, now, today).nextDays).toBe(7)
    expect(answer(c, 3, now, today).nextDays).toBe(1) // v1.10 (FSRS) : carte très difficile, Hésitant la garde à 1 jour
  })
  it('réapprentissage : Bien → retenue même si l\'ancien intervalle était court', () => {
    const c: CardState = { ...newCard(now), s: 'relearning', st: 0, i: 2, li: 1, d: now, r: 4, l: 1 }
    const o = answer(c, 4, now, today)
    expect(o.card.s).toBe('review')
    expect(isKnown(o.card)).toBe(true)
  })
})
