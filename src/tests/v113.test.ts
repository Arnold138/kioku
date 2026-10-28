import { describe, expect, it, beforeEach } from 'vitest'
import { dayNumber, dayKey, newCard, type CardState } from '../lib/scheduler'
import { dayTotal, emptyState, mergeStates, sanitize, DEFAULT_SETTINGS } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL, buildQueue } from '../lib/queue'
import { useStore } from '../lib/store'
import { ACHIEVEMENTS } from '../lib/achievements'
import { checkCloze, clozeFor } from '../lib/cloze'
import { checkStroke, kanjiIn, resample, traceKey, traceReward, tracedPerfect, type KanjiStrokes, type Pt } from '../lib/trace'
import kanjiData from '../data/kanjivg.json'

const now = Date.now()
const today = dayNumber(now)
const known = (extra: Partial<CardState> = {}): CardState => ({ ...newCard(now - 5 * 86_400_000), s: 'review', i: 10, d: today + 5, r: 4, ...extra })
const words = baseItems.filter((i) => i.kind === 'word' && i.lvl !== 'Saison')
const withCloze = words.filter((w) => clozeFor(w, baseItems))
const KV = kanjiData as unknown as Record<string, KanjiStrokes>

describe('v1.13 — cartes à trous', () => {
  it('beaucoup de mots ont une phrase où le cacher', () => {
    expect(withCloze.length).toBeGreaterThan(500)
    const w = withCloze[0]
    const c = clozeFor(w, baseItems)!
    expect(c.tokens[c.index]).toContain(c.answer)
    expect(c.tokens.length).toBeGreaterThanOrEqual(3)
  })

  it('accepte le mot (kanji, kana, rōmaji) ou sa forme dans la phrase', () => {
    const w = withCloze.find((x) => x.pos === 'v' && clozeFor(x, baseItems)!.answer !== x.kana) ?? withCloze[0]
    const c = clozeFor(w, baseItems)!
    expect(checkCloze(w, c, w.kana).ok).toBe(true)
    expect(checkCloze(w, c, w.romaji).ok).toBe(true)
    expect(checkCloze(w, c, c.answer).ok).toBe(true)
    expect(checkCloze(w, c, 'zzz').ok).toBe(false)
  })

  it('se débloquent quand le mot est retenu, avec leur propre quota (réglable, 0 = désactivées)', () => {
    const st = emptyState()
    st.settings = { ...st.settings, newPerDay: 0, production: false, naturalPerDay: 0, reviewsPerDay: 0, clozePerDay: 3 }
    withCloze.slice(0, 10).forEach((w) => (st.cards[`${w.id}:r`] = known()))
    const q = buildQueue(st, baseItems, ALL, now)
    expect(q.freshCloze).toHaveLength(3)
    expect(q.freshCloze.every((k) => k.endsWith(':c'))).toBe(true)
    st.settings.clozePerDay = 0
    expect(buildQueue(st, baseItems, ALL, now).freshCloze).toHaveLength(0)
    // un mot pas encore retenu n'a pas de carte à trous
    const st2 = emptyState()
    st2.cards[`${withCloze[0].id}:r`] = known({ i: 1 })
    expect(buildQueue(st2, baseItems, ALL, now).freshCloze).toHaveLength(0)
  })

  describe('en séance', () => {
    beforeEach(() => {
      useStore.getState().init()
      const st = emptyState()
      st.settings = { ...st.settings, newPerDay: 0, production: false, naturalPerDay: 0, reviewsPerDay: 0, clozePerDay: 2, chunk: 0 }
      withCloze.slice(0, 4).forEach((w) => (st.cards[`${w.id}:r`] = known()))
      useStore.setState({ state: st, session: null, toasts: [] })
    })
    it('une nouvelle carte à trous compte dans « nc » et suit le planning FSRS', () => {
      useStore.getState().startSession(ALL)
      const key = useStore.getState().session!.current!
      expect(key.endsWith(':c')).toBe(true)
      useStore.getState().reveal()
      useStore.getState().rate(4)
      const st = useStore.getState().state
      expect(st.cards[key].s).toBe('review')
      expect(st.cards[key].fs).toBeGreaterThan(0)
      expect(dayTotal(st, dayKey(today)).nc).toBe(1)
      expect(dayTotal(st, dayKey(today)).nw).toBe(0)
    })
  })

  it('compatibilité : réglage par défaut 5 par jour, les cartes « :c » et « nc » voyagent à la synchro', () => {
    const old = JSON.parse(JSON.stringify({ ...emptyState(), settings: { ...DEFAULT_SETTINGS } }))
    delete old.settings.clozePerDay
    expect(sanitize(old).settings.clozePerDay).toBe(5)
    const a = { ...emptyState(), cards: { 'w8:c': known() }, daily: { '2026-11-01': { x: { n: 1, nw: 0, np: 0, ok: 1, xp: 5, sec: 1, nc: 1 } } } }
    const m = mergeStates(emptyState(), a)
    expect(m.cards['w8:c']).toBeTruthy()
    expect(m.daily['2026-11-01'].x.nc).toBe(1)
  })
})

