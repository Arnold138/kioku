import { describe, it, expect, beforeEach } from 'vitest'
import { answer, answerPractice, dayNumber, newCard, misses, type CardState } from '../lib/scheduler'
import { emptyState, mergeStates, dayTotal, totalXp, type AppState } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL, buildQueue, buildPractice, countDue } from '../lib/queue'
import { isWeak, weakCards, weakGroups } from '../lib/insights'
import { naturalSentences, sentencesForWords, isNaturalId } from '../lib/natural'
import { contextIndex } from '../lib/context'
import { dayKey } from '../lib/scheduler'
import { useStore } from '../lib/store'

const NOW = Date.UTC(2026, 9, 6, 12)
const today = dayNumber(NOW)
const review = (extra: Partial<CardState> = {}): CardState => ({ ...newCard(NOW), s: 'review', i: 10, d: today + 5, r: 5, ...extra })
const word = (jp: string) => baseItems.find((i) => i.kind === 'word' && i.jp === jp)!

describe('compteur de ratés (v1.4)', () => {
  it('une ancienne carte (sans champ f) retombe sur ses oublis, puis compte tous les ratés', () => {
    const old = review({ l: 5 })
    expect(misses(old)).toBe(5)
    const o = answer(old, 1, NOW, today).card
    expect(misses(o)).toBe(6)
    expect(o.w).toBe(0)
    expect(o.mt).toBe(NOW)
  })
  it('un raté pendant l\'apprentissage compte aussi (30 fois pour « bleu »)', () => {
    let c = newCard(NOW)
    for (let i = 0; i < 30; i++) c = answer(c, 1, NOW + i, today).card
    expect(misses(c)).toBe(30)
    expect(c.l).toBe(0) // le planning (oublis de révision) est inchangé
  })
  it('le suivi ne change jamais le planning', () => {
    const c = review({ i: 12, e: 2.3 })
    for (const r of [1, 2, 3, 4, 5] as const) {
      const withT = answer(c, r, NOW, today).card
      const { f, w, mt, ...rest } = withT
      void f; void w; void mt
      const plain = { ...rest }
      expect(plain.i).toBe(withT.i)
      expect(plain.d).toBe(withT.d)
    }
  })
})

describe('points faibles', () => {
  it('raté ≥ 3 fois : faible ; 3 réussites d\'affilée : récupérée', () => {
    let c = review({ l: 3 })
    expect(isWeak(c, NOW)).toBe(true)
    for (let k = 0; k < 3; k++) c = answer(c, 4, NOW + k, today).card
    expect(c.w).toBe(3)
    expect(isWeak(c, NOW + 1000)).toBe(false)
  })
  it('raté récemment (mauvaise séance) : faible 2 jours, pas après', () => {
    const c = answer(review(), 1, NOW, today).card
    expect(isWeak(c, NOW + 3600_000)).toBe(true)
    expect(isWeak({ ...c, f: 1 }, NOW + 3 * 86_400_000)).toBe(false)
  })
  it('une carte nouvelle ou jamais ratée n\'est pas faible', () => {
    expect(isWeak(undefined, NOW)).toBe(false)
    expect(isWeak(newCard(NOW), NOW)).toBe(false)
    expect(isWeak(review(), NOW)).toBe(false)
  })
  it('classement par type et par thème, les plus ratés d\'abord', () => {
    const st: AppState = emptyState()
    const aoi = word('青い')
    const taberu = word('食べる')
    const rice = baseItems.find((i) => i.kind === 'word' && i.fr.startsWith('riz'))
    st.cards[`${aoi.id}:r`] = review({ l: 30, f: 30 })
    st.cards[`${taberu.id}:r`] = review({ l: 4 })
    if (rice) st.cards[`${rice.id}:r`] = review({ l: 3 })
    const list = weakCards(st, baseItems, NOW)
    expect(list[0].item.id).toBe(aoi.id)
    expect(list[0].misses).toBe(30)
    const g = weakGroups(list)
    expect(g.types.find((t) => t.id === 'adjs')?.cards.map((c) => c.item.id)).toContain(aoi.id)
    expect(g.types.find((t) => t.id === 'verbs')?.cards.map((c) => c.item.id)).toContain(taberu.id)
    expect(g.themes.some((t) => t.id === 'vetements' || t.id === 'nourriture')).toBe(true)
  })
  it('séance sur des cartes précises : dans l\'ordre, seulement les cartes commencées', () => {
    const st = emptyState()
    const a = word('青い')
    const b = word('食べる')
    st.cards[`${a.id}:r`] = review({ l: 9 })
    st.cards[`${b.id}:r`] = review({ l: 4 })
    const keys = [`${a.id}:r`, `${b.id}:r`, 'w999999:r']
    expect(buildPractice(st, baseItems, { ...ALL, scope: 'practice', keys })).toEqual([`${a.id}:r`, `${b.id}:r`])
  })
})

