import { describe, expect, it, beforeEach } from 'vitest'
import { dayNumber, newCard, type CardState } from '../lib/scheduler'
import { computeProgress, emptyState, mergeStates } from '../lib/state'
import { baseItems, DECKS } from '../lib/deck'
import { useStore } from '../lib/store'
import { ACHIEVEMENTS } from '../lib/achievements'
import {
  FESTIVALS, FESTIVAL_GOAL, FESTIVAL_ITEMS, activeFestival, earnedDecorations, festivalEnd, festivalItems, festivalKey, festivalProgress, festivalYear
} from '../lib/festivals'
import { goldCount, scrollKanji } from '../lib/scroll'
import { computeWrapped, periodLabel } from '../lib/wrapped'
import { buildingsFor, levelProgress } from '../lib/village'

const now = Date.now()
const today = dayNumber(now)
const known = (i = 10): CardState => ({ ...newCard(now - 3 * 86_400_000), s: 'review', i, d: today + 5, r: 4 })

describe('v1.12 — fêtes de saison', () => {
  it('6 fêtes de 15 mots, avec lecture et traduction, dans un deck à la demande', () => {
    expect(FESTIVALS).toHaveLength(6)
    for (const f of FESTIVALS) expect(festivalItems(f.id)).toHaveLength(15)
    for (const it of FESTIVAL_ITEMS) {
      expect(it.jp && it.kana && it.fr && it.romaji).toBeTruthy()
      expect(it.id).not.toContain(':') // les ids de carte sont « id:r »
      expect(it.lvl).toBe('Saison')
    }
    expect(DECKS.find((d) => d.id === 'fetes')?.optIn).toBe(true)
    expect(baseItems.filter((i) => i.deck === 'fetes')).toHaveLength(90)
    expect(new Set(FESTIVAL_ITEMS.map((i) => i.id)).size).toBe(90)
  })

  it('aux vraies dates, y compris le Nouvel An à cheval sur deux années', () => {
    expect(activeFestival(new Date(2026, 9, 28))?.id).toBe('momiji')
    expect(activeFestival(new Date(2026, 11, 30))?.id).toBe('shogatsu')
    expect(activeFestival(new Date(2027, 0, 5))?.id).toBe('shogatsu')
    expect(activeFestival(new Date(2027, 3, 1))?.id).toBe('hanami')
    expect(activeFestival(new Date(2027, 6, 7))?.id).toBe('tanabata')
    expect(activeFestival(new Date(2027, 7, 10))?.id).toBe('natsu')
    expect(activeFestival(new Date(2027, 8, 20))?.id).toBe('tsukimi')
    expect(activeFestival(new Date(2027, 1, 20))).toBeNull()
    const sho = FESTIVALS.find((f) => f.id === 'shogatsu')!
    expect(festivalYear(sho, new Date(2026, 11, 30))).toBe(2027)
    expect(festivalYear(sho, new Date(2027, 0, 5))).toBe(2027)
    expect(festivalEnd(FESTIVALS.find((f) => f.id === 'momiji')!)).toBe('30 novembre')
  })

  it('les mots des fêtes ne comptent pas dans ton niveau JLPT ni dans le village', () => {
    const st = emptyState()
    festivalItems('momiji').forEach((it) => (st.cards[`${it.id}:r`] = known()))
    expect(computeProgress(st, baseItems).wordsKnownR).toBe(0)
    expect(levelProgress(st, baseItems).every((l) => l.known === 0)).toBe(true)
    expect(buildingsFor(st, baseItems, 'N5', now).every((b) => b.known === 0)).toBe(true)
    expect(festivalProgress(st, 'momiji')).toEqual({ known: 15, total: 15, done: true })
  })

  describe('décoration gagnée', () => {
    beforeEach(() => {
      useStore.getState().init()
      useStore.setState({ state: emptyState(), session: null, toasts: [] })
    })
    it(`${FESTIVAL_GOAL} mots retenus pendant la fête → décoration rangée dans ach (une seule fois)`, () => {
      const f = activeFestival(new Date(now))
      if (!f) return // hors période de fête : rien à vérifier aujourd'hui
      const st = emptyState()
      festivalItems(f.id).slice(0, FESTIVAL_GOAL).forEach((it) => (st.cards[`${it.id}:r`] = known()))
      useStore.setState({ state: st })
      useStore.getState().refreshRewards()
      const ach = useStore.getState().state.ach
      expect(ach[festivalKey(f.id, festivalYear(f, new Date(now)))]).toBeTruthy()
      expect(earnedDecorations(ach)).toEqual([f.id])
      expect(ach.fe1).toBeTruthy() // trophée « Premier matsuri »
    })
  })

  it('les décorations se fusionnent à la synchro', () => {
    const a = { ...emptyState(), ach: { [festivalKey('momiji', 2026)]: 5 } }
    const b = { ...emptyState(), ach: { [festivalKey('hanami', 2027)]: 9 } }
    expect(earnedDecorations(mergeStates(a, b).ach).sort()).toEqual(['hanami', 'momiji'])
  })
})

