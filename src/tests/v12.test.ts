import { describe, it, expect, beforeEach } from 'vitest'
import { answer, newCard, dayNumber, type CardState } from '../lib/scheduler'
import { emptyState, mergeStates, sanitize, totalXp, type AppState } from '../lib/state'
import { baseItems, DECKS, isOptIn } from '../lib/deck'
import { ALL, buildQueue, pickWarmup } from '../lib/queue'
import { checkTranslation } from '../lib/typing'
import { toRomaji } from '../lib/romaji'
import {
  EXAM_LEVELS,
  PASS,
  bankQuestions,
  bankSize,
  bestByLevel,
  buildExam,
  checkExamTyped,
  correctText,
  examHistory,
  examKey,
  examStats,
  gradeExam,
  gradeQuestion,
  mulberry32,
  readingDistractors,
  readingVariants,
  recommendedLevel,
  retryExam,
  romajiOf,
  splitMark,
  type Answer,
  type Exam,
  type ExamLevel,
  type Question
} from '../lib/exam'
import { useStore } from '../lib/store'
import { ACHIEVEMENTS } from '../lib/achievements'

const NOW = Date.UTC(2026, 9, 1, 12)
const byJp = (jp: string) => baseItems.find((i) => i.jp === jp)!

/** Réponses 100 % justes pour un examen. */
function perfect(exam: Exam): Record<string, Answer> {
  const out: Record<string, Answer> = {}
  for (const p of exam.pages)
    for (const q of p.qs) {
      if (q.t === 'mcq') out[q.id] = q.a
      else if (q.t === 'type') out[q.id] = q.ans[q.ans.length > 1 ? 1 : 0]
      else out[q.id] = q.parts.map((_, i) => i)
    }
  return out
}

describe('décks vidéo (phrases à réviser librement)', () => {
  it('les phrases des deux vidéos sont dans le catalogue, avec lecture et rōmaji', () => {
    const v1 = baseItems.filter((i) => i.deck === 'vid1')
    const v2 = baseItems.filter((i) => i.deck === 'vid2')
    expect(v1.length).toBeGreaterThan(100)
    expect(v2.length).toBeGreaterThan(80)
    for (const it of [...v1, ...v2]) {
      expect(it.kind).toBe('sentence')
      expect(it.jp.length).toBeGreaterThan(0)
      expect(it.kana.length).toBeGreaterThan(0)
      expect(it.fr.length).toBeGreaterThan(0)
      expect(it.romaji.length).toBeGreaterThan(0)
    }
    expect(DECKS.filter((d) => d.optIn).map((d) => d.id)).toEqual(['vid1', 'vid2', 'vid3'])
    expect(isOptIn('vid1')).toBe(true)
    expect(isOptIn('N5')).toBe(false)
  })
  it('elles ne changent ni les nouvelles cartes du jour ni les phrases d\'échauffement', () => {
    const st = emptyState()
    const q = buildQueue(st, baseItems, ALL, NOW)
    expect([...q.fresh, ...q.freshProd].some((k) => /^v[123]-/.test(k))).toBe(false)
    expect(pickWarmup(st, baseItems, 2, NOW).some((k) => /^v[123]-/.test(k))).toBe(false)
  })
  it('on peut les réviser librement quand on choisit le deck', () => {
    const st = emptyState()
    const q = buildQueue(st, baseItems, { deck: 'vid1', pos: 'all', free: true, limit: 20 }, NOW)
    expect(q.fresh.length).toBeGreaterThan(10)
    expect(q.fresh.every((k) => k.startsWith('v1-'))).toBe(true)
  })
})

describe('traduction écrite', () => {
  it('accepte n\'importe quel sens listé pour un mot', () => {
    const w = baseItems.find((i) => i.kind === 'word' && i.fr.includes(';'))!
    const first = w.fr.split(/\s*;\s*/)[0]
    expect(checkTranslation(w, first).verdict).toBe('ok')
    expect(checkTranslation(w, '').verdict).toBe('vide')
    expect(checkTranslation(w, 'zzzz qqqq').verdict).toBe('no')
  })
  it('compare les mots importants d\'une phrase', () => {
    const s = baseItems.find((i) => i.deck === 'vid1')!
    expect(checkTranslation(s, s.fr).verdict).toBe('ok')
    expect(checkTranslation(s, 'banane').verdict).toBe('no')
  })
})

