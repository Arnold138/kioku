import { describe, expect, it } from 'vitest'
import { answer, dayNumber, newCard, type CardState } from '../lib/scheduler'
import { DEFAULT_SETTINGS, emptyState, mergeStates, sanitize, type AppState } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL, UNLIMITED_KEY, buildQueue, interleave, mixFresh, rotateThemes, spread, withUnlimitedReviews } from '../lib/queue'
import { clozeFor } from '../lib/cloze'
import { naturalSentences } from '../lib/natural'

const NOW = Date.UTC(2026, 10, 23, 12)
const today = dayNumber(NOW)
const YESTERDAY = NOW - 86_400_000
const rev = (over: Partial<CardState> = {}): CardState => ({ ...newCard(YESTERDAY - 5 * 86_400_000), s: 'review', i: 5, d: today, r: 3, ...over })
const itemOf = (k: string) => baseItems.find((it) => it.id === k.slice(0, k.lastIndexOf(':')))!
const words = baseItems.filter((it) => it.kind === 'word' && (it.lvl === 'N5' || it.lvl === 'N4'))

describe('v1.18 — une carte ne revient qu\'une fois par jour', () => {
  it('nouvelle carte : Bien → retenue, Hésitant → demain, ratée → une seule fois en fin de séance', () => {
    expect(answer(newCard(NOW), 4, NOW, today).nextDays).toBe(3)
    expect(answer(newCard(NOW), 3, NOW, today).nextDays).toBe(1)
    const miss = answer(newCard(NOW), 1, NOW, today)
    expect(miss.nextMinutes).toBe(10)
    // v1.20 : règle changée — elle revient dans la manche jusqu'à « Bien » ; « Bien » ou « Facile » la font sortir
    for (const r of [1, 2, 3] as const) expect(answer(miss.card, r, NOW + 600_000, today).nextMinutes).toBe(10)
    for (const r of [4, 5] as const) {
      const o = answer(miss.card, r, NOW + 600_000, today)
      expect(o.nextMinutes).toBeUndefined()
      expect(o.card.s).toBe('review')
      expect(o.card.d).toBeGreaterThan(today)
    }
  })

  it('révision ratée : réapprentissage une fois (10 min), puis demain au plus tard', () => {
    const lapse = answer(rev(), 1, NOW, today)
    expect(lapse.nextMinutes).toBe(10)
    // v1.20 : règle changée — encore raté → elle reste à apprendre (la manche la remontre jusqu'à « Bien »)
    const again = answer(lapse.card, 1, NOW + 600_000, today)
    expect(again.card.s).toBe('relearning')
    expect(again.nextMinutes).toBe(10)
    const ok = answer(lapse.card, 4, NOW + 600_000, today)
    expect(ok.card.s).toBe('review')
  })

  it('une carte ratée hier et due aujourd\'hui a encore droit à sa seconde chance du jour', () => {
    const fromYesterday: CardState = { ...newCard(YESTERDAY), s: 'learning', st: 0, r: 1, d: NOW - 1000, t: YESTERDAY }
    expect(answer(fromYesterday, 1, NOW, today).nextMinutes).toBe(10)
  })

  it('un seul exercice par mot et par jour : la reconnaissance, la production, les trous et la forme ne s\'enchaînent plus', () => {
    const st = emptyState()
    const w = words[0]
    st.cards[`${w.id}:r`] = rev({ d: today - 3 })
    st.cards[`${w.id}:p`] = rev({ d: today - 1 })
    st.cards[`${w.id}:c`] = rev({ d: today - 2 })
    const q = buildQueue(st, baseItems, ALL, NOW)
    const mine = [...q.learning, ...q.review, ...q.fresh, ...q.freshProd, ...q.freshCloze, ...(q.freshForm ?? [])].filter((k) => k.startsWith(`${w.id}:`))
    expect(mine).toHaveLength(1)
    expect(q.deferred).toBe(0)
  })

  it('un mot déjà travaillé aujourd\'hui attend demain pour ses autres exercices', () => {
    const st = emptyState()
    const w = words[1]
    st.cards[`${w.id}:r`] = { ...rev({ d: today + 4, i: 4 }), t: NOW - 3_600_000 } // révisé ce matin
    st.cards[`${w.id}:p`] = rev({ d: today - 1 }) // production due
    const q = buildQueue(st, baseItems, ALL, NOW)
    expect(q.review).not.toContain(`${w.id}:p`)
    // demain, elle est là
    expect(buildQueue(st, baseItems, ALL, NOW + 86_400_000).review).toContain(`${w.id}:p`)
  })

  it('la carte ratée qui doit revenir une fois reste dans la file', () => {
    const st = emptyState()
    const w = words[2]
    st.cards[`${w.id}:r`] = answer(newCard(NOW - 700_000), 1, NOW - 700_000, today).card
    expect(buildQueue(st, baseItems, ALL, NOW).learning).toEqual([`${w.id}:r`])
  })
})

