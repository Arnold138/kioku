import { beforeAll, describe, expect, it } from 'vitest'
import blocksJson from '../data/blocks.json'
import glossJson from '../data/gloss.json'
import { glossInRange, glossPieces, setGlossData } from '../lib/gloss'
import { buildCatalog } from '../lib/deck'
import { DEFAULT_SETTINGS, emptyState, mergeStates, sanitize } from '../lib/state'
import { answer, newCard, type CardState } from '../lib/scheduler'
import {
  RECALL_FROM_DAYS, blockMode, blocksFor, changeChoices, checkRecall, originalPart, rebuildPieces, setBlocksData,
  shuffled, stepsFor, suggestRating, variantSentence, type SentenceBlocks,
} from '../lib/blocks'

type Raw = Parameters<typeof setBlocksData>[0]
beforeAll(() => {
  setBlocksData(blocksJson as unknown as Raw)
  setGlossData(glossJson as unknown as Parameters<typeof setGlossData>[0])
})

const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length] }
const review = (i: number): CardState => ({ ...newCard(0), s: 'review', i, d: 100, r: 3 })

describe('v1.17 — découpage en blocs', () => {
  const sentences = buildCatalog({}).items.filter((it) => it.kind === 'sentence')

  it('presque toutes les phrases ont leurs blocs, et les blocs recollés redonnent la phrase exacte', () => {
    let withBlocks = 0
    for (const it of sentences) {
      const sb = blocksFor(it.id)
      if (!sb) continue
      withBlocks++
      expect(sb.blocks.map((b) => b.jp).join('')).toBe(it.jp)
      expect(sb.blocks.map((b) => b.kana).join('')).toBe(it.kana.replace(/\s+/g, ''))
      expect(sb.blocks.length).toBeLessThanOrEqual(7)
      sb.blocks.forEach((b) => { expect(b.jp.length).toBeGreaterThan(0) })
    }
    expect(withBlocks).toBeGreaterThanOrEqual(sentences.length - 2)
  })

  it('un mot en kanji n\'est jamais coupé entre deux blocs', () => {
    expect(blocksFor('s43')!.blocks.map((b) => b.jp)).toEqual(['毎朝', '六時に', '起きます。'])
    expect(blocksFor('v1-1')!.blocks.map((b) => b.jp)).toEqual(['今日は', '今から', '買い物に', '行きます。'])
    expect(blocksFor('v2-731')!.blocks.map((b) => b.jp)).toContain('少女漫画を')
  })

  it('les variantes sont justes : bonnes places, un vrai changement, une traduction', () => {
    let n = 0
    for (const it of sentences) {
      const sb = blocksFor(it.id)
      if (!sb?.variant) continue
      n++
      const v = sb.variant
      expect(v.i).toBeGreaterThanOrEqual(0)
      expect(v.j).toBeGreaterThanOrEqual(v.i)
      expect(v.j).toBeLessThan(sb.blocks.length)
      expect(v.fr.length).toBeGreaterThan(3)
      expect(v.jp).not.toBe(originalPart(sb)!.jp)
    }
    expect(n).toBeGreaterThan(400)
    const sb = blocksFor('v1-1')!
    expect(variantSentence(sb)!.jp).toBe('今日は今から散歩に行きます。')
  })
})

