import { describe, expect, it, beforeEach } from 'vitest'
import { dayKey, dayNumber, newCard, type CardState } from '../lib/scheduler'
import { emptyState, mergeStates, sanitize, DEFAULT_SETTINGS, totalXp } from '../lib/state'
import { baseItems } from '../lib/deck'
import { ALL } from '../lib/queue'
import { useStore, comboAfter } from '../lib/store'
import { ACHIEVEMENTS } from '../lib/achievements'
import {
  BUILDINGS, SOLID, buildingsFor, cityStatuses, currentCity, levelProgress, signText, skyFor, stageOf, villageStats,
  villagerCount, villagerKey, villagerLine, VILLAGER_PER_DAY
} from '../lib/village'
import { COLLECTION_MULT, SHINY_MULT, SHINY_ODDS, isLucky, isRecovered, shinyBefore, shinyKey, shinyOutcome } from '../lib/shiny'

const now = Date.now()
const today = dayNumber(now)
const day = dayKey(today)
const known = (extra: Partial<CardState> = {}): CardState => ({ ...newCard(now - 3 * 86_400_000), s: 'review', i: 10, d: today + 5, r: 4, ...extra })
const due = (extra: Partial<CardState> = {}): CardState => ({ ...newCard(now - 3 * 86_400_000), s: 'review', i: 3, d: today, r: 3, ...extra })
const words = (lvl: string) => baseItems.filter((i) => i.kind === 'word' && i.lvl === lvl)

describe('v1.11 — combo', () => {
  it('Bien +1, Facile +2, Hésitant et Difficile en pause, Oublié remet à zéro', () => {
    expect(comboAfter(4, 4)).toBe(5)
    expect(comboAfter(4, 5)).toBe(6)
    expect(comboAfter(4, 3)).toBe(4)
    expect(comboAfter(4, 2)).toBe(4)
    expect(comboAfter(4, 1)).toBe(0)
  })

  describe('pendant une séance', () => {
    beforeEach(() => {
      useStore.getState().init()
      const st = emptyState()
      st.settings = { ...st.settings, reviewsPerDay: 0, newPerDay: 0, naturalPerDay: 0, production: false, chunk: 0 }
      words('N5').slice(0, 20).forEach((w) => (st.cards[`${w.id}:r`] = due()))
      useStore.setState({ state: st, session: null, toasts: [] })
    })
    it('Hésitant ne fait plus monter le combo, Facile le fait monter de 2', () => {
      const g = () => useStore.getState().session!
      useStore.getState().startSession(ALL)
      useStore.getState().reveal(); useStore.getState().rate(4)
      useStore.getState().reveal(); useStore.getState().rate(3)
      expect(g().combo).toBe(1)
      useStore.getState().reveal(); useStore.getState().rate(5)
      expect(g().combo).toBe(3)
      useStore.getState().reveal(); useStore.getState().rate(1)
      expect(g().combo).toBe(0)
      expect(g().bestCombo).toBe(3)
    })
  })
})