describe('v1.18 — variété', () => {
  it('nouvelles cartes : un mot, une phrase, un mot… et les phrases tournent entre les thèmes', () => {
    const q = buildQueue({ ...emptyState(), settings: { ...DEFAULT_SETTINGS, newPerDay: 12 } }, baseItems, ALL, NOW)
    const kinds = q.fresh.map((k) => itemOf(k).kind)
    expect(kinds.slice(0, 6)).toEqual(['word', 'sentence', 'word', 'sentence', 'word', 'sentence'])
    const themes = q.fresh.map(itemOf).filter((it) => it.kind === 'sentence').map((it) => it.note)
    for (let i = 1; i < themes.length; i++) expect(themes[i]).not.toBe(themes[i - 1])
    // la vie quotidienne d'abord : commander, demander, courses, gare, hôtel…
    expect(themes.slice(0, 4)).toEqual(['Commander', 'Demander', 'Courses', 'Gare'])
  })

  it('mixFresh et rotateThemes', () => {
    const w = words.slice(0, 2)
    const s = baseItems.filter((it) => it.kind === 'sentence' && it.deck === 'phrases').slice(0, 40)
    expect(mixFresh(w, s, 5).map((it) => it.kind)).toEqual(['word', 'sentence', 'word', 'sentence', 'sentence'])
    const r = rotateThemes(s)
    expect(r).toHaveLength(40)
    expect(new Set(r.map((it) => it.id)).size).toBe(40)
    expect(r[0].note).not.toBe(r[1].note)
  })

  it('révisions mélangées : jamais deux du même groupe à la suite quand on peut l\'éviter, et stable dans la journée', () => {
    const xs = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2']
    const g = (x: string) => x[0]
    const out = spread(xs, g, today)
    expect(out.sort()).toEqual([...xs].sort())
    const o2 = spread(xs, g, today)
    for (let i = 1; i < o2.length; i++) expect(g(o2[i])).not.toBe(g(o2[i - 1]))
    expect(spread(xs, g, today)).toEqual(o2)
  })

  it('beaucoup de révisions : on ne revoit pas toujours les mêmes mots difficiles, les vieux mots passent aussi', () => {
    const st: AppState = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, reviewsPerDay: 20 } }
    words.slice(0, 200).forEach((w, i) => {
      // 20 mots « difficiles » vus récemment, 180 vieux mots très en retard
      st.cards[`${w.id}:r`] = i < 20 ? rev({ i: 2, d: today, l: 6, e: 1.3 }) : rev({ i: 20, d: today - 40 })
    })
    const q = buildQueue(st, baseItems, ALL, NOW)
    const hard = q.review.filter((k) => words.slice(0, 20).some((w) => k.startsWith(`${w.id}:`)))
    expect(q.review).toHaveLength(20)
    expect(hard.length).toBeLessThan(5)
  })

  it('carte à trous : la phrase change d\'un jour à l\'autre', () => {
    const multi = words.find((w) => new Set([0, 1, 2, 3, 4, 5].map((d) => clozeFor(w, baseItems, today + d)?.sentence.id)).size > 1)
    expect(multi).toBeTruthy()
  })

  it('une même phrase ne sert pas à deux cartes à trous le même jour', () => {
    const st = emptyState()
    const due = words.filter((w) => clozeFor(w, baseItems, today)).slice(0, 120)
    due.forEach((w) => { st.cards[`${w.id}:c`] = rev({ d: today - 1 }) })
    const q = buildQueue(st, baseItems, ALL, NOW)
    const sentences = q.review.filter((k) => k.endsWith(':c')).map((k) => clozeFor(itemOf(k), baseItems, today)!.sentence.id)
    expect(new Set(sentences).size).toBe(sentences.length)
  })

  it('phrases des vidéos du jour : on tourne entre les vidéos', () => {
    const st = emptyState()
    words.forEach((w) => { st.cards[`${w.id}:r`] = rev({ i: 30, d: today + 20 }) })
    const nat = naturalSentences(st, baseItems, 3)
    expect(new Set(nat.map((it) => it.id.split('-')[0])).size).toBeGreaterThan(1)
  })

  it('la file reste bien formée (pas de doublon)', () => {
    const st = emptyState()
    words.slice(0, 80).forEach((w, i) => { st.cards[`${w.id}:r`] = rev({ d: today - (i % 5) }) })
    const all = interleave(buildQueue(st, baseItems, ALL, NOW))
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('v1.18 — limite de révisions retirée une fois, et compatibilité', () => {
  it('la limite passe à « illimité » une seule fois ; si tu la remets, elle reste', () => {
    const st = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, reviewsPerDay: 30, _t: 100 } }
    const a = withUnlimitedReviews(st, NOW)
    expect(a.settings.reviewsPerDay).toBe(0)
    expect(a.settings._t).toBeGreaterThan(100)
    expect(a.ach[UNLIMITED_KEY]).toBe(1)
    const again = withUnlimitedReviews({ ...a, settings: { ...a.settings, reviewsPerDay: 40 } }, NOW + 1000)
    expect(again.settings.reviewsPerDay).toBe(40)
  })

  it('un ancien appareil qui synchronise après coup ne remet pas la limite', () => {
    const mine = withUnlimitedReviews({ ...emptyState(), settings: { ...DEFAULT_SETTINGS, reviewsPerDay: 30, _t: 100 } }, NOW)
    const oldDevice = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, reviewsPerDay: 30, _t: 100 } }
    expect(mergeStates(oldDevice, mine).settings.reviewsPerDay).toBe(0)
    expect(mergeStates(mine, oldDevice).ach[UNLIMITED_KEY]).toBe(1)
  })

  it('une ancienne sauvegarde s\'ouvre sans rien perdre (mêmes cartes, même format)', () => {
    const old = JSON.parse(JSON.stringify({ ...emptyState(), cards: { 'w1:r': rev(), 's89:r': rev({ i: 9 }) } }))
    const s = sanitize(old)
    expect(s.v).toBe(1)
    expect(s.cards['s89:r'].i).toBe(9)
    expect(Object.keys(s.cards['w1:r']).sort()).toEqual(Object.keys(rev()).sort())
  })

  it('les nouvelles phrases ont leurs propres numéros : les anciennes gardent les leurs', () => {
    const s89 = baseItems.find((it) => it.id === 's89')!
    expect(s89.jp).toBe('写真を撮ってもいいですか。')
    const daily = baseItems.filter((it) => /^s\d+$/.test(it.id) && Number(it.id.slice(1)) >= 159 && Number(it.id.slice(1)) <= 308)
    expect(daily).toHaveLength(150)
    expect(daily.every((it) => it.lvl === 'N5' && it.kind === 'sentence')).toBe(true)
  })
})
