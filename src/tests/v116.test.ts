import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, emptyState, mergeStates, sanitize } from '../lib/state'
import {
  ROOM_BASE_KEY, ROOM_BULBS, ROOM_EVERY, ROOM_TOTAL, nextRoomBook, roomBase, roomBooks, roomPoints, withRoomBase,
} from '../lib/room'

describe('v1.16 — points et livres de la chambre', () => {
  it('1 point par mot, 3 par phrase', () => {
    expect(roomPoints({ wordsKnownR: 612, sentencesKnown: 48 })).toBe(612 + 144)
    expect(roomPoints({ wordsKnownR: 0, sentencesKnown: 0 })).toBe(0)
    expect(roomPoints({ wordsKnownR: -3, sentencesKnown: 2 })).toBe(6)
  })

  it('un livre tous les 25 points depuis le repère, 6 au maximum', () => {
    expect(ROOM_EVERY).toBe(25)
    expect(ROOM_TOTAL).toBe(6)
    expect(roomBooks(756, 756)).toBe(0)
    expect(roomBooks(780, 756)).toBe(0)
    expect(roomBooks(781, 756)).toBe(1)
    expect(roomBooks(756 + 3 * 25, 756)).toBe(3)
    expect(roomBooks(5000, 756)).toBe(6)
    expect(roomBooks(700, 756)).toBe(0) // une carte oubliée ne fait pas descendre sous 0
  })

  it('annonce le livre suivant', () => {
    expect(nextRoomBook(756, 756)).toEqual({ n: 1, left: 25 })
    expect(nextRoomBook(770, 756)).toEqual({ n: 1, left: 11 })
    expect(nextRoomBook(756 + 60, 756)).toEqual({ n: 3, left: 15 })
    expect(nextRoomBook(756 + 150, 756)).toBeNull()
  })

  it('le repère est posé une seule fois, et 0 point reste un vrai repère', () => {
    const s = { ...emptyState() }
    const a = withRoomBase(s, 756)
    expect(a.ach[ROOM_BASE_KEY]).toBe(757)
    expect(roomBase(a.ach, 900)).toBe(756)
    const again = withRoomBase(a, 900)
    expect(again).toBe(a) // inchangé
    const zero = withRoomBase({ ...emptyState() }, 0)
    expect(zero.ach[ROOM_BASE_KEY]).toBe(1)
    expect(roomBase(zero.ach, 40)).toBe(0)
    // sans repère : on part des points actuels (0 livre)
    expect(roomBase({}, 321)).toBe(321)
  })

  it('les lumières qui scintillent sont dans la peinture', () => {
    expect(ROOM_BULBS.length).toBeGreaterThan(5)
    ROOM_BULBS.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1136)
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(1408)
    })
  })
})

describe('v1.16 — compatibilité et synchro', () => {
  it('une ancienne sauvegarde (v1.15) s\'ouvre sans repère et sans rien perdre', () => {
    const old = JSON.parse(JSON.stringify({ ...emptyState(), settings: { ...DEFAULT_SETTINGS } }))
    old.ach = { 'fe:momiji:2026': 1, 'm:v19': 123 }
    const s = sanitize(old)
    expect(s.ach[ROOM_BASE_KEY]).toBeUndefined()
    expect(s.ach['m:v19']).toBe(123)
    expect(s.v).toBe(1)
    const withBase = withRoomBase(s, 756)
    expect(withBase.ach['fe:momiji:2026']).toBe(1)
    expect(withBase.cards).toBe(s.cards)
  })

  it('deux appareils avec des repères différents : on garde le plus ancien (le plus bas), donc plus de livres', () => {
    const phone = withRoomBase({ ...emptyState() }, 700)
    const pc = withRoomBase({ ...emptyState() }, 760)
    const m = mergeStates(phone, pc)
    expect(roomBase(m.ach, 800)).toBe(700)
    expect(roomBooks(800, roomBase(m.ach, 800))).toBe(4)
  })

  it('un ancien appareil sans le repère ne l\'efface pas à la synchro', () => {
    const recent = withRoomBase({ ...emptyState() }, 700)
    const oldDevice = { ...emptyState() }
    expect(mergeStates(oldDevice, recent).ach[ROOM_BASE_KEY]).toBe(701)
    expect(mergeStates(recent, oldDevice).ach[ROOM_BASE_KEY]).toBe(701)
  })
})
