import { describe, it, expect } from 'vitest'
import { dayNumber, dayKey, newCard, type CardState } from '../lib/scheduler'
import { emptyState, type AppState } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL, buildQueue, buildPractice } from '../lib/queue'
import { aidLevel, aidCounts } from '../lib/aid'
import { leeches, forecast, levelReports, themeCoverage, LEECH_AT } from '../lib/insights'
import { buildContextIndex, matchesWord, exampleFor } from '../lib/context'
import examples from '../data/examples.json'

const NOW = Date.UTC(2026, 9, 6, 12)
const today = dayNumber(NOW)
const word = (jp: string) => baseItems.find((i) => i.kind === 'word' && i.jp === jp)!
const review = (i: number, extra: Partial<CardState> = {}): CardState => ({ ...newCard(NOW), s: 'review', i, d: today + 1, r: 5, ...extra })

describe('aide à la lecture qui s\'efface (v1.3)', () => {
  const it0 = word('食べる')
  it('affiche tout pour une carte jeune, puis retire le rōmaji, puis le kana', () => {
    expect(aidLevel(review(5), it0, true)).toBe('full')
    expect(aidLevel(review(21), it0, true)).toBe('kana')
    expect(aidLevel(review(59), it0, true)).toBe('kana')
    expect(aidLevel(review(60), it0, true)).toBe('none')
  })
  it('réaffiche tout quand la carte est oubliée, nouvelle ou que l\'option est coupée', () => {
    expect(aidLevel(review(90, { s: 'relearning' }), it0, true)).toBe('full')
    expect(aidLevel(undefined, it0, true)).toBe('full')
    expect(aidLevel(review(90), it0, false)).toBe('full')
  })
  it('compte les mots lus sans aide', () => {
    const st = emptyState()
    st.cards[`${word('食べる').id}:r`] = review(30)
    st.cards[`${word('飲む').id}:r`] = review(100)
    expect(aidCounts(st.cards, baseItems)).toEqual({ noRomaji: 2, noAid: 1 })
  })
})

describe('mots difficiles, prévision, feuille de route', () => {
  it('repère les mots oubliés au moins LEECH_AT fois, les pires d\'abord', () => {
    const st = emptyState()
    st.cards[`${word('食べる').id}:r`] = review(3, { l: LEECH_AT })
    st.cards[`${word('飲む').id}:p`] = review(3, { l: LEECH_AT + 3 })
    st.cards[`${word('見る').id}:r`] = review(3, { l: LEECH_AT - 1 })
    const l = leeches(st, baseItems)
    expect(l.map((x) => x.item.jp)).toEqual(['飲む', '食べる'])
    expect(l[0].key.endsWith(':p')).toBe(true)
  })
  it('prévoit les révisions des 7 prochains jours (retard compté au jour 0)', () => {
    const st = emptyState()
    st.cards['a:r'] = review(3, { d: today - 4 })
    st.cards['b:r'] = review(3, { d: today })
    st.cards['c:r'] = review(3, { d: today + 2 })
    st.cards['d:r'] = review(3, { d: today + 20 })
    st.cards['e:r'] = { ...newCard(NOW), s: 'learning', d: NOW + 5 * 60_000 }
    const f = forecast(st, NOW, 7)
    expect(f).toHaveLength(7)
    expect(f.map((x) => x.n)).toEqual([3, 0, 1, 0, 0, 0, 0])
  })
  it('calcule la couverture par niveau', () => {
    const st = emptyState()
    const n5 = baseItems.filter((i) => i.kind === 'word' && i.lvl === 'N5').slice(0, 10)
    n5.forEach((w) => (st.cards[`${w.id}:r`] = review(25)))
    const rep = levelReports(st, baseItems)
    const r5 = rep.find((r) => r.lvl === 'N5')!
    expect(r5.known).toBe(10)
    expect(r5.solid).toBe(10)
    expect(r5.total).toBeGreaterThan(600)
    expect(r5.byPos.length).toBeGreaterThan(1)
    expect(themeCoverage(st, baseItems).length).toBeGreaterThan(5)
  })
})

describe('mot en contexte', () => {
  const idx = buildContextIndex(baseItems)
  it('ne confond pas un kanji seul avec un mot composé', () => {
    const iku = word('行く')
    const ginkou = { ...baseItems.find((i) => i.kind === 'sentence')!, jp: '銀行に勤めています。', kana: 'ぎんこう に つとめて います' }
    expect(matchesWord(iku, ginkou)).toBe(false)
    const ok = { ...ginkou, jp: '学校に行きます。', kana: 'がっこう に いきます' }
    expect(matchesWord(iku, ok)).toBe(true)
  })
  it('trouve des phrases pour une bonne partie des mots', () => {
    const words = baseItems.filter((i) => i.kind === 'word')
    const covered = words.filter((w) => idx.has(w.id)).length
    expect(covered).toBeGreaterThan(300)
    for (const [, hits] of idx) expect(hits.length).toBeLessThanOrEqual(2)
  })
  it('les phrases d\'exemple écrites : mots existants, kana seul, et couvrent tout le N5', () => {
    const ids = new Set(baseItems.filter((i) => i.kind === 'word').map((i) => i.id))
    const entries = Object.entries(examples as Record<string, { jp: string; kana: string; fr: string }>)
    expect(entries.length).toBeGreaterThanOrEqual(360)
    for (const [id, e] of entries) {
      expect(ids.has(id)).toBe(true)
      expect(e.kana).toMatch(/^[ぁ-ゟ゠-ヿー ]+$/)
      expect(e.jp.length).toBeGreaterThan(3)
      expect(e.fr.length).toBeGreaterThan(3)
      expect(exampleFor(id)?.fr).toBe(e.fr)
    }
    const n5 = baseItems.filter((i) => i.kind === 'word' && i.lvl === 'N5')
    const noSentence = n5.filter((w) => !idx.has(w.id))
    expect(noSentence.length).toBe(0)
  })
  it('les vraies phrases passent avant l\'exemple écrit', () => {
    for (const [id, hits] of idx) {
      const real = hits.filter((h) => !h.id.startsWith('ex:'))
      const idxEx = hits.findIndex((h) => h.id.startsWith('ex:'))
      if (idxEx >= 0) expect(idxEx).toBe(real.length)
      expect(id.startsWith('w')).toBe(true)
    }
  })
})

