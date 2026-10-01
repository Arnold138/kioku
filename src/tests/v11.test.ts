import { describe, it, expect, beforeEach } from 'vitest'
import { answer, newCard, dayNumber, type CardState } from '../lib/scheduler'
import { emptyState, mergeStates, sanitize, totalXp, levelFromXp, DEFAULT_SETTINGS, type AppState } from '../lib/state'
import { baseItems, buildCatalog } from '../lib/deck'
import { buildPractice, buildQueue, pickWarmup, ALL, type Filter } from '../lib/queue'
import { THEMES, inTheme } from '../lib/themes'
import { canon, checkTyped } from '../lib/typing'
import { useStore } from '../lib/store'

const NOW = Date.UTC(2026, 9, 1, 12)
const byJp = (jp: string) => baseItems.find((i) => i.jp === jp)!

/** Reproduit une sauvegarde « version 1.0 » : aucun champ preSentences / typing dans les réglages. */
function oldSave(): { json: string; state: AppState } {
  const today = dayNumber(NOW, 0)
  const cards: Record<string, CardState> = {}
  const daily: AppState['daily'] = {}
  let c = newCard(NOW)
  const words = baseItems.filter((i) => i.kind === 'word').slice(0, 300)
  words.forEach((w, i) => {
    let card = newCard(NOW - i * 1000)
    card = answer(card, 4, NOW - 5 * 86400000, today - 5).card
    card = answer(card, 4, NOW - 4 * 86400000, today - 4).card
    cards[`${w.id}:r`] = { ...card, t: NOW - i * 1000 }
  })
  void c
  daily['2026-09-30'] = { abc123: { n: 600, nw: 15, np: 8, ok: 560, xp: 4500, sec: 7200 } }
  const st: AppState = {
    v: 1,
    cards,
    custom: { c1: { id: 'c1', jp: '猫', kana: 'ねこ', fr: 'chat', t: 5 } },
    daily,
    ach: { first: 123 },
    settings: { newPerDay: 15, prodPerDay: 8, goal: 20, reading: 'always', autoPlay: false, production: true, theme: 'auto', _t: 42 } as AppState['settings']
  }
  return { json: JSON.stringify(st), state: st }
}

describe('compatibilité avec la sauvegarde existante', () => {
  it('une ancienne sauvegarde se charge à l\'identique (cartes, XP, niveau, trophées)', () => {
    const { json, state } = oldSave()
    const loaded = sanitize(JSON.parse(json))
    expect(loaded.cards).toEqual(state.cards)
    expect(loaded.custom).toEqual(state.custom)
    expect(loaded.daily).toEqual(state.daily)
    expect(loaded.ach).toEqual(state.ach)
    expect(totalXp(loaded)).toBe(4500)
    expect(levelFromXp(totalXp(loaded)).level).toBe(levelFromXp(4500).level)
  })
  it('les nouveaux réglages reçoivent une valeur par défaut, les anciens sont gardés', () => {
    const loaded = sanitize(JSON.parse(oldSave().json))
    expect(loaded.settings.preSentences).toBe(0)
    expect(loaded.settings.typing).toBe(false)
    expect(loaded.settings.newPerDay).toBe(15)
    expect(loaded.settings.goal).toBe(20)
    expect(loaded.v).toBe(1)
  })
  it('la fusion ancienne ↔ nouvelle version ne perd rien', () => {
    const { state } = oldSave()
    const mine = sanitize(JSON.parse(JSON.stringify(state)))
    const remote = sanitize(JSON.parse(JSON.stringify(state)))
    remote.settings = { ...remote.settings, preSentences: 2, typing: true, _t: 99 }
    const merged = mergeStates(mine, remote)
    expect(Object.keys(merged.cards).length).toBe(Object.keys(state.cards).length)
    expect(totalXp(merged)).toBe(4500)
    expect(merged.settings.preSentences).toBe(2)
    // et dans l'autre sens (un appareil qui n'a pas encore la mise à jour)
    const back = mergeStates(remote, sanitize(JSON.parse(JSON.stringify(state))))
    expect(Object.keys(back.cards).length).toBe(Object.keys(state.cards).length)
    expect(back.settings.typing).toBe(true)
  })
  it('un état vide ou corrompu ne plante pas', () => {
    expect(sanitize(null)).toEqual(emptyState())
    expect(sanitize({ cards: 5 }).cards).toEqual({})
    expect(DEFAULT_SETTINGS.preSentences).toBe(0)
  })
})