describe('v1.12 — parchemin d\'or', () => {
  it('kanji d\'or = mot solide (21 jours ou plus), encre noire = retenu mais pas solide', () => {
    const st = emptyState()
    const w = baseItems.filter((i) => i.kind === 'word' && /[一-鿿]/.test(i.jp))
    st.cards[`${w[0].id}:r`] = known(30)
    st.cards[`${w[1].id}:r`] = known(5)
    const list = scrollKanji(st, baseItems)
    const ch0 = [...w[0].jp].find((c) => /[一-鿿]/.test(c))!
    expect(list.find((k) => k.ch === ch0)?.gold).toBe(true)
    expect(goldCount(list)).toBeGreaterThanOrEqual(1)
    expect(list.length).toBeGreaterThan(goldCount(list) - 1)
    expect(scrollKanji(emptyState(), baseItems)).toHaveLength(0)
  })
})

describe('v1.12 — Kioku Wrapped', () => {
  it('compte jours, cartes, minutes, nouveaux mots et record du mois', () => {
    const st = emptyState()
    st.daily = {
      '2026-10-01': { a: { n: 20, nw: 5, np: 0, ok: 18, xp: 300, sec: 600, rv: 10 } },
      '2026-10-02': { a: { n: 40, nw: 3, np: 0, ok: 30, xp: 500, sec: 1200, rv: 20 }, b: { n: 10, nw: 0, np: 0, ok: 10, xp: 100, sec: 300, rv: 5 } },
      '2026-09-30': { a: { n: 99, nw: 9, np: 0, ok: 90, xp: 900, sec: 900, rv: 50 } }
    }
    const w = computeWrapped(st, baseItems, { kind: 'month', year: 2026, month: 10 })
    expect(w.days).toBe(2)
    expect(w.cards).toBe(70)
    expect(w.newWords).toBe(8)
    expect(w.minutes).toBe(35)
    expect(w.bestDay).toEqual({ day: '2026-10-02', n: 50 })
    expect(w.bestRun).toBe(2)
    expect(computeWrapped(st, baseItems, { kind: 'year', year: 2026 }).cards).toBe(169)
    expect(periodLabel({ kind: 'month', year: 2026, month: 10 })).toBe('octobre 2026')
  })
  it('revanche : le mot le plus raté que tu as fini par retenir', () => {
    const st = emptyState()
    const w = baseItems.filter((i) => i.kind === 'word')
    st.cards[`${w[0].id}:r`] = { ...known(), f: 7 }
    st.cards[`${w[1].id}:r`] = { ...known(), f: 3 }
    st.cards[`${w[2].id}:r`] = { ...known(1), f: 9 } // pas encore retenu
    expect(computeWrapped(st, baseItems, { kind: 'year', year: 2026 }).comeback?.jp).toBe(w[0].jp)
  })
  it('nouveaux trophées : ids uniques', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    for (const id of ['fe1', 'fe3', 'fe6', 'gk25', 'gk100', 'gk300']) expect(ids).toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