describe('séances : « encore » et séance courte', () => {
  const st = (): AppState => {
    const s = emptyState()
    baseItems.slice(0, 80).forEach((it) => (s.cards[`${it.id}:r`] = review(5, { d: today - 1 })))
    s.settings.reviewsPerDay = 20
    return s
  }
  it('« Encore 10 révisions » ajoute 10 cartes au quota', () => {
    expect(buildQueue(st(), baseItems, ALL, NOW).review.length).toBe(20)
    expect(buildQueue(st(), baseItems, { ...ALL, moreReviews: 10 }, NOW).review.length).toBe(30)
  })
  it('le quota déjà atteint + « encore 10 » = 10', () => {
    const s = st()
    s.daily[dayKey(today)] = { dev: { n: 20, nw: 0, np: 0, ok: 20, xp: 0, sec: 0, rv: 20 } }
    expect(buildQueue(s, baseItems, ALL, NOW).review.length).toBe(0)
    expect(buildQueue(s, baseItems, { ...ALL, moreReviews: 10 }, NOW).review.length).toBe(10)
  })
  it('ne propose que les mots choisis (ids)', () => {
    const s = st()
    const ids = baseItems.slice(0, 3).map((i) => i.id)
    const keys = buildPractice(s, baseItems, { ...ALL, ids })
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.every((k) => ids.includes(k.split(':')[0]))).toBe(true)
  })
})

import { useStore } from '../lib/store'
import { weekId } from '../lib/snapshots'

describe('points de restauration', () => {
  it('weekId renvoie le lundi de la semaine', () => {
    expect(weekId(Date.UTC(2026, 9, 6, 12))).toBe('2026-10-05') // mardi 6 oct. 2026
    expect(weekId(Date.UTC(2026, 9, 4, 23))).toBe('2026-09-28') // dimanche 4 oct.
  })
  it('restaure l\'état d\'une copie : cartes anciennes reprises, cartes récentes remises à neuf, astuces conservées', () => {
    useStore.getState().init()
    const a = baseItems.find((i) => i.kind === 'word')!
    const b = baseItems.filter((i) => i.kind === 'word')[1]
    const snap = emptyState()
    snap.cards[`${a.id}:r`] = { ...newCard(NOW), s: 'review', i: 12, d: today + 3, r: 4, m: 'astuce' }
    const json = JSON.stringify(snap)
    useStore.setState({ state: { ...emptyState(), cards: { [`${a.id}:r`]: { ...newCard(NOW), s: 'review', i: 40, d: today + 9, r: 9 }, [`${b.id}:r`]: { ...newCard(NOW), s: 'review', i: 5, d: today, r: 2 } } } })
    expect(useStore.getState().restoreSnapshot(json)).toBe(true)
    const cards = useStore.getState().state.cards
    expect(cards[`${a.id}:r`].i).toBe(12)
    expect(cards[`${a.id}:r`].m).toBe('astuce')
    expect(cards[`${b.id}:r`].s).toBe('new')
    expect(useStore.getState().restoreSnapshot('pas du json')).toBe(false)
  })
  it('setMemo ajoute puis retire une astuce sans toucher au planning', () => {
    const a = baseItems.find((i) => i.kind === 'word')!
    const key = `${a.id}:r`
    useStore.setState({ state: { ...emptyState(), cards: { [key]: { ...newCard(NOW), s: 'review', i: 7, d: today + 2, r: 3 } } } })
    useStore.getState().setMemo(key, '  une image  ')
    expect(useStore.getState().state.cards[key].m).toBe('une image')
    expect(useStore.getState().state.cards[key].i).toBe(7)
    useStore.getState().setMemo(key, '')
    expect(useStore.getState().state.cards[key].m).toBeUndefined()
  })
})

describe('deck vidéo Seto', () => {
  const v3 = baseItems.filter((i) => i.deck === 'vid3')
  it('contient les 235 phrases, avec kana, rōmaji et traduction', () => {
    expect(v3).toHaveLength(235)
    for (const it of v3) {
      expect(it.kind).toBe('sentence')
      expect(it.kana.length).toBeGreaterThan(0)
      expect(/[一-鿿]/.test(it.kana)).toBe(false) // kana = lecture pure
      expect(it.romaji.length).toBeGreaterThan(0)
      expect(it.fr.length).toBeGreaterThan(0)
    }
  })
  it('n\'entre pas dans les nouvelles cartes du jour', () => {
    const q = buildQueue(emptyState(), baseItems, ALL, NOW)
    expect([...q.fresh, ...q.freshProd].some((k) => k.startsWith('v3-'))).toBe(false)
  })
  it('les ids sont uniques dans tout le catalogue', () => {
    const ids = baseItems.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
