import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, emptyState, mergeStates, sanitize } from '../lib/state'
import {
  ROOM_BULBS, ROOM_COUNTS, ROOM_EVERY, ROOM_REWARDS, ROOM_TOTAL, WEATHER,
  fetchWeather, nextRoomReward, phaseFromElevation, roomPhase, roomPos, roomStep, roomWeather, sunElevation, weatherFromCode,
} from '../lib/room'

describe('v1.15 — paliers de la chambre', () => {
  it('une amélioration tous les 50 mots retenus, 16 en tout', () => {
    expect(ROOM_EVERY).toBe(50)
    expect(ROOM_TOTAL).toBe(16)
    expect(ROOM_COUNTS.reduce((a, b) => a + b, 0)).toBe(ROOM_TOTAL)
    expect(roomStep(0)).toBe(0)
    expect(roomStep(49)).toBe(0)
    expect(roomStep(50)).toBe(1)
    expect(roomStep(600)).toBe(12)
    expect(roomStep(800)).toBe(16)
    expect(roomStep(5000)).toBe(16)
    expect(roomStep(-10)).toBe(0)
  })

  it('le palier choisit le bon tableau et les objets déjà révélés', () => {
    expect(roomPos(0)).toEqual({ k: 0, p: 0 })
    expect(roomPos(7)).toEqual({ k: 0, p: 7 })
    expect(roomPos(8)).toEqual({ k: 1, p: 0 })
    expect(roomPos(9)).toEqual({ k: 1, p: 1 })
    expect(roomPos(12)).toEqual({ k: 2, p: 0 })
    expect(roomPos(16)).toEqual({ k: 3, p: 0 })
    expect(roomPos(99)).toEqual({ k: 3, p: 0 })
  })

  it('annonce la prochaine amélioration (Arnold ≈ 600 mots → la calligraphie à 650)', () => {
    expect(nextRoomReward(600)).toEqual({ name: ROOM_REWARDS[12], at: 650, left: 50 })
    expect(nextRoomReward(612)?.left).toBe(38)
    expect(nextRoomReward(0)).toEqual({ name: 'Guirlande lumineuse', at: 50, left: 50 })
    expect(nextRoomReward(800)).toBeNull()
  })

  it('les ampoules qui scintillent pointent sur des objets existants', () => {
    expect(ROOM_BULBS).toHaveLength(4)
    ROOM_BULBS.forEach((list, k) => list.forEach(([x, y, obj]) => {
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(1136)
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(1408)
      if (k < 3) expect(obj).toBeLessThanOrEqual(ROOM_COUNTS[k])
      else expect(obj).toBe(0)
    }))
  })
})

describe('v1.15 — heure du soleil à Valence', () => {
  it('hauteur du soleil juste à ±1,5°', () => {
    // midi solaire au solstice d'été : 90 − 44,93 + 23,44 ≈ 68,5°
    expect(sunElevation(new Date('2026-06-21T11:42:00Z'))).toBeGreaterThan(67)
    expect(sunElevation(new Date('2026-06-21T11:42:00Z'))).toBeLessThan(70)
    // midi solaire au solstice d'hiver : 90 − 44,93 − 23,44 ≈ 21,6°
    expect(Math.abs(sunElevation(new Date('2026-12-21T11:40:00Z')) - 21.6)).toBeLessThan(1.5)
    // minuit : sous l'horizon
    expect(sunElevation(new Date('2026-06-21T23:42:00Z'))).toBeLessThan(-18)
  })

  it('jour, crépuscule, nuit, avec des fondus doux qui font toujours 100 %', () => {
    expect(phaseFromElevation(30)).toEqual({ day: 1, dusk: 0, night: 0 })
    expect(phaseFromElevation(-20)).toEqual({ day: 0, dusk: 0, night: 1 })
    expect(phaseFromElevation(0).dusk).toBe(1)
    for (let e = -20; e <= 20; e += 0.5) {
      const p = phaseFromElevation(e)
      expect(p.day + p.dusk + p.night).toBeCloseTo(1, 6)
    }
    // 2 novembre à 21 h à Valence : nuit ; à 13 h : jour ; vers 17 h 30 : crépuscule
    expect(roomPhase('auto', new Date('2026-11-02T20:00:00Z')).night).toBe(1)
    expect(roomPhase('auto', new Date('2026-11-02T12:00:00Z')).day).toBe(1)
    expect(roomPhase('auto', new Date('2026-11-02T16:30:00Z')).dusk).toBeGreaterThan(0.5)
  })

  it('le réglage Ciel peut figer l\'heure', () => {
    const d = new Date('2026-11-02T20:00:00Z')
    expect(roomPhase('jour', d)).toEqual({ day: 1, dusk: 0, night: 0 })
    expect(roomPhase('aube', d)).toEqual({ day: 0, dusk: 1, night: 0 })
    expect(roomPhase('nuit', d)).toEqual({ day: 0, dusk: 0, night: 1 })
  })
})