describe('v1.13 — tracé des kanji', () => {
  const ch = '日'
  const k = KV[ch]
  const ptsOf = (flat: number[]): Pt[] => Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i], flat[2 * i + 1]])

  it('les données couvrent les kanji des mots de l\'app', () => {
    expect(Object.keys(KV).length).toBeGreaterThan(1000)
    expect(k.s.length).toBe(4)
    expect(k.p[0]).toHaveLength(16)
    expect(kanjiIn('日本語', KV)).toEqual(['日', '本', '語'])
  })

  it('ré-échantillonne un tracé en points réguliers', () => {
    const r = resample([[0, 0], [10, 0]], 6)
    expect(r).toHaveLength(6)
    expect(r[1][0]).toBeCloseTo(2)
    expect(r[5][0]).toBeCloseTo(10)
  })

  it('accepte un trait bien placé (même un peu tremblé), refuse le mauvais sens ou la mauvaise place', () => {
    const ref = k.p[1]
    const user = ptsOf(ref).map(([x, y], i) => [x + (i % 2 ? 2 : -2), y + 1.5] as Pt)
    expect(checkStroke(user, ref).ok).toBe(true)
    const rev = checkStroke([...ptsOf(ref)].reverse(), ref)
    expect(rev.ok).toBe(false)
    expect(rev.reversed).toBe(true)
    const far = ptsOf(ref).map(([x, y]) => [x + 40, y + 40] as Pt)
    expect(checkStroke(far, ref).ok).toBe(false)
    // le trait 2 n'est pas le trait 1
    expect(checkStroke(ptsOf(k.p[2]), k.p[1]).ok).toBe(false)
  })

  it('XP : 12 par kanji, +6 sans faute ; historique dans ach (clés « tk: »)', () => {
    expect(traceReward([0, 2, 0])).toEqual({ xp: 3 * 12 + 2 * 6, perfect: 2, total: 3 })
    expect(tracedPerfect({ [traceKey(2, 3, 1)]: 1, [traceKey(4, 5, 2)]: 2 })).toBe(6)
  })

  it('le store crédite l\'XP et débloque « Premier coup de pinceau »', () => {
    useStore.getState().init()
    useStore.setState({ state: emptyState(), session: null, toasts: [] })
    expect(useStore.getState().recordTrace({ mistakes: [0, 1] })).toBe(2 * 12 + 6)
    expect(useStore.getState().state.ach.tr1).toBeTruthy()
  })

  it('trophées de kanji regroupés dans leur famille, ids uniques', () => {
    const kanji = ACHIEVEMENTS.filter((a) => a.family === 'kanji').map((a) => a.id)
    expect(kanji).toEqual(['gk25', 'gk100', 'gk300', 'tr1', 'tr25', 'tr100'])
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })
})