describe('v1.17 — étapes', () => {
  const sb: SentenceBlocks = {
    blocks: [{ jp: '今日は', kana: 'きょうは' }, { jp: '今から', kana: 'いまから' }, { jp: '買い物に', kana: 'かいものに' }, { jp: '行きます。', kana: 'いきます' }],
    variant: { i: 2, j: 2, jp: '散歩に', kana: 'さんぽに', fr: 'Aujourd\'hui, je vais me promener.' },
  }

  it('nouvelle phrase : 4 étapes ; récente : Reconstruis ; solide (≥ 7 j) : De mémoire', () => {
    expect(blockMode(undefined)).toBe('learn')
    expect(blockMode(newCard(0))).toBe('learn')
    expect(blockMode({ ...newCard(0), s: 'learning' })).toBe('rebuild')
    expect(blockMode(review(3))).toBe('rebuild')
    expect(blockMode(review(RECALL_FROM_DAYS))).toBe('recall')
    expect(stepsFor('learn', sb)).toEqual(['discover', 'rebuild', 'change', 'recall'])
    expect(stepsFor('learn', { blocks: sb.blocks })).toEqual(['discover', 'rebuild', 'recall'])
    expect(stepsFor('rebuild', sb)).toEqual(['rebuild'])
    expect(stepsFor('recall', sb)).toEqual(['recall'])
    // une phrase d'un seul bloc : rien à reconstruire
    expect(stepsFor('learn', { blocks: [{ jp: 'ただいま。', kana: 'ただいま' }] })).toEqual(['discover', 'recall'])
    expect(stepsFor('rebuild', { blocks: [{ jp: 'ただいま。', kana: 'ただいま' }] })).toEqual(['recall'])
  })

  it('les blocs sont mélangés, et la variante sert d\'intrus seulement en révision', () => {
    const learn = rebuildPieces(sb, false, seq(0.1, 0.9, 0.4, 0.7))
    expect(learn).toHaveLength(4)
    expect(learn.map((p) => p.pos)).not.toEqual([0, 1, 2, 3])
    const rev = rebuildPieces(sb, true, seq(0.3, 0.6))
    expect(rev).toHaveLength(5)
    expect(rev.find((p) => p.pos === -1)!.jp).toBe('散歩に')
    // jamais dans l'ordre, même avec un tirage malchanceux
    expect(shuffled([1, 2], () => 0.99)).toEqual([2, 1])
  })

  it('Change un bloc : le bon bloc, l\'ancien et un intrus', () => {
    const c = changeChoices(sb, ['明日は', '散歩に', '買い物に'], seq(0, 0.5))
    expect(c).toHaveLength(3)
    expect(c.filter((x) => x.ok).map((x) => x.jp)).toEqual(['散歩に'])
    expect(c.map((x) => x.jp)).toContain('買い物に')
    expect(c.map((x) => x.jp)).toContain('明日は')
  })

  it('De mémoire : kanji, kana ou rōmaji, et un mot mal transcrit par le micro est pardonné', () => {
    expect(checkRecall(sb, ['今日は今から買い物に行きます']).ok).toBe(true)
    expect(checkRecall(sb, ['きょうはいまからかいものにいきます']).ok).toBe(true)
    expect(checkRecall(sb, ['kyou wa ima kara kaimono ni ikimasu']).ok).toBe(true)
    expect(checkRecall(sb, ['kyō wa ima kara kaimono ni ikimasu']).ok).toBe(true)
    // le micro écrit 買物 au lieu de 買い物 : 3 blocs sur 4, c'est bon
    const phone = checkRecall(sb, ['今日は今から買物に行きます'])
    expect(phone.hits).toEqual([true, true, false, true])
    expect(phone.ok).toBe(true)
    // la moitié seulement
    const half = checkRecall(sb, ['今日は行きます'])
    expect(half.ok).toBe(false)
    expect(half.partial).toBe(true)
    expect(checkRecall(sb, ['こんにちは']).partial).toBe(false)
    expect(checkRecall(sb, ['']).ok).toBe(false)
    // plusieurs propositions du téléphone : chacune compte
    expect(checkRecall(sb, ['今日は今から', '買い物に行きます']).ok).toBe(true)
    // phrase courte : tous les blocs sont nécessaires
    const short: SentenceBlocks = { blocks: [{ jp: '漢字が', kana: 'かんじが' }, { jp: '読めません。', kana: 'よめません' }] }
    expect(checkRecall(short, ['漢字が']).ok).toBe(false)
    expect(checkRecall(short, ['かんじがよめません']).ok).toBe(true)
  })

  it('note proposée : Bien si c\'est juste, Hésitant avec des erreurs, Oublié si rien', () => {
    const ok = { hits: [true, true], ok: true, partial: true }
    const half = { hits: [true, false], ok: false, partial: true }
    const no = { hits: [false, false], ok: false, partial: false }
    expect(suggestRating({ mode: 'learn', mistakes: 0, recall: ok })).toBe(4)
    expect(suggestRating({ mode: 'learn', mistakes: 2, recall: ok })).toBe(3)
    expect(suggestRating({ mode: 'recall', mistakes: 0, recall: half })).toBe(2)
    expect(suggestRating({ mode: 'recall', mistakes: 0, recall: no })).toBe(1)
    expect(suggestRating({ mode: 'rebuild', mistakes: 0 })).toBe(4)
    expect(suggestRating({ mode: 'rebuild', mistakes: 1 })).toBe(3)
    expect(suggestRating({ mode: 'rebuild', mistakes: 3 })).toBe(2)
    expect(suggestRating({ mode: 'recall', mistakes: 0, selfOk: true })).toBe(4)
    expect(suggestRating({ mode: 'recall', mistakes: 0, gaveUp: true })).toBe(1)
  })
})

