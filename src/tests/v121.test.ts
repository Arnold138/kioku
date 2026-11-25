import { beforeEach, describe, expect, it, vi } from 'vitest'
import { answer, dayNumber, newCard, type CardState, type Rating } from '../lib/scheduler'
import { emptyState, mergeStates, sanitize } from '../lib/state'
import { romajiHidden } from '../lib/aid'
import { isSayCard } from '../components/SayCard'
import { DEFAULT_LOOP, buildLoop, carCommand, loadLoopPrefs, saveLoopPrefs, wellKnown } from '../lib/loop'
import { baseItems } from '../lib/deck'
import { isNaturalId } from '../lib/natural'
import words from '../data/words.json'

const NOW = Date.UTC(2026, 10, 25, 12)
const today = dayNumber(NOW)
const DAY = 86_400_000
const rev = (over: Partial<CardState> = {}): CardState => ({ ...newCard(NOW - 10 * DAY), s: 'review', i: 5, d: today, r: 3, t: NOW - 5 * DAY, ...over })
const chain = (rs: Rating[]) => {
  let c = rev()
  rs.forEach((r, k) => { c = answer(c, r, NOW + k * 5 * DAY, today + k * 5).card })
  return c
}

describe('v1.21 — plus de rōmaji après 2 réussites d\'affilée', () => {
  it('« Bien » et « Facile » comptent, une hésitation ou un raté remet à zéro', () => {
    expect(chain([4]).ok).toBe(1)
    expect(chain([4, 5]).ok).toBe(2)
    expect(chain([4, 4, 3]).ok).toBe(0)
    expect(chain([4, 4, 1]).ok).toBe(0)
    expect(chain([4, 2, 4]).ok).toBe(1)
  })

  it('le rōmaji disparaît à 2, revient après une erreur', () => {
    expect(romajiHidden(undefined)).toBe(false)
    expect(romajiHidden(chain([4]))).toBe(false)
    expect(romajiHidden(chain([4, 4]))).toBe(true)
    expect(romajiHidden(chain([4, 4, 1]))).toBe(false)
  })

  it('une carte d\'avant la mise à jour (sans le champ) garde son rōmaji', () => {
    const old = rev()
    delete (old as Partial<CardState>).ok
    expect(romajiHidden(old)).toBe(false)
  })
})

describe('v1.21 — « Dis-la de mémoire » pour 1 phrase sur 3', () => {
  it('jamais pour une phrase jamais vue', () => {
    for (const s of baseItems.filter((it) => it.kind === 'sentence').slice(0, 50)) expect(isSayCard(s.id, 0)).toBe(false)
  })
  it('une révision sur trois', () => {
    for (const id of ['s159', 's200', 's300']) {
      const n = [1, 2, 3, 4, 5, 6].filter((r) => isSayCard(id, r)).length
      expect(n).toBe(2)
    }
  })
})

