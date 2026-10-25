import { describe, expect, it } from 'vitest'
import { answer, answerPractice, dayNumber, memoryOf, newCard, previewLabels, type CardState, type Rating } from '../lib/scheduler'
import { intervalFor, memoryFromSm2, nextMemory, retrievability } from '../lib/fsrs'
import { DEFAULT_SETTINGS, emptyState, mergeStates, sanitize } from '../lib/state'
import { checkSpoken, normalizeJa, oralHistory, oralKey, oralReward, pickOral } from '../lib/oral'
import { listenHistory } from '../lib/rewards'
import type { Item } from '../lib/deck'

const now = Date.UTC(2026, 9, 25, 10)
const today = dayNumber(now)
const rev = (i: number, e = 2.5, extra: Partial<CardState> = {}): CardState => ({ ...newCard(now - i * 86_400_000), s: 'review', i, d: today, e, r: 6, ...extra })

describe('v1.10 — FSRS', () => {
  it('formules de base : à 90 % visés, l\'intervalle vaut la stabilité', () => {
    expect(intervalFor(10, 0.9)).toBeCloseTo(10, 5)
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 5)
    expect(intervalFor(10, 0.85)).toBeGreaterThan(15) // viser 85 % espace beaucoup plus les révisions
    expect(intervalFor(10, 0.95)).toBeLessThan(5)
  })

  it('reprise de l\'historique : la mémoire d\'une ancienne carte vient de son intervalle et de sa facilité', () => {
    const m = memoryOf(rev(20, 2.5))!
    expect(m.s).toBe(20)
    expect(memoryOf(rev(20, 1.3))!.d).toBeGreaterThan(m.d) // facilité basse = carte difficile
    expect(memoryOf(rev(20, 3.0))!.d).toBeLessThan(m.d)
    expect(memoryOf(newCard(now))).toBeNull()
    expect(memoryFromSm2(2.5, 0).s).toBe(1)
  })

  it('chaque réponse enregistre la mémoire FSRS (champs optionnels fs / fd / fr)', () => {
    const o = answer(rev(10), 4, now, today)
    expect(o.card.fs).toBeGreaterThan(10)
    expect(o.card.fd).toBeGreaterThanOrEqual(1)
    expect(o.card.fr).toBe(o.card.r)
    expect(memoryOf(o.card)).toEqual({ s: o.card.fs, d: o.card.fd })
  })

  it('les 5 boutons restent dans l\'ordre : Oublié ≤ Difficile < Hésitant ≤ Bien ≤ Facile', () => {
    for (const [i, e] of [[1, 2.5], [4, 1.3], [12, 2.5], [60, 2.8], [200, 2.0]] as const) {
      const c = rev(i, e)
      const li = (r: Rating) => answer(c, r, now, today).card.li
      const days = (r: Rating) => answer(c, r, now, today).nextDays!
      expect(li(1)).toBeLessThanOrEqual(li(2))
      expect(li(2)).toBeLessThanOrEqual(Math.max(1, i))
      expect(days(3)).toBeLessThanOrEqual(days(4))
      expect(days(4)).toBeLessThanOrEqual(days(5))
      expect(days(4)).toBeGreaterThanOrEqual(3) // v1.9.1 : Bien = retenue
      expect(days(5)).toBeGreaterThanOrEqual(7)
    }
  })

  it('« Difficile » garde la règle v1.7 : retour dans la séance, raté compté, pas un oubli', () => {
    const o = answer(rev(20), 2, now, today)
    expect(o.nextMinutes).toBe(10)
    expect(o.card.s).toBe('relearning')
    expect(o.card.l).toBe(0)
    expect(o.card.li).toBe(10) // la moitié de la mémoire
    expect(o.card.f).toBe(1)
  })

  it('la rétention visée change les intervalles', () => {
    const c = rev(10)
    const at = (ret: number) => answer(c, 4, now, today, ret).nextDays!
    expect(at(0.85)).toBeGreaterThan(at(0.9))
    expect(at(0.9)).toBeGreaterThan(at(0.95))
    expect(previewLabels(c, now, today, 0.85)[4]).not.toBe(previewLabels(c, now, today, 0.95)[4])
  })

  it('une carte en retard de plusieurs semaines mais réussie gagne une grande stabilité', () => {
    const late = { ...rev(10), d: today - 30 } // due il y a 30 jours
    const onTime = rev(10)
    expect(answer(late, 4, now, today).nextDays!).toBeGreaterThan(answer(onTime, 4, now, today).nextDays!)
  })

  it('compatibilité : si un ancien appareil a répondu depuis (r a changé), la mémoire est recalculée', () => {
    const o = answer(rev(10), 4, now, today).card
    // ancienne version : elle recopie la carte (fs/fd/fr gardés) mais avance r, i, d et e à sa façon
    const old: CardState = { ...o, r: o.r + 1, i: 40, d: today + 40, e: 2.6 }
    expect(memoryOf(old)).toEqual(memoryFromSm2(2.6, 40))
  })

  it('l\'ancienne facilité reste tenue à jour (un appareil pas encore mis à jour continue de fonctionner)', () => {
    expect(answer(rev(10), 1, now, today).card.e).toBeCloseTo(2.3)
    expect(answer(rev(10), 5, now, today).card.e).toBeCloseTo(2.65)
  })

  it('entraînement réussi : le planning ne bouge pas et la mémoire FSRS reste valable', () => {
    const c = answer(rev(10), 4, now - 86_400_000, today - 1).card
    const p = answerPractice({ ...c, d: today + 20 }, 4, now, today).card
    expect(p.d).toBe(today + 20)
    expect(p.r).toBe(c.r + 1)
    expect(memoryOf(p)).toEqual(memoryOf(c))
  })

  it('apprentissage d\'une nouvelle carte : la mémoire grandit avec les réussites', () => {
    let c = newCard(now)
    c = answer(c, 3, now, today).card
    const s1 = c.fs!
    c = answer(c, 4, now + 60_000, today).card
    expect(c.fs!).toBeGreaterThan(s1)
    expect(nextMemory(null, 4, 0).s).toBeGreaterThan(nextMemory(null, 3, 0).s)
  })

  it('synchro : les champs FSRS voyagent avec la carte la plus récente', () => {
    const a = { ...emptyState(), cards: { 'w1:r': answer(rev(10), 4, now, today).card } }
    const b = { ...emptyState(), cards: { 'w1:r': rev(10) } }
    expect(mergeStates(b, a).cards['w1:r'].fs).toBeDefined()
  })
})

