import { beforeAll, describe, expect, it } from 'vitest'
import blocksJson from '../data/blocks.json'
import { blocksFor, gapPuzzle, gapRating, setBlocksData, type SentenceBlocks } from '../lib/blocks'
import { baseItems } from '../lib/deck'
import { ALL, buildPractice, buildQueue, interleave } from '../lib/queue'
import { dayNumber, newCard, type CardState } from '../lib/scheduler'
import { DEFAULT_SETTINGS, emptyState, sanitize } from '../lib/state'

beforeAll(() => setBlocksData(blocksJson as unknown as Parameters<typeof setBlocksData>[0]))

const NOW = Date.UTC(2026, 10, 24, 12)
const today = dayNumber(NOW)
const rev = (o: Partial<CardState> = {}): CardState => ({ ...newCard(NOW - 9 * 86_400_000), s: 'review', i: 5, d: today - 1, r: 3, ...o })
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length] }
const words = baseItems.filter((it) => it.kind === 'word')
const pool = [{ jp: '明日は', kana: 'あしたは' }, { jp: '会社に', kana: 'かいしゃに' }, { jp: '猫が', kana: 'ねこが' }, { jp: '行きます。', kana: 'いきます' }]

describe('v1.19 — phrase à trous par blocs', () => {
  const four: SentenceBlocks = {
    blocks: [{ jp: '今日は', kana: 'きょうは' }, { jp: '今から', kana: 'いまから' }, { jp: '買い物に', kana: 'かいものに' }, { jp: '行きます。', kana: 'いきます' }],
    variant: { i: 2, j: 2, jp: '散歩に', kana: 'さんぽに', fr: '…' },
  }
  const two: SentenceBlocks = { blocks: [{ jp: '写真を', kana: 'しゃしんを' }, { jp: '撮ってもいいですか。', kana: 'とってもいいですか' }] }

  it('1 trou jusqu\'à 3 blocs, 2 trous à partir de 4', () => {
    expect(gapPuzzle(two, 0, pool, seq(0.3)).gaps).toHaveLength(1)
    expect(gapPuzzle(four, 0, pool, seq(0.3)).gaps).toHaveLength(2)
    expect(gapPuzzle({ blocks: [{ jp: 'ただいま。', kana: 'ただいま' }] }, 5, pool, seq(0.3)).gaps).toEqual([0])
  })

  it('les trous changent d\'une révision à l\'autre', () => {
    const seen = new Set([0, 1, 2, 3].map((s) => gapPuzzle(four, s, pool, seq(0.5)).gaps.join(',')))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('les bons blocs + des intrus qui ne sont pas dans la phrase', () => {
    const pz = gapPuzzle(four, 1, pool, seq(0.1, 0.6, 0.9))
    const right = pz.choices.filter((c) => c.ok).map((c) => c.jp).sort()
    expect(right).toEqual(pz.gaps.map((i) => four.blocks[i].jp).sort())
    const wrong = pz.choices.filter((c) => !c.ok)
    expect(wrong.length).toBeGreaterThanOrEqual(1)
    wrong.forEach((c) => { expect(four.blocks.map((b) => b.jp)).not.toContain(c.jp) })
    // la variante sert d'intrus quand son bloc est caché
    const withVar = [0, 1, 2, 3].map((s) => gapPuzzle(four, s, pool, seq(0.2))).find((p) => p.gaps.includes(2))!
    expect(withVar.choices.some((c) => c.jp === '散歩に' && !c.ok)).toBe(true)
  })

  it('marche sur toutes les phrases du deck', () => {
    for (const it of baseItems.filter((x) => x.deck === 'phrases')) {
      const sb = blocksFor(it.id)
      if (!sb) continue
      const pz = gapPuzzle(sb, 3, pool, seq(0.4, 0.8))
      expect(pz.choices.filter((c) => c.ok)).toHaveLength(pz.gaps.length)
    }
  })

  it('note proposée : sans erreur Bien, 1 erreur Hésitant, plus Difficile, abandon Oublié', () => {
    expect(gapRating(0)).toBe(4)
    expect(gapRating(1)).toBe(3)
    expect(gapRating(3)).toBe(2)
    expect(gapRating(0, true)).toBe(1)
  })
})

describe('v1.19 — séances : seulement les mots (dans les deux sens) et les phrases à trous', () => {
  it('plus de cartes à trous de mots, de cartes de forme ni de phrases de vidéos', () => {
    const st = emptyState()
    words.slice(0, 30).forEach((w) => {
      st.cards[`${w.id}:c`] = rev()
      st.cards[`${w.id}:f`] = rev()
    })
    st.cards['v1-1:r'] = rev()
    st.cards['s89:r'] = rev()
    st.cards[`${words[40].id}:p`] = rev()
    const all = interleave(buildQueue(st, baseItems, ALL, NOW))
    expect(all.some((k) => k.endsWith(':c') || k.endsWith(':f'))).toBe(false)
    expect(all).not.toContain('v1-1:r')
    expect(all).toContain('s89:r')
    expect(all).toContain(`${words[40].id}:p`) // le sens français → japonais reste
    // pas de nouvelle phrase de vidéo non plus
    expect(all.some((k) => /^v\d+-/.test(k))).toBe(false)
  })

  it('le deck d\'une vidéo choisi exprès reste possible', () => {
    const st = emptyState()
    st.cards['v1-1:r'] = rev()
    expect(buildQueue(st, baseItems, { ...ALL, deck: 'vid1' }, NOW).review).toContain('v1-1:r')
  })

  it('l\'entraînement libre ne propose que mots et phrases', () => {
    const st = emptyState()
    st.cards[`${words[0].id}:r`] = rev()
    st.cards[`${words[0].id}:c`] = rev()
    st.cards[`${words[0].id}:f`] = rev()
    expect(buildPractice(st, baseItems, ALL)).toEqual(expect.arrayContaining([`${words[0].id}:r`]))
    expect(buildPractice(st, baseItems, ALL).some((k) => k.endsWith(':c') || k.endsWith(':f'))).toBe(false)
  })

  it('les nouvelles phrases commencent par les plus courtes de la vie quotidienne', () => {
    const q = buildQueue({ ...emptyState(), settings: { ...DEFAULT_SETTINGS, newPerDay: 8 } }, baseItems, ALL, NOW)
    const s = q.fresh.map((k) => baseItems.find((it) => `${it.id}:r` === k)!).filter((it) => it.kind === 'sentence')
    expect(s[0].jp).toBe('二人です。')
    s.forEach((it) => { expect(it.jp.length).toBeLessThanOrEqual(10) })
  })

  it('compatibilité : les anciennes cartes (trous, forme, vidéos) restent dans la sauvegarde', () => {
    const old = { ...emptyState(), cards: { 'w1:c': rev({ i: 12 }), 'w1:f': rev({ i: 7 }), 'v2-5:r': rev({ i: 20 }) } }
    const s = sanitize(JSON.parse(JSON.stringify(old)))
    expect(s.cards['w1:c'].i).toBe(12)
    expect(s.cards['w1:f'].i).toBe(7)
    expect(s.cards['v2-5:r'].i).toBe(20)
    expect(s.v).toBe(1)
  })
})