describe('thèmes', () => {
  it('chaque thème contient des mots qui existent', () => {
    const ids = new Set(baseItems.map((i) => i.id))
    for (const t of THEMES) {
      const members = baseItems.filter((i) => inTheme(i.id, t.id))
      expect(members.length, t.id).toBeGreaterThanOrEqual(10)
      expect(members.every((m) => ids.has(m.id))).toBe(true)
    }
  })
  it('météo contient pluie, vent, neige — pas des mots hors sujet', () => {
    for (const jp of ['雨', '風', '雪']) expect(inTheme(byJp(jp).id, 'meteo'), jp).toBe(true)
    expect(inTheme(byJp('食べる').id, 'meteo')).toBe(false)
  })
})

describe('saisie au clavier', () => {
  it('canon tolère les variantes de rōmaji', () => {
    expect(canon('Konnichiwa')).toBe(canon('konnichiwa'))
    expect(canon('shi')).toBe(canon('si'))
    expect(canon('tsukue')).toBe(canon('tukue'))
    expect(canon('gakkou')).toBe(canon('gakkō'))
    expect(canon('gakkou')).toBe(canon('gakkoo'))
    expect(canon("hon'ya")).toBe(canon('honya'))
    expect(canon('ocha')).toBe(canon('otya'))
    expect(canon('jisho')).toBe(canon('zisyo'))
    expect(canon('fuji')).toBe(canon('huzi'))
  })
  it('accepte rōmaji, kana et kanji', () => {
    const konnichiwa = baseItems.find((i) => i.kana === 'こんにちは')!
    expect(konnichiwa).toBeTruthy()
    for (const ok of ['konnichiwa', 'Konnichiwa', 'konnichiha', 'こんにちは', 'コンニチハ', 'konnichi wa'])
      expect(checkTyped(konnichiwa, ok).ok, ok).toBe(true)
    expect(checkTyped(konnichiwa, 'konbanwa').ok).toBe(false)
    expect(checkTyped(konnichiwa, '').script).toBe('vide')
    const gakkou = byJp('学校')
    for (const ok of ['gakkou', 'gakkoo', 'gakkō', 'がっこう', '学校']) expect(checkTyped(gakkou, ok).ok, ok).toBe(true)
    expect(checkTyped(gakkou, 'gakko').ok).toBe(false)
    expect(checkTyped(gakkou, 'gakou').ok).toBe(false)
  })
  it('les mots du deck se valident avec leur propre rōmaji et leur propre kana', () => {
    const bad = baseItems.filter((i) => i.kind === 'word').filter((i) => !checkTyped(i, i.romaji).ok || !checkTyped(i, i.kana).ok)
    expect(bad.map((b) => b.jp + b.romaji)).toEqual([])
  })
})