describe('v1.11 — village', () => {
  it('paliers des bâtiments : terrain, cabane (10 %), maison (40 %), boutique illuminée (75 %)', () => {
    expect(stageOf(0)).toBe(0)
    expect(stageOf(0.1)).toBe(1)
    expect(stageOf(0.39)).toBe(1)
    expect(stageOf(0.4)).toBe(2)
    expect(stageOf(0.75)).toBe(3)
  })

  it('un bâtiment compte les mots retenus de son thème et de son niveau, et les cartes à revoir (feuilles)', () => {
    const st = emptyState()
    const food = BUILDINGS.find((b) => b.id === 'nourriture')!
    const n5food = words('N5').filter(food.match)
    n5food.slice(0, 5).forEach((w) => (st.cards[`${w.id}:r`] = known()))
    n5food.slice(5, 7).forEach((w) => (st.cards[`${w.id}:r`] = due({ i: 2 })))
    const b = buildingsFor(st, baseItems, 'N5', now).find((x) => x.id === 'nourriture')!
    expect(b.total).toBe(n5food.length)
    expect(b.known).toBe(5)
    expect(b.leaves).toBe(2)
    expect(b.pct).toBeCloseTo(5 / n5food.length)
    // les mots N4 ne comptent pas dans le village N5
    expect(buildingsFor(st, baseItems, 'N4', now).find((x) => x.id === 'nourriture')!.known).toBe(0)
  })

  it('une ville s\'ouvre quand le niveau d\'avant est solide (80 %)', () => {
    const st = emptyState()
    expect(currentCity(cityStatuses(st, baseItems)).id).toBe('shirakawa')
    const n5 = words('N5')
    n5.slice(0, Math.ceil(n5.length * SOLID)).forEach((w) => (st.cards[`${w.id}:r`] = known()))
    const lp = levelProgress(st, baseItems)
    expect(lp[0].solid).toBe(true)
    const cities = cityStatuses(st, baseItems)
    expect(cities[0].built).toBe(true)
    expect(cities[1].unlocked).toBe(true)
    expect(cities[2].unlocked).toBe(false)
    expect(currentCity(cities).id).toBe('nara')
    // N2 et N1 n'ont pas encore de mots : jamais choisis comme ville en cours
    expect(cities[3].noWords).toBe(true)
  })

  it('enseignes : les kanji inconnus deviennent « ？ », les kana restent', () => {
    expect(signText('ラーメン屋', new Set())).toEqual({ text: 'ラーメン？', hidden: 1 })
    expect(signText('ラーメン屋', new Set(['屋']))).toEqual({ text: 'ラーメン屋', hidden: 0 })
  })

  it('ciel selon l\'heure', () => {
    expect(skyFor(6)).toBe('aube')
    expect(skyFor(12)).toBe('jour')
    expect(skyFor(19)).toBe('aube')
    expect(skyFor(23)).toBe('nuit')
    expect(skyFor(2)).toBe('nuit')
  })

  it('feuilles balayées = révisions de cartes apprises, depuis toujours', () => {
    const st = emptyState()
    st.daily = { '2026-10-01': { a: { n: 10, nw: 0, np: 0, ok: 8, xp: 0, sec: 0, rv: 7 } }, '2026-10-02': { b: { n: 5, nw: 0, np: 0, ok: 5, xp: 0, sec: 0, rv: 4 } } }
    expect(villageStats(st, baseItems, now).swept).toBe(11)
  })

  it('un habitant dit une phrase qui reprend un mot retenu ; +10 XP, 3 fois par jour au plus', () => {
    useStore.getState().init()
    const st = emptyState()
    words('N5').slice(0, 120).forEach((w) => (st.cards[`${w.id}:r`] = known()))
    useStore.setState({ state: st, session: null, toasts: [] })
    const line = villagerLine(st, baseItems, now)
    expect(line).not.toBeNull()
    expect(villagerLine(st, baseItems, now)!.id).toBe(line!.id) // la même toute la journée
    const xp0 = totalXp(useStore.getState().state)
    expect(useStore.getState().understandVillager(line!.id)).toBe(10)
    expect(useStore.getState().understandVillager(line!.id)).toBe(0) // pas deux fois la même
    expect(useStore.getState().state.ach[villagerKey(day, line!.id)]).toBeTruthy()
    useStore.getState().understandVillager('x1')
    useStore.getState().understandVillager('x2')
    expect(useStore.getState().understandVillager('x3')).toBe(0) // plafond du jour
    expect(villagerCount(useStore.getState().state.ach, day)).toBe(VILLAGER_PER_DAY + 1)
    expect(totalXp(useStore.getState().state) - xp0).toBeGreaterThanOrEqual(30)
  })

  it('trophées du village : ids uniques et présents', () => {
    const ids = ACHIEVEMENTS.filter((a) => a.family === 'village').map((a) => a.id)
    expect(ids).toContain('vLantern')
    expect(ids).toContain('vNara')
    expect(ids).toContain('sh1')
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })
})