describe('v1.17 — compatibilité', () => {
  it('une ancienne sauvegarde s\'ouvre avec les phrases par blocs, sans rien perdre', () => {
    const old = JSON.parse(JSON.stringify({ ...emptyState(), settings: { ...DEFAULT_SETTINGS } }))
    delete old.settings.sentenceBlocks
    old.cards = { 's43:r': { ...newCard(0), s: 'review', i: 12, d: 50, r: 4, t: 10 } }
    const s = sanitize(old)
    expect(s.settings.sentenceBlocks).toBe(true)
    expect(s.cards['s43:r'].i).toBe(12)
    expect(s.v).toBe(1)
  })

  it('même carte de phrase qu\'avant : un ancien appareil peut la réviser, et la synchro garde la plus récente', () => {
    const now = Date.parse('2026-11-23T10:00:00Z')
    const c = { ...newCard(now - 1e6), s: 'review' as const, i: 8, d: 1, r: 4, t: now - 1e6 }
    const mine = { ...emptyState(), cards: { 's43:r': c } }
    // un ancien appareil révise la carte (même format, mêmes champs)
    const theirs = { ...emptyState(), cards: { 's43:r': { ...answer(c, 4, now, 20000).card, t: now } } }
    const m = mergeStates(mine, theirs)
    expect(m.cards['s43:r'].t).toBe(now)
    expect(Object.keys(m.cards['s43:r']).sort()).toEqual(Object.keys(theirs.cards['s43:r']).sort())
  })

  it('le choix « Phrases par blocs » voyage à la synchro, et un ancien appareil ne l\'efface pas', () => {
    const a = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, sentenceBlocks: false, _t: 200 } }
    const oldDevice = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, _t: 100 } }
    delete (oldDevice.settings as Partial<typeof oldDevice.settings>).sentenceBlocks
    expect(mergeStates(oldDevice, a).settings.sentenceBlocks).toBe(false)
  })
})

describe('v1.17 — toucher un mot', () => {
  const sentences = buildCatalog({}).items.filter((it) => it.kind === 'sentence')

  it('chaque phrase se découpe en mots qui recouvrent tout le texte (hors ponctuation)', () => {
    let bad = 0
    for (const it of sentences) {
      const g = glossPieces(it.id, it.jp)
      if (!g) { bad++; continue }
      expect(g.pieces.map((p) => p.text).join('')).toBe(it.jp)
      g.words.forEach((w) => { expect(w.r.length).toBeGreaterThan(0) })
    }
    expect(bad).toBe(0)
  })

  it('撮っても : forme de base 撮る, sens, et la tournure « puis-je… ? »', () => {
    const g = glossPieces('s89', '写真を撮ってもいいですか。')!
    expect(g.words.map((w) => w.s)).toEqual(['写真', 'を', '撮って', 'も', 'いい', 'です', 'か'])
    const totte = g.words[2]
    expect(totte.base).toBe('撮る')
    expect(totte.baseR).toBe('とる')
    expect(totte.fr).toContain('photo')
    expect(totte.g).toContain('puis-je')
    expect(g.words[1].fr).toContain('complément d\'objet')
  })

  it('presque tous les mots ont un sens, et les mots d\'un bloc se retrouvent', () => {
    let n = 0, withFr = 0
    for (const it of sentences) for (const w of glossPieces(it.id, it.jp)?.words ?? []) { n++; if (w.fr) withFr++ }
    expect(withFr / n).toBeGreaterThan(0.97)
    // bloc 行きます de 電車で会社に行きます。
    expect(glossInRange('s45', '電車で会社に行きます。', 6, 11).map((w) => w.s)).toEqual(['行きます'])
    expect(glossInRange('s45', '電車で会社に行きます。', 0, 3).map((w) => w.s)).toEqual(['電車', 'で'])
  })

  it('une phrase perso (sans données) s\'affiche simplement', () => {
    expect(glossPieces('c-123', 'これはペンです。')).toBeNull()
    // texte modifié : on n'invente pas de découpage
    expect(glossPieces('s89', '写真をとってもいいですか。')).toBeNull()
  })
})

describe('v1.17 — phrases du deck retravaillées', () => {
  const deck = buildCatalog({}).items.filter((it) => it.kind === 'sentence' && /^s\d+$/.test(it.id))
  it('japonais naturel : pas de 私は en tête, lecture découpée mot par mot', () => {
    expect(deck).toHaveLength(158)
    expect(deck.filter((it) => it.jp.startsWith('私は'))).toHaveLength(0)
    const s89 = deck.find((it) => it.id === 's89')!
    expect(s89.kana).toBe('しゃしん を とって も いい です か')
    expect(deck.find((it) => it.id === 's79')!.jp).toBe('袋は大丈夫です。')
  })
})