describe('file de cartes : filtres libres', () => {
  const { items } = buildCatalog({})
  const st = emptyState()
  it('thème : uniquement des mots du thème', () => {
    const q = buildQueue(st, items, { ...ALL, theme: 'meteo', free: true, limit: 500 }, NOW)
    expect(q.fresh.length).toBeGreaterThan(30)
    expect(q.fresh.every((k) => inTheme(k.split(':')[0], 'meteo'))).toBe(true)
  })
  it('séance libre : on choisit le nombre, sans la limite du jour', () => {
    const q = buildQueue(st, items, { ...ALL, free: true, limit: 40 }, NOW)
    expect(q.fresh.length).toBe(40)
    const normal = buildQueue(st, items, ALL, NOW)
    expect(normal.fresh.length).toBe(st.settings.newPerDay)
  })
  it('verbes seulement', () => {
    const q = buildQueue(st, items, { ...ALL, pos: 'verbs', free: true, limit: 25 }, NOW)
    expect(q.fresh.every((k) => items.find((i) => i.id === k.split(':')[0])!.pos === 'v')).toBe(true)
  })
  it('« nouvelles seulement » ne renvoie aucune révision', () => {
    const { state } = oldSave()
    const q = buildQueue({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([k, c]) => [k, { ...c, d: dayNumber(NOW, 0) - 1 }])) }, items, { ...ALL, scope: 'new', free: true, limit: 10 }, NOW)
    expect(q.review.length + q.learning.length).toBe(0)
    expect(q.fresh.length).toBe(10)
  })
  it('entraînement : cartes déjà vues uniquement, production incluse', () => {
    const { state } = oldSave()
    const f: Filter = { ...ALL, free: true, scope: 'practice' }
    const ids = buildPractice(state, items, f)
    expect(ids.length).toBe(600) // 300 mots vus × (reconnaissance + production)
    expect(ids.filter((k) => k.endsWith(':p')).length).toBe(300)
    expect(buildPractice(state, items, { ...f, limit: 12 }).length).toBe(12)
    expect(buildPractice(emptyState(), items, f)).toEqual([])
  })
  it('échauffement : phrases à revoir d\'abord, sinon nouvelles', () => {
    const w = pickWarmup(emptyState(), items, 2, NOW)
    expect(w.length).toBe(2)
    expect(w.every((k) => k.startsWith('s') && k.endsWith(':r'))).toBe(true)
    expect(pickWarmup(emptyState(), items, 0, NOW)).toEqual([])
    // une phrase échue passe avant les nouvelles
    const sid = items.find((i) => i.kind === 'sentence')!.id
    const today = dayNumber(NOW, 0)
    const due: AppState = { ...emptyState(), cards: { [`${sid}:r`]: { ...newCard(NOW), s: 'review', i: 3, d: today - 1, r: 2 } } }
    expect(pickWarmup(due, items, 1, NOW)).toEqual([`${sid}:r`])
  })
})

describe('séances dans le store', () => {
  beforeEach(() => {
    useStore.getState().init()
    const { state } = oldSave()
    useStore.setState({ state })
  })
  it('l\'entraînement ne modifie ni les cartes, ni l\'XP, ni les compteurs', () => {
    const before = JSON.stringify(useStore.getState().state)
    useStore.getState().startSession({ ...ALL, free: true, scope: 'practice', limit: 6 })
    let guard = 0
    while (useStore.getState().session && !useStore.getState().session!.finished && guard++ < 30) {
      useStore.getState().reveal()
      useStore.getState().rate(4)
    }
    const s = useStore.getState().session!
    expect(s.finished).toBe(true)
    expect(s.answered).toBe(6)
    expect(s.xp).toBe(0)
    expect(JSON.stringify(useStore.getState().state)).toBe(before)
  })
  it('entraînement : « Oublié » remet la carte en fin de séance, et l\'annulation fonctionne', () => {
    useStore.getState().startSession({ ...ALL, free: true, scope: 'practice', limit: 3 })
    const first = useStore.getState().session!.current!
    useStore.getState().reveal()
    useStore.getState().rate(1)
    expect(useStore.getState().session!.queue).toContain(first)
    useStore.getState().undo()
    const s = useStore.getState().session!
    expect(s.current).toBe(first)
    expect(s.queue.filter((k) => k === first).length).toBe(0)
    expect(s.answered).toBe(0)
  })
  it('séance normale : les phrases d\'échauffement arrivent en premier et une seule fois', () => {
    useStore.getState().startSession(ALL, 0, { warm: 2 })
    const s = useStore.getState().session!
    expect(s.warm.length).toBe(2)
    expect(s.current).toBe(s.warm[0])
    const all = [s.current!, ...s.queue]
    expect(all.filter((k) => k === s.warm[1]).length).toBe(1)
  })
  it('séance normale : répondre modifie bien la carte et l\'XP (comportement inchangé)', () => {
    const xp0 = totalXp(useStore.getState().state)
    useStore.getState().startSession(ALL)
    const key = useStore.getState().session!.current!
    useStore.getState().reveal()
    useStore.getState().rate(4)
    expect(useStore.getState().state.cards[key]).toBeTruthy()
    expect(totalXp(useStore.getState().state)).toBeGreaterThan(xp0)
  })
})
