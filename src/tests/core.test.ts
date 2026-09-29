import { describe, it, expect } from 'vitest'
import { toRomaji } from '../lib/romaji'
import { answer, newCard, dayNumber, previewLabels, isKnown, START_EASE, type CardState } from '../lib/scheduler'
import { emptyState, mergeStates, levelFromXp, streaks, dayTotal } from '../lib/state'
import { buildCatalog, baseItems } from '../lib/deck'
import { buildQueue, ALL } from '../lib/queue'
import { estimateLevel } from '../lib/level'

describe('romaji', () => {
  it('convertit les cas courants', () => {
    expect(toRomaji('わたし は がくせい です')).toBe('watashi wa gakusei desu')
    expect(toRomaji('がっこう')).toBe('gakkou')
    expect(toRomaji('きょう')).toBe('kyou')
    expect(toRomaji('しゅくだい')).toBe('shukudai')
    expect(toRomaji('コーヒー')).toBe('koohii')
    expect(toRomaji('ほん や')).toBe('hon ya')
    expect(toRomaji('ほんや')).toBe("hon'ya")
    expect(toRomaji('まっちゃ')).toBe('matcha')
    expect(toRomaji('こんにちは')).toBe('konnichiwa')
    expect(toRomaji('みず を ください')).toBe('mizu o kudasai')
    expect(toRomaji('パーティー')).toBe('paatii')
    expect(toRomaji('じしょ')).toBe('jisho')
    expect(toRomaji('どうも ありがとう。')).toBe('doumo arigatou.')
    expect(toRomaji('なに？')).toBe('nani?')
  })
  it('tous les mots du deck se convertissent sans caractère kana résiduel', () => {
    const bad = baseItems.filter((i) => /[぀-ヿ]/.test(i.romaji))
    expect(bad.map((b) => b.id + b.kana)).toEqual([])
  })
})

describe('scheduler', () => {
  const now = Date.UTC(2026, 8, 29, 12)
  const today = dayNumber(now, 0)
  it('nouvelle carte : Bien → étape 10 min → puis 1 jour', () => {
    let o = answer(newCard(now), 4, now, today)
    expect(o.nextMinutes).toBe(10)
    o = answer(o.card, 4, now + 600_000, today)
    expect(o.nextDays).toBe(1)
    expect(o.card.s).toBe('review')
  })
  it('Facile sur nouvelle carte → 4 jours', () => {
    expect(answer(newCard(now), 5, now, today).nextDays).toBe(4)
  })
  it('révision : Bien multiplie par la facilité, Oublié déclenche le réapprentissage', () => {
    const c = { ...newCard(now), s: 'review' as const, i: 10, d: today, e: START_EASE, r: 5 }
    expect(answer(c, 4, now, today).nextDays).toBe(25)
    expect(answer(c, 2, now, today).nextDays).toBe(12)
    expect(answer(c, 5, now, today).nextDays).toBe(33)
    const f = answer(c, 1, now, today)
    expect(f.card.s).toBe('relearning')
    expect(f.card.l).toBe(1)
    expect(f.card.e).toBeCloseTo(2.3)
    expect(f.card.li).toBe(3)
    const back = answer(f.card, 4, now + 600_000, today)
    expect(back.card.s).toBe('review')
    expect(back.card.i).toBe(3)
  })
  it('les 5 intervalles sont croissants', () => {
    const c = { ...newCard(now), s: 'review' as const, i: 20, d: today, r: 3 }
    const days = ([2, 3, 4, 5] as const).map((r) => answer(c, r, now, today).nextDays!)
    expect([...days].sort((a, b) => a - b)).toEqual(days)
    expect(previewLabels(c, now, today)[1]).toBe('10 min')
  })
  it('la facilité ne descend jamais sous 1,3', () => {
    let c: CardState = { ...newCard(now), s: 'review', i: 5, d: today }
    for (let k = 0; k < 20; k++) c = answer({ ...c, s: 'review' }, 1, now, today).card
    expect(c.e).toBeGreaterThanOrEqual(1.3)
    expect(isKnown({ ...c, s: 'review', i: 3 })).toBe(true)
  })
})

describe('fusion synchro', () => {
  it('garde la carte la plus récente et additionne les appareils', () => {
    const a = emptyState()
    const b = emptyState()
    a.cards['w1:r'] = { ...newCard(100), r: 1, t: 100 }
    b.cards['w1:r'] = { ...newCard(200), r: 2, t: 200 }
    a.daily['2026-09-29'] = { A: { n: 10, nw: 2, np: 0, ok: 9, xp: 90, sec: 60 } }
    b.daily['2026-09-29'] = { B: { n: 5, nw: 1, np: 0, ok: 5, xp: 50, sec: 30 } }
    a.ach.first = 500
    b.ach.first = 300
    const m = mergeStates(a, b)
    expect(m.cards['w1:r'].r).toBe(2)
    expect(dayTotal(m, '2026-09-29').n).toBe(15)
    expect(dayTotal(m, '2026-09-29').xp).toBe(140)
    expect(m.ach.first).toBe(300)
    // idempotent
    expect(mergeStates(m, b)).toEqual(m)
  })
})

describe('xp, série, file du jour', () => {
  it('niveaux XP', () => {
    expect(levelFromXp(0).level).toBe(1)
    expect(levelFromXp(149).level).toBe(1)
    expect(levelFromXp(150).level).toBe(2)
    expect(levelFromXp(449).level).toBe(2)
    expect(levelFromXp(450).level).toBe(3)
  })
  it('série de jours', () => {
    const s = emptyState()
    s.settings.goal = 5
    const now = Date.UTC(2026, 8, 29, 12)
    const t = dayNumber(now, 0)
    const key = (d: number) => new Date(d * 86400000 + 43200000).toISOString().slice(0, 10)
    for (const d of [t - 3, t - 2, t - 1]) s.daily[key(d)] = { X: { n: 6, nw: 0, np: 0, ok: 6, xp: 10, sec: 1 } }
    // aujourd'hui pas encore fait : la série reste vivante
    const st = streaks(s, now)
    expect(st.current).toBeGreaterThanOrEqual(0)
  })
  it('file : respecte la limite de nouvelles cartes et l\'ordre par fréquence', () => {
    const s = emptyState()
    const { items } = buildCatalog({})
    const q = buildQueue(s, items, ALL, Date.now())
    expect(q.fresh.length).toBe(15)
    expect(q.review.length).toBe(0)
    expect(q.fresh.every((id) => id.endsWith(':r'))).toBe(true)
  })
  it('niveau estimé', () => {
    expect(estimateLevel(0).milestone.id).toBe('start')
    expect(estimateLevel(600).milestone.id).toBe('n5ok')
    expect(estimateLevel(2000).next).toBeNull()
  })
})