describe('v1.11 — cartes shiny', () => {
  it('environ une carte sur 80, toujours la même pour une carte et un jour', () => {
    let n = 0
    for (let i = 0; i < 8000; i++) if (isLucky(`w${i}:r`, day)) n++
    expect(n).toBeGreaterThan(8000 / SHINY_ODDS / 2)
    expect(n).toBeLessThan((8000 / SHINY_ODDS) * 2)
    expect(isLucky('w12:r', day)).toBe(isLucky('w12:r', day))
  })

  it('mot récupéré : raté au moins 3 fois, puis réussi 3 fois d\'affilée', () => {
    expect(isRecovered(known({ f: 3, w: 3 }))).toBe(true)
    expect(isRecovered(known({ f: 3, w: 2 }))).toBe(false)
    expect(isRecovered(known({ f: 1, w: 5 }))).toBe(false)
  })

  it('multiplicateurs : ×5 chanceuse ou récupérée (si Bien/Facile), ×2 pour la collection, rien sur un raté', () => {
    expect(shinyOutcome('lucky', known(), 4, false)).toEqual({ mult: SHINY_MULT, joins: true, recovered: false })
    expect(shinyOutcome('lucky', known(), 1, false).mult).toBe(1)
    expect(shinyOutcome(null, known({ f: 4, w: 3 }), 5, false)).toEqual({ mult: SHINY_MULT, joins: true, recovered: true })
    expect(shinyOutcome('collection', known({ f: 4, w: 4 }), 4, true)).toEqual({ mult: COLLECTION_MULT, joins: false, recovered: false })
  })

  it('une carte de la collection reste shiny ; une nouvelle carte n\'est jamais chanceuse', () => {
    const lucky = Array.from({ length: 2000 }, (_, i) => `w${i}:r`).find((k) => isLucky(k, day))!
    expect(shinyBefore({}, lucky, day, false)).toBe('lucky')
    expect(shinyBefore({}, lucky, day, true)).toBeNull()
    expect(shinyBefore({ [shinyKey('w1:r')]: 1 }, 'w1:r', day, false)).toBe('collection')
  })

  it('en séance : une carte chanceuse réussie entre dans la collection (×5 XP), et l\'annulation l\'en retire', () => {
    const n5 = words('N5')
    const lucky = n5.find((w) => isLucky(`${w.id}:r`, day))!
    useStore.getState().init()
    const st = emptyState()
    st.settings = { ...st.settings, reviewsPerDay: 0, newPerDay: 0, naturalPerDay: 0, production: false, chunk: 0 }
    st.cards[`${lucky.id}:r`] = due()
    useStore.setState({ state: st, session: null, toasts: [] })
    useStore.getState().startSession(ALL)
    expect(useStore.getState().session!.current).toBe(`${lucky.id}:r`)
    useStore.getState().reveal()
    useStore.getState().rate(4)
    const s1 = useStore.getState()
    expect(s1.state.ach[shinyKey(`${lucky.id}:r`)]).toBeTruthy()
    expect(s1.session!.xp).toBeGreaterThanOrEqual(50)
    useStore.getState().undo()
    expect(useStore.getState().state.ach[shinyKey(`${lucky.id}:r`)]).toBeUndefined()
  })
})

describe('v1.11 — compatibilité', () => {
  it('une ancienne sauvegarde reçoit le ciel automatique', () => {
    const old = JSON.parse(JSON.stringify({ ...emptyState(), settings: { ...DEFAULT_SETTINGS } }))
    delete old.settings.sky
    expect(sanitize(old).settings.sky).toBe('auto')
  })
  it('la collection shiny et les habitants voyagent dans `ach` et fusionnent à la synchro', () => {
    const a = { ...emptyState(), ach: { [shinyKey('w1:r')]: 100, [villagerKey(day, 's1')]: 50 } }
    const b = { ...emptyState(), ach: { [shinyKey('w1:r')]: 80, [shinyKey('w2:r')]: 90 } }
    const m = mergeStates(a, b)
    expect(m.ach[shinyKey('w1:r')]).toBe(80)
    expect(m.ach[shinyKey('w2:r')]).toBe(90)
    expect(m.ach[villagerKey(day, 's1')]).toBe(50)
  })
})