describe('v1.21 — écoute en boucle', () => {
  const ws = baseItems.filter((it) => it.kind === 'word' && it.lvl === 'N5')

  it('les mots les plus ratés d\'abord, puis nouveau mot, puis phrase, en alternance', () => {
    const cards: Record<string, CardState> = {
      [`${ws[0].id}:r`]: rev({ f: 3 }),
      [`${ws[1].id}:r`]: rev({ f: 14 }),
      [`${ws[2].id}:r`]: rev({ f: 9 }),
    }
    const list = buildLoop(cards, baseItems, today, 30)
    expect(list.slice(0, 4).map((e) => e.tag)).toEqual(['miss', 'new', 'phrase', 'block']) // v1.22 : + blocs
    expect(list.filter((e) => e.tag === 'miss').map((e) => e.it.id)).toEqual([ws[1].id, ws[2].id, ws[0].id])
    expect(list[0].label).toBe('mot difficile · raté 14 fois')
    expect(list).toHaveLength(30)
  })

  it('les mots bien connus et les mots déjà vus ne passent pas comme « nouveaux »', () => {
    const known = rev({ f: 6, i: 80 })
    expect(wellKnown(known)).toBe(true)
    const cards: Record<string, CardState> = { [`${ws[0].id}:r`]: known, [`${ws[1].id}:r`]: rev() }
    const list = buildLoop(cards, baseItems, today, 60)
    expect(list.some((e) => e.it.id === ws[0].id)).toBe(false)
    expect(list.some((e) => e.it.id === ws[1].id)).toBe(false)
  })

  it('pas de phrases des vidéos ; les phrases changent d\'un jour à l\'autre', () => {
    const a = buildLoop({}, baseItems, today, 60).filter((e) => e.tag === 'phrase')
    const b = buildLoop({}, baseItems, today + 1, 60).filter((e) => e.tag === 'phrase')
    expect(a.every((e) => !isNaturalId(e.it.id))).toBe(true)
    expect(a.map((e) => e.it.id)).not.toEqual(b.map((e) => e.it.id))
  })

  describe('réglages', () => {
    beforeEach(() => {
      const store: Record<string, string> = {}
      vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
    })
    it('valeurs par défaut, puis gardées ; une valeur inconnue est ignorée', () => {
      expect(loadLoopPrefs()).toEqual(DEFAULT_LOOP)
      saveLoopPrefs({ dur: 15, gap: 4, fmt: 'mix' }) // v1.22 : + format d'écoute
      expect(loadLoopPrefs()).toEqual({ dur: 15, gap: 4, fmt: 'mix' })
      localStorage.setItem('kioku:ecoute', JSON.stringify({ dur: 7, gap: 99 }))
      expect(loadLoopPrefs()).toEqual(DEFAULT_LOOP)
    })
  })
})

describe('v1.21 — mode voiture : commandes à la voix', () => {
  it('comprend bien, facile, encore, difficile, hésitant', () => {
    expect(carCommand(['bien'])).toBe(4)
    expect(carCommand(['Facile !'])).toBe(5)
    expect(carCommand(['encore'])).toBe(1)
    expect(carCommand(['Difficile'])).toBe(2)
    expect(carCommand(['hésitant'])).toBe(3)
    expect(carCommand(['euh', 'bien sûr'])).toBe(4)
    expect(carCommand(['bonjour la radio'])).toBe(null)
  })
})

describe('v1.21 — compatibilité', () => {
  it('le champ ok survit à une sauvegarde et à la synchro', () => {
    const mine = { ...emptyState(), cards: { 'w8:r': rev({ ok: 2, t: NOW }) } }
    const s = sanitize(JSON.parse(JSON.stringify(mine)))
    expect(s.v).toBe(1)
    expect(s.cards['w8:r'].ok).toBe(2)
    // un ancien appareil modifie la carte plus tard sans connaître le champ : la carte la plus récente gagne
    const oldDevice = { ...emptyState(), cards: { 'w8:r': { ...rev({ t: NOW + 1000 }) } } }
    delete (oldDevice.cards['w8:r'] as Partial<CardState>).ok
    const merged = mergeStates(mine, oldDevice)
    expect(merged.cards['w8:r'].t).toBe(NOW + 1000)
    expect(romajiHidden(merged.cards['w8:r'])).toBe(false)
  })
})

describe('v1.21 — vocabulaire corrigé', () => {
  const byId = new Map((words as Array<{ id: number; jp: string; kana: string; fr: string }>).map((w) => [w.id, w]))
  it('優しい veut dire gentil (facile, c\'est 易しい)', () => {
    expect(byId.get(1241)!.fr).not.toMatch(/facile/)
    expect(byId.get(628)!.fr).toBe('facile')
  })
  it('orthographes réparées', () => {
    expect(byId.get(768)!.jp).toBe('落ちる')
    expect(byId.get(965)!.jp).toBe('楽しむ')
    expect(byId.get(1105)!.jp).toBe('堅い')
    expect(byId.get(1161)!.jp).toBe('下がる')
    expect(byId.get(679)!.jp).toBe('ずっと')
    expect(byId.get(1093)!.kana).toBe('おかねもち')
  })
})