describe('entraînement libre', () => {
  it('un raté compte comme une vraie révision, une réussite ne repousse pas la date', () => {
    const c = review({ i: 20, d: today + 8 })
    const ok = answerPractice(c, 4, NOW, today).card
    expect([ok.i, ok.d, ok.s]).toEqual([20, today + 8, 'review'])
    expect(ok.r).toBe(c.r + 1)
    const ko = answerPractice(c, 1, NOW, today).card
    expect(ko.s).toBe('relearning')
    expect(ko.l).toBe(c.l + 1)
    expect(misses(ko)).toBe(1)
  })
})

describe('phrases naturelles', () => {
  const stateKnowing = (n: number): AppState => {
    const st = emptyState()
    baseItems.filter((i) => i.kind === 'word').slice(0, n).forEach((w) => (st.cards[`${w.id}:r`] = review({ i: 20 })))
    return st
  }
  it('rien tant qu\'on ne connaît aucun mot, puis des phrases presque entièrement connues', () => {
    expect(naturalSentences(emptyState(), baseItems, 3)).toEqual([])
    const nat = naturalSentences(stateKnowing(676), baseItems, 5)
    expect(nat.length).toBeGreaterThan(0)
    expect(nat.every((s) => isNaturalId(s.id))).toBe(true)
  })
  it('« À étudier » reçoit les phrases du jour, hors quota de mots, et le réglage les coupe', () => {
    const st = stateKnowing(676)
    st.settings.naturalPerDay = 2
    const q = buildQueue(st, baseItems, ALL, NOW)
    expect(q.freshNat.length).toBe(2)
    expect(countDue(st, baseItems, ALL, NOW).fresh).toBe(q.fresh.length + q.freshProd.length + 2)
    st.settings.naturalPerDay = 0
    expect(buildQueue(st, baseItems, ALL, NOW).freshNat.length).toBe(0)
    // une séance libre ne les ajoute pas
    st.settings.naturalPerDay = 2
    expect(buildQueue(st, baseItems, { ...ALL, free: true }, NOW).freshNat.length).toBe(0)
  })
  it('les phrases d\'une vidéo reprennent les mots vus en séance', () => {
    const st = stateKnowing(676)
    const idx = contextIndex(baseItems)
    const ids = baseItems.filter((i) => i.kind === 'word').slice(0, 300).map((w) => w.id).filter((id) => (idx.get(id) ?? []).some((s) => isNaturalId(s.id)))
    const out = sentencesForWords(st, baseItems, ids.slice(0, 40), idx, 3)
    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThanOrEqual(3)
    expect(out.every((s) => isNaturalId(s.id))).toBe(true)
  })
})