describe('v1.15 — météo', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('codes météo : pluie, nuages, ciel clair', () => {
    expect(weatherFromCode(61)).toEqual(WEATHER.pluie)
    expect(weatherFromCode(95)).toEqual(WEATHER.pluie)
    expect(weatherFromCode(3)).toEqual(WEATHER.nuages)
    expect(weatherFromCode(45).rain).toBe(0)
    expect(weatherFromCode(0).rain).toBe(0)
    expect(weatherFromCode(0).cloud).toBeLessThan(0.3)
  })

  it('réglage figé > vraie météo > pluie par défaut', () => {
    expect(roomWeather('clair', WEATHER.pluie)).toEqual(WEATHER.clair)
    expect(roomWeather('auto', WEATHER.nuages)).toEqual(WEATHER.nuages)
    expect(roomWeather('auto', null)).toEqual(WEATHER.pluie)
    expect(roomWeather(undefined, null)).toEqual(WEATHER.pluie)
  })

  it('va chercher la météo à Valence, la garde 30 min, et ne casse rien hors ligne', async () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ current: { weather_code: 63 } }) }))
    vi.stubGlobal('fetch', fetchMock)
    const t = Date.parse('2026-11-02T20:00:00Z')
    expect(await fetchWeather(t)).toEqual(WEATHER.pluie)
    expect(String(fetchMock.mock.calls[0][0])).toContain('latitude=44.93')
    expect(await fetchWeather(t + 10 * 60_000)).toEqual(WEATHER.pluie)
    expect(fetchMock).toHaveBeenCalledTimes(1) // gardée en cache
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('hors ligne') }))
    expect(await fetchWeather(t + 40 * 60_000)).toBeNull()
  })
})

describe('v1.15 — compatibilité', () => {
  it('une ancienne sauvegarde s\'ouvre sur la chambre, météo auto, sans rien perdre', () => {
    const old = JSON.parse(JSON.stringify({ ...emptyState(), settings: { ...DEFAULT_SETTINGS } }))
    delete old.settings.home
    delete old.settings.weather
    old.ach = { 'fe:momiji:2026': 1, 'h:2026-11-01:x': 1 }
    const s = sanitize(old)
    expect(s.settings.home ?? 'chambre').toBe('chambre')
    expect(s.settings.weather ?? 'auto').toBe('auto')
    expect(s.ach['fe:momiji:2026']).toBe(1) // décorations du village gardées
    expect(s.v).toBe(1)
  })

  it('le choix Village voyage à la synchro, et un ancien appareil ne l\'efface pas', () => {
    const a = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, home: 'village' as const, weather: 'clair' as const, _t: 200 } }
    const oldDevice = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, _t: 100 } }
    delete (oldDevice.settings as Partial<typeof oldDevice.settings>).home
    const m = mergeStates(oldDevice, a)
    expect(m.settings.home).toBe('village')
    expect(m.settings.weather).toBe('clair')
  })
})