describe('v1.10 — réglages', () => {
  it('une ancienne sauvegarde reçoit les nouveaux réglages par défaut (voix au verso, 90 %)', () => {
    const old = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, autoPlay: false } } as Record<string, unknown>
    const s = old.settings as Record<string, unknown>
    delete s.retention
    delete s.speakBack
    delete s.voiceName
    delete s.voiceRate
    const st = sanitize(JSON.parse(JSON.stringify(old)))
    expect(st.settings.speakBack).toBe(true)
    expect(st.settings.retention).toBe(0.9)
    expect(st.settings.autoPlay).toBe(false)
  })
})

describe('v1.10 — oral', () => {
  const taberu = { jp: '食べる', kana: 'たべる', alt: [] as string[] }
  it('normalise : espaces, ponctuation et katakana', () => {
    expect(normalizeJa('タベル。')).toBe('たべる')
    expect(normalizeJa(' 食べる ！')).toBe('食べる')
  })
  it('reconnaît le mot en kanji, en kana, ou dans une petite phrase', () => {
    expect(checkSpoken(taberu, ['食べる']).ok).toBe(true)
    expect(checkSpoken(taberu, ['タベル']).ok).toBe(true)
    expect(checkSpoken(taberu, ['ご飯を食べる']).ok).toBe(true)
    expect(checkSpoken({ jp: '秋', kana: 'あき' }, ['秋です']).ok).toBe(true)
    expect(checkSpoken(taberu, ['飲む', '読む']).ok).toBe(false)
    expect(checkSpoken(taberu, ['飲む']).heard).toBe('飲む')
  })
  it('une proposition secondaire du téléphone suffit', () => {
    expect(checkSpoken({ jp: '橋', kana: 'はし' }, ['箸', '橋']).ok).toBe(true)
  })
  it('un seul kana ne valide pas n\'importe quoi', () => {
    expect(checkSpoken({ jp: 'え', kana: 'え' }, ['えいが']).ok).toBe(false)
    expect(checkSpoken({ jp: 'え', kana: 'え' }, ['え']).ok).toBe(true)
  })
  it('XP : réussites × barème, combo, bonus sans faute', () => {
    const r = oralReward('v', Array(10).fill(true))
    expect(r.ok).toBe(10)
    expect(r.answers).toBe(180)
    expect(r.perfect).toBe(50)
    expect(r.total_xp).toBeGreaterThan(r.answers + r.perfect)
    expect(oralReward('h', [true, false, true]).perfect).toBe(0)
  })
  it('historique dans `ach` (clés « o: »), séparé de l\'écoute', () => {
    const ach = { [oralKey('h', 8, 10, now)]: now, [oralKey('v', 10, 10, now + 1)]: now }
    expect(oralHistory(ach)).toHaveLength(2)
    expect(listenHistory(ach)).toHaveLength(0)
  })
  it('choisit d\'abord les mots déjà connus, et seulement des mots pour la production orale', () => {
    const mk = (id: string, kind: Item['kind'], lvl: Item['lvl'] = 'N5'): Item => ({ id, kind, jp: id === 's1' ? 'これは本です' : '食べる', kana: 'たべる', romaji: 'taberu', fr: 'manger', pos: 'v', lvl, deck: lvl, order: 0 })
    const items = [mk('w1', 'word'), mk('w2', 'word'), mk('s1', 'sentence')]
    const cards = { 'w2:r': rev(10) }
    const picked = pickOral(items, cards, 'v', 'sentences', () => 0.5)
    expect(picked.map((i) => i.id)).toEqual(['w2', 'w1'])
    expect(pickOral(items, cards, 'h', 'sentences').map((i) => i.id)).toEqual(['s1'])
  })
})
