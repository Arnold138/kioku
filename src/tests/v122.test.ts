import { describe, expect, it } from 'vitest'
import { BLOCKS, LOOP_FORMATS, buildLoop } from '../lib/loop'
import { frKey } from '../lib/tts'
import { baseItems } from '../lib/deck'
import { dayNumber } from '../lib/scheduler'
import words from '../data/words.json'
import sentences from '../data/sentences.json'

const today = dayNumber(Date.UTC(2026, 10, 26, 12))
// noms des fichiers son présents dans public/fr (sans les charger)
const FR_FILES = new Set(Object.keys(import.meta.glob('../../public/fr/*.m4a')).map((p) => p.split('/').pop()!))

describe('v1.22 — blocs de phrases', () => {
  it('chaque bloc a son japonais, sa lecture, sa traduction et son explication', () => {
    expect(BLOCKS.length).toBeGreaterThanOrEqual(140)
    expect(new Set(BLOCKS.map((b) => b.id)).size).toBe(BLOCKS.length)
    for (const b of BLOCKS) {
      expect(b.jp && b.kana && b.fr && b.note, b.id).toBeTruthy()
      expect(b.jp, b.id).not.toMatch(/[〜a-zA-Z(]/) // un vrai morceau de phrase, pas un schéma
      expect(b.kana, b.id).toMatch(/^[぀-ヿ\s]+$/)
    }
  })
  it('les expressions des vidéos et les nuances demandées sont là', () => {
    const jp = BLOCKS.map((b) => b.jp)
    for (const x of ['やっぱりそうか', 'そうかもしれない', '寝てるから大丈夫です', 'ちょっと聞きたいんですけど', '用事があるので', '雨だから', 'まだ食べていない'])
      expect(jp).toContain(x)
  })
})

describe('v1.22 — format d\'écoute', () => {
  it('Tout / Mots / Phrases / Blocs', () => {
    expect(LOOP_FORMATS.map((f) => f.id)).toEqual(['mix', 'words', 'phrases', 'blocks'])
    const tags = (fmt: 'mix' | 'words' | 'phrases' | 'blocks') => new Set(buildLoop({}, baseItems, today, 60, fmt).map((e) => e.tag))
    expect([...tags('mix')].sort()).toEqual(['block', 'new', 'phrase'])
    expect([...tags('words')]).toEqual(['new'])
    expect([...tags('phrases')]).toEqual(['phrase'])
    expect([...tags('blocks')]).toEqual(['block'])
  })
  it('un bloc garde son explication', () => {
    const b = buildLoop({}, baseItems, today, 10, 'blocks')[0]
    expect(b.label).toBe('bloc')
    expect(b.it.note).toBeTruthy()
  })
})

describe('v1.22 — voix française enregistrée', () => {
  it('même clé que le script d\'enregistrement', () => {
    expect(frKey('On est deux.')).toBe('e54482b80c')
    expect(frKey('  On est deux.  ')).toBe('e54482b80c')
  })
  it('chaque traduction (mots, phrases, blocs) a son fichier son', () => {
    const files = FR_FILES
    const texts = [...(words as Array<{ fr: string }>), ...(sentences as Array<{ fr: string }>), ...BLOCKS].map((x) => x.fr)
    const missing = texts.filter((t) => !files.has(`${frKey(t)}.m4a`))
    expect(missing).toEqual([])
    expect(files.has(`${frKey('On est deux.')}.m4a`)).toBe(true)
  })
})