describe('séance dans le store (v1.4)', () => {
  beforeEach(() => {
    useStore.getState().init()
    const st = emptyState()
    baseItems.filter((i) => i.kind === 'word').slice(0, 40).forEach((w) => (st.cards[`${w.id}:r`] = review({ i: 8, d: today - 1 })))
    useStore.setState({ state: st })
  })
  it('les cartes ratées sont retenues dans la séance et dans les points faibles', () => {
    useStore.getState().startSession({ ...ALL, cap: 6 })
    const ratedKeys: string[] = []
    let guard = 0
    while (useStore.getState().session && !useStore.getState().session!.finished && guard++ < 40) {
      const cur = useStore.getState().session!.current!
      useStore.getState().reveal()
      if (ratedKeys.length < 2 && !ratedKeys.includes(cur)) {
        ratedKeys.push(cur)
        useStore.getState().rate(1)
      } else useStore.getState().rate(4)
    }
    const s = useStore.getState().session!
    expect(s.missed.sort()).toEqual([...ratedKeys].sort())
    expect(s.seen.length).toBeGreaterThan(0)
    const weak = weakCards(useStore.getState().state, useStore.getState().items, Date.now())
    for (const k of ratedKeys) expect(weak.some((w) => w.key === k)).toBe(true)
  })
  it('annuler un raté retire la carte des ratés de la séance', () => {
    useStore.getState().startSession({ ...ALL, cap: 5 })
    const cur = useStore.getState().session!.current!
    useStore.getState().reveal()
    useStore.getState().rate(1)
    expect(useStore.getState().session!.missed).toContain(cur)
    useStore.getState().undo()
    expect(useStore.getState().session!.missed).not.toContain(cur)
    expect(misses(useStore.getState().state.cards[cur])).toBe(0)
  })
  it('« Compris » / « À revoir » sur une phrase naturelle : vraie carte + XP', () => {
    const sent = baseItems.find((i) => isNaturalId(i.id))!
    const xp0 = totalXp(useStore.getState().state)
    useStore.getState().rateSentence(sent.id, true)
    const c = useStore.getState().state.cards[`${sent.id}:r`]
    expect(c.s).not.toBe('new')
    expect(totalXp(useStore.getState().state)).toBeGreaterThan(xp0)
    const sent2 = baseItems.filter((i) => isNaturalId(i.id))[1]
    useStore.getState().rateSentence(sent2.id, false)
    expect(misses(useStore.getState().state.cards[`${sent2.id}:r`])).toBe(1)
    const day = dayKey(dayNumber(Date.now()))
    expect(dayTotal(useStore.getState().state, day).nv).toBe(2)
  })
  it('les phrases naturelles du jour comptent à part (nv) et pas dans les nouveaux mots (nw)', () => {
    const st = useStore.getState().state
    const known = emptyState()
    baseItems.filter((i) => i.kind === 'word').slice(0, 676).forEach((w) => (known.cards[`${w.id}:r`] = review({ i: 20 })))
    known.settings = { ...st.settings, naturalPerDay: 1 }
    useStore.setState({ state: known })
    useStore.getState().startSession({ ...ALL, scope: 'new' })
    // scope « new » n'ajoute pas de phrases naturelles (réservé au planning normal)
    expect(useStore.getState().session!.queue.every((k) => !isNaturalId(k.split(':')[0]))).toBe(true)
  })
})

describe('compatibilité', () => {
  it('la fusion reste idempotente avec les nouveaux champs optionnels', () => {
    const a: AppState = emptyState()
    a.cards['w1:r'] = review({ f: 4, w: 1, mt: NOW })
    a.daily['2026-10-06'] = { dev: { n: 2, nw: 0, np: 0, ok: 2, xp: 10, sec: 5, nv: 1 } }
    const m = mergeStates(a, a)
    expect(mergeStates(m, a)).toEqual(m)
    const old: AppState = emptyState()
    old.cards['w1:r'] = review({ l: 2 })
    expect(mergeStates(old, old)).toEqual(mergeStates(mergeStates(old, old), old))
  })
})
