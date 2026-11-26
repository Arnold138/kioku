import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../lib/store'
import { emptyState } from '../lib/state'
import { dayKey, dayNumber } from '../lib/scheduler'
import { BLOCKS } from '../lib/loop'
import { toRomaji } from '../lib/romaji'

const todayKey = () => dayKey(dayNumber(Date.now()))
const secToday = () => Object.values(useStore.getState().state.daily[todayKey()] ?? {}).reduce((a, d) => a + d.sec, 0)

describe('v1.23 — le temps d\'écoute compte dans « Progrès »', () => {
  beforeEach(() => {
    useStore.getState().init()
    useStore.setState({ state: emptyState() })
  })
  it('les secondes écoutées s\'ajoutent au temps du jour, sans XP ni carte', () => {
    useStore.getState().addListenTime(30)
    useStore.getState().addListenTime(30)
    const d = Object.values(useStore.getState().state.daily[todayKey()])[0]
    expect(secToday()).toBe(60)
    expect(d.xp).toBe(0)
    expect(d.n).toBe(0)
    expect(Object.keys(useStore.getState().state.cards)).toHaveLength(0)
  })
  it('rien pour 0 s ; un envoi est plafonné à 10 min', () => {
    useStore.getState().addListenTime(0)
    expect(useStore.getState().state.daily[todayKey()]).toBeUndefined()
    useStore.getState().addListenTime(5000)
    expect(secToday()).toBe(600)
  })
})

describe('v1.23 — rōmaji au retournement', () => {
  it('les blocs ont un rōmaji lisible (espacé comme les kana)', () => {
    const b = BLOCKS.find((x) => x.jp === 'やっぱりそうか')!
    expect(toRomaji(b.kana)).toBe('yappari sou ka')
  })
})