describe('exam : lecture et saisie', () => {
  it('romajiOf garde les trous et les retours à la ligne', () => {
    expect(romajiOf('（１） に はいる ことば')).toBe('(1) ni hairu kotoba')
    expect(romajiOf('それ （　） です')).toBe('sore (____) desu')
    expect(romajiOf('ひ\nふ').split('\n').length).toBe(2)
    expect(splitMark('これは[[豊富]]だ')).toEqual([{ t: 'これは', mark: false }, { t: '豊富', mark: true }, { t: 'だ', mark: false }])
  })
  it('toute la banque : la bonne réponse est acceptée en kana, en katakana et en rōmaji', () => {
    let n = 0
    for (const lvl of EXAM_LEVELS) {
      for (const q of bankQuestions(lvl, mulberry32(1))) {
        if (q.t !== 'type') continue
        n++
        for (const a of q.ans) {
          expect(checkExamTyped(q, a)).toBe(true)
          expect(checkExamTyped(q, a.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)))).toBe(true)
          expect(checkExamTyped(q, toRomaji(a).replace(/[^a-zA-Z']/g, ''))).toBe(true)
        }
        expect(checkExamTyped(q, 'zzzz')).toBe(false)
        expect(checkExamTyped(q, '')).toBe(false)
      }
    }
    expect(n).toBeGreaterThan(40)
  })
  it('rōmaji tolérant : macrons, ou/oo, shi/si, pleine largeur', () => {
    const q = bankQuestions('N2', mulberry32(1)).find((x) => x.t === 'type' && x.ans[0] === 'どうにゅう')!
    if (q.t !== 'type') throw new Error('absent')
    for (const r of ['dounyuu', 'dōnyū', 'doonyuu', 'DOUNYUU', 'ｄｏｕｎｙｕｕ', 'dou nyuu']) expect(checkExamTyped(q, r)).toBe(true)
    expect(checkExamTyped(q, 'donyu')).toBe(false)
  })
  it('les particules は を へ acceptent leurs deux écritures en rōmaji', () => {
    const parts: Record<string, string[]> = { は: ['wa', 'ha'], を: ['o', 'wo'], へ: ['e', 'he'] }
    let seen = 0
    for (const lvl of EXAM_LEVELS)
      for (const q of bankQuestions(lvl, mulberry32(1)))
        if (q.t === 'type' && parts[q.ans[0]]) {
          seen++
          for (const r of parts[q.ans[0]]) expect(checkExamTyped(q, r)).toBe(true)
        }
    expect(seen).toBeGreaterThan(0)
  })
  it('un mot vide ou faux est refusé', () => {
    expect(checkExamTyped({ ans: ['の'], rom: ['no'] }, '')).toBe(false)
    expect(checkExamTyped({ ans: ['の'], rom: ['no'] }, 'を')).toBe(false)
    expect(checkExamTyped({ ans: ['の'], rom: ['no'] }, 'no')).toBe(true)
    expect(checkExamTyped({ ans: ['の'], rom: ['no'] }, ' の ')).toBe(true)
  })
})

describe('exam : mauvaises lectures plausibles', () => {
  it('3 variantes distinctes, différentes de la bonne lecture', () => {
    for (const k of ['ほうふ', 'せんせい', 'がっこう', 'おとうさん', 'しごと', 'ようじ', 'べんきょう']) {
      const bad = readingDistractors(k, mulberry32(7))
      expect(bad).not.toBeNull()
      expect(new Set(bad).size).toBe(3)
      expect(bad!.includes(k)).toBe(false)
      for (const b of bad!) expect(b).toMatch(/^[ぁ-ゟー]+$/)
    }
  })
  it('un mot trop court n\'a pas de distracteurs', () => {
    expect(readingDistractors('ひ', mulberry32(1))).toBeNull()
    expect(Object.values(readingVariants('ひ')).flat().length).toBeGreaterThanOrEqual(0)
  })
})

describe('exam : banque de questions', () => {
  it('chaque question est bien formée', () => {
    for (const lvl of EXAM_LEVELS) {
      expect(bankSize(lvl)).toBeGreaterThan(30)
      const exam = buildExam(lvl, 'full', baseItems, mulberry32(11))
      expect(exam.total).toBeGreaterThanOrEqual(25)
      for (const p of exam.pages)
        for (const q of p.qs) {
          expect(q.x.length).toBeGreaterThan(3)
          if (q.t === 'mcq') {
            expect(q.opts.length).toBe(4)
            expect(q.a).toBeGreaterThanOrEqual(0)
            expect(q.a).toBeLessThan(4)
            expect(new Set(q.opts.map((o) => o.t)).size).toBe(4)
          } else if (q.t === 'type') {
            expect(q.ans.length).toBeGreaterThan(0)
            expect(q.rom.length).toBeGreaterThan(0)
          } else {
            expect(q.parts.length).toBe(4)
            expect(q.star).toBeGreaterThanOrEqual(0)
            expect(q.star).toBeLessThan(4)
            expect(q.tiles.slice().sort()).toEqual([0, 1, 2, 3])
            expect(q.tiles.every((t, i) => t === i)).toBe(false)
          }
        }
    }
  })
  it('les bonnes réponses ne sont pas toujours en première position', () => {
    const idx = new Set<number>()
    for (let s = 1; s <= 6; s++) {
      const exam = buildExam('N4', 'full', baseItems, mulberry32(s))
      for (const q of exam.pages.flatMap((p) => p.qs)) if (q.t === 'mcq') idx.add(q.a)
    }
    expect(idx.size).toBe(4)
  })
  it('les questions de texte à trous restent groupées avec leur texte', () => {
    const exam = buildExam('N3', 'full', baseItems, mulberry32(5))
    const sets = exam.pages.filter((p) => p.ctx)
    expect(sets.length).toBeGreaterThanOrEqual(3)
    for (const p of sets) {
      expect(p.qs.length).toBeGreaterThanOrEqual(2)
      expect(new Set(p.qs.map((q) => q.kind)).size).toBe(1)
    }
  })
  it('N5–N3 : le vocabulaire vient de TES decks (lecture, sens, mots à écrire)', () => {
    for (const lvl of ['N5', 'N4', 'N3'] as ExamLevel[]) {
      const exam = buildExam(lvl, 'full', baseItems, mulberry32(3))
      const kinds = exam.pages.flatMap((p) => p.qs.map((q) => q.kind))
      for (const k of ['kread', 'kmean', 'write']) expect(kinds).toContain(k)
      for (const q of exam.pages.flatMap((p) => p.qs)) {
        if (q.id.startsWith('g:')) {
          const itemId = q.id.split(':')[3]
          expect(baseItems.find((i) => i.id === itemId)?.deck).toBe(lvl)
        }
      }
    }
  })
  it('N2 / N1 : lecture et écriture de kanji de la banque', () => {
    for (const lvl of ['N2', 'N1'] as ExamLevel[]) {
      const kinds = buildExam(lvl, 'full', baseItems, mulberry32(2)).pages.flatMap((p) => p.qs.map((q) => q.kind))
      expect(kinds).toContain('kread')
      expect(kinds).toContain('kwrite')
    }
  })
  it('le test rapide est plus court que l\'examen complet', () => {
    for (const lvl of EXAM_LEVELS) {
      const mini = buildExam(lvl, 'mini', baseItems, mulberry32(4))
      const full = buildExam(lvl, 'full', baseItems, mulberry32(4))
      expect(mini.total).toBeGreaterThanOrEqual(8)
      expect(mini.total).toBeLessThanOrEqual(15)
      expect(full.total).toBeGreaterThan(mini.total * 1.7)
    }
  })
  it('deux examens successifs ne sont pas identiques', () => {
    const a = buildExam('N5', 'full', baseItems, mulberry32(100)).pages.map((p) => p.id).join()
    const b = buildExam('N5', 'full', baseItems, mulberry32(101)).pages.map((p) => p.id).join()
    expect(a).not.toBe(b)
  })
})

describe('exam : correction', () => {
  it('toutes les bonnes réponses = 100 %', () => {
    for (const lvl of EXAM_LEVELS) {
      const exam = buildExam(lvl, 'full', baseItems, mulberry32(21))
      const r = gradeExam(exam, perfect(exam))
      expect(r.ok).toBe(r.total)
      expect(r.pct).toBe(1)
      expect(r.passed).toBe(true)
      expect(r.sections.voc.total + r.sections.gram.total + r.sections.read.total).toBe(r.total)
    }
  })
  it('aucune réponse = 0 %, rien ne plante', () => {
    const exam = buildExam('N4', 'full', baseItems, mulberry32(22))
    const r = gradeExam(exam, {})
    expect(r.ok).toBe(0)
    expect(r.passed).toBe(false)
    expect(retryExam(exam, r).total).toBe(exam.total)
    expect(retryExam(exam, r).practice).toBe(true)
  })
  it('seuil de réussite : 70 %', () => {
    const exam = buildExam('N5', 'full', baseItems, mulberry32(23))
    const good = perfect(exam)
    const ids = Object.keys(good)
    const wrongN = Math.floor(ids.length * 0.3) + 1
    const answers = { ...good }
    for (const id of ids.slice(0, wrongN)) answers[id] = undefined
    expect(gradeExam(exam, answers).passed).toBe(false)
    expect(PASS).toBe(0.7)
  })
  it('ordre des mots : seule la case ★ compte, et il faut les 4 morceaux', () => {
    const exam = buildExam('N5', 'full', baseItems, mulberry32(24))
    const q = exam.pages.flatMap((p) => p.qs).find((x) => x.t === 'order')!
    if (q.t !== 'order') throw new Error('x')
    const ok = [0, 1, 2, 3]
    expect(gradeQuestion(q, ok)).toBe(true)
    expect(gradeQuestion(q, [0, 1, 2])).toBe(false)
    const bad = [...ok]
    ;[bad[q.star], bad[(q.star + 1) % 4]] = [bad[(q.star + 1) % 4], bad[q.star]]
    expect(gradeQuestion(q, bad)).toBe(false)
    expect(correctText(q)).toContain(q.parts[q.star].t)
  })
  it('mots à écrire : kanji, kana ou rōmaji', () => {
    const exam = buildExam('N5', 'full', baseItems, mulberry32(25))
    const q = exam.pages.flatMap((p) => p.qs).find((x) => x.kind === 'write')!
    if (q.t !== 'type') throw new Error('x')
    const w = baseItems.find((i) => i.id === q.id.split(':')[3])!
    expect(gradeQuestion(q, w.jp)).toBe(true)
    expect(gradeQuestion(q, w.kana)).toBe(true)
    expect(gradeQuestion(q, w.romaji)).toBe(true)
    expect(gradeQuestion(q, 'xyz')).toBe(false)
  })
})

describe('exam : historique et trophées (stockés dans `ach`, compatibles avec l\'ancienne version)', () => {
  const rec = (lvl: ExamLevel, mode: 'mini' | 'full', ok: number, total: number, t: number) => ({ lvl, mode, ok, total, t })
  it('clé → historique → meilleur score', () => {
    const ach: Record<string, number> = {}
    for (const r of [rec('N5', 'full', 20, 30, 1000), rec('N5', 'full', 25, 30, 2000), rec('N5', 'mini', 12, 12, 3000), rec('N4', 'full', 10, 30, 4000)]) ach[examKey(r)] = r.t
    ach.first = 5 // trophée normal
    ach['g:2026-10-01'] = 6 // marqueur d'objectif
    const h = examHistory(ach)
    expect(h.length).toBe(4)
    expect(h[0].t).toBe(4000)
    const best = bestByLevel(h)
    expect(best.N5.passed).toBe(true)
    expect(best.N5.full).toBeCloseTo(25 / 30)
    expect(best.N5.mini).toBe(1)
    expect(best.N4.passed).toBe(false)
    expect(best.N3.tries).toBe(0)
    const st = examStats(ach)
    expect(st.exams).toBe(4)
    expect(st.examsPassed).toEqual(['N5'])
    expect(st.examPerfect).toBe(true)
  })
  it('un test rapide ne valide pas un niveau', () => {
    const ach = { [examKey(rec('N5', 'mini', 12, 12, 1))]: 1 }
    expect(bestByLevel(examHistory(ach)).N5.passed).toBe(false)
  })
  it('des clés abîmées sont ignorées', () => {
    expect(examHistory({ 'x:N9:f:1:2:3': 1, 'x:N5:f:a:b:c': 1, 'x:N5:f:1:0:3': 1, 'x:': 1 })).toEqual([])
  })
  it('niveau conseillé : suit l\'estimation, saute les niveaux déjà validés', () => {
    const none = bestByLevel([])
    expect(recommendedLevel('start', none)).toBe('N5')
    expect(recommendedLevel('n5ok', none)).toBe('N4')
    expect(recommendedLevel('n3ok', none)).toBe('N3')
    const passedN5 = bestByLevel([rec('N5', 'full', 28, 30, 1)])
    expect(recommendedLevel('start', passedN5)).toBe('N4')
  })
  it('la sauvegarde avec des examens survit à une fusion et à une ancienne version', () => {
    const a = emptyState()
    a.ach[examKey(rec('N5', 'full', 25, 30, 111))] = 111
    const b = emptyState()
    b.ach[examKey(rec('N4', 'mini', 9, 12, 222))] = 222
    const merged = mergeStates(a, b)
    expect(examHistory(merged.ach).length).toBe(2)
    // ancienne version : sanitize + merge ne connaissent que `ach`, qui est conservé tel quel
    const viaOld = mergeStates(sanitize(JSON.parse(JSON.stringify(a))), sanitize(JSON.parse(JSON.stringify({ ...b, exams: 'inconnu' }))))
    expect(examHistory(viaOld.ach).length).toBe(2)
  })
  it('7 nouveaux trophées d\'examen', () => {
    expect(ACHIEVEMENTS.length).toBe(34)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(34)
  })
})

describe('exam : enregistrement dans l\'app', () => {
  beforeEach(() => {
    useStore.getState().init()
    const today = dayNumber(NOW, 0)
    const cards: Record<string, CardState> = {}
    baseItems
      .filter((i) => i.kind === 'word')
      .slice(0, 40)
      .forEach((w) => {
        let c = newCard(NOW)
        c = answer(c, 4, NOW - 5 * 86400000, today - 5).card
        cards[`${w.id}:r`] = { ...c, t: NOW }
      })
    useStore.setState({ state: { ...emptyState(), cards } })
  })
  it('recordExam ajoute l\'examen, de l\'XP et le trophée « Premier examen » sans toucher aux cartes', () => {
    const before = useStore.getState().state
    const xp0 = totalXp(before)
    const gain = useStore.getState().recordExam({ lvl: 'N5', mode: 'full', ok: 27, total: 30 })
    const after = useStore.getState().state
    expect(gain).toBe(Math.round(15 + 35 * 0.9))
    expect(totalXp(after)).toBeGreaterThanOrEqual(xp0 + gain)
    expect(after.cards).toEqual(before.cards)
    expect(examHistory(after.ach).length).toBe(1)
    expect(after.ach.ex1).toBeTruthy()
    expect(after.ach.exN5).toBeTruthy()
    expect(after.ach.exPerfect).toBeUndefined()
  })
  it('100 % → « Copie parfaite »', () => {
    useStore.getState().recordExam({ lvl: 'N4', mode: 'full', ok: 28, total: 28 })
    expect(useStore.getState().state.ach.exPerfect).toBeTruthy()
    expect(useStore.getState().state.ach.exN4).toBeTruthy()
  })
  it('un test raté ne donne pas de trophée de niveau', () => {
    useStore.getState().recordExam({ lvl: 'N3', mode: 'full', ok: 12, total: 30 })
    expect(useStore.getState().state.ach.exN3).toBeUndefined()
    expect(useStore.getState().state.ach.ex1).toBeTruthy()
  })
})
