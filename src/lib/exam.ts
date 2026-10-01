import bankJson from '../data/exam-bank.json'
import { POS_LABEL, type Item } from './deck'
import { posGroup } from './queue'
import { hasKanji, katakanaToHiragana, toRomaji } from './romaji'
import { canon } from './typing'

// ─────────────────────────────────────────────────────────────────────────────
// Examens « façon JLPT » : questions à choix, à trous, mots à écrire, phrases à remettre dans l'ordre (★), lecture.
// Les questions sont originales (inspirées du format officiel, pas copiées). Le résultat est stocké dans `ach`
// (clé « x:… ») : ainsi une ancienne version de l'app ne le supprime jamais lors de la synchro.
// ─────────────────────────────────────────────────────────────────────────────

export type ExamLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export const EXAM_LEVELS: ExamLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
export type ExamMode = 'mini' | 'full'
export type Section = 'voc' | 'gram' | 'read'
export type Help = 'all' | 'kana' | 'off'

export const SECTIONS: Record<Section, { jp: string; fr: string }> = {
  voc: { jp: '文字・語彙', fr: 'Vocabulaire' },
  gram: { jp: '文法', fr: 'Grammaire' },
  read: { jp: '読解', fr: 'Lecture' }
}

export const LEVEL_INFO: Record<ExamLevel, { title: string; sub: string }> = {
  N5: { title: 'Débutant', sub: 'Phrases simples · ≈ 800 mots' },
  N4: { title: 'Élémentaire', sub: 'Vie quotidienne · ≈ 1 500 mots' },
  N3: { title: 'Intermédiaire', sub: 'Textes simples · ≈ 3 700 mots' },
  N2: { title: 'Avancé', sub: 'Presse, travail · ≈ 6 000 mots' },
  N1: { title: 'Expert', sub: 'Textes denses · ≈ 10 000 mots' }
}

/** Seuil de réussite propre à l'app (le vrai JLPT note par section, avec l'écoute). */
export const PASS = 0.7

// ───────── Types des questions (après tirage) ─────────
export interface Opt {
  t: string
  /** lecture en kana (avec espaces) — vide si le texte est déjà en kana */
  k?: string
}
interface Base {
  id: string
  sec: Section
  kind: string
  q: string
  qk?: string
  /** explication en français, montrée dans la correction */
  x: string
}
export interface McqQ extends Base {
  t: 'mcq'
  opts: Opt[]
  a: number
  /** les choix sont en français (pas de lecture à afficher) */
  fr?: boolean
}
export interface TypeQ extends Base {
  t: 'type'
  /** réponses acceptées (kana / kanji) */
  ans: string[]
  /** réponses acceptées en rōmaji (déjà normalisées par `canon`) */
  rom: string[]
  /** la bonne réponse, telle qu'on l'affiche dans la correction */
  good: string
  hint?: string
  label?: string
  /** l'énoncé est en français */
  fr?: boolean
}
export interface OrderQ extends Base {
  t: 'order'
  pre: string
  prek?: string
  post: string
  postk?: string
  /** les morceaux dans le BON ordre */
  parts: Opt[]
  /** position (0-3) de la case ★ */
  star: number
  /** ordre d'affichage (mélangé) des morceaux : indices dans `parts` */
  tiles: number[]
}
export type Question = McqQ | TypeQ | OrderQ
export type Answer = number | string | number[] | undefined

export interface Page {
  id: string
  sec: Section
  ctx?: string
  ctxk?: string
  qs: Question[]
}
export interface Exam {
  lvl: ExamLevel
  mode: ExamMode
  pages: Page[]
  total: number
  /** refaire ses erreurs : rien n'est enregistré */
  practice?: boolean
}

// ───────── Aléa ─────────
export type Rng = () => number
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: readonly T[], n: number, rng: Rng): T[] => shuffle(arr, rng).slice(0, n)

// ───────── Banque écrite à la main ─────────
interface RawQ {
  t: 'mcq' | 'type' | 'order'
  k: string
  s: Section
  q?: string
  qk?: string
  o?: string[]
  ok?: string[]
  a?: number
  ans?: string[]
  hint?: string
  x: string
  ctx?: string
  ctxk?: string
  set?: string
  pre?: string
  prek?: string
  parts?: string[]
  partsk?: string[]
  star?: number
  post?: string
  postk?: string
}
const BANK = bankJson as unknown as Record<ExamLevel, RawQ[]>

export const bankSize = (lvl: ExamLevel) => BANK[lvl].length
/** Toute la banque d'un niveau, prête à l'emploi (utile pour les tests). */
export const bankQuestions = (lvl: ExamLevel, rng: Rng = Math.random): Question[] => BANK[lvl].map((q, i) => fromRaw(lvl, q, i, rng))

// ───────── Lecture / saisie ─────────
const PARTICLE_ROM: Record<string, string[]> = { は: ['ha'], を: ['wo'], へ: ['he'] }

/** toutes les écritures en rōmaji acceptées pour une réponse en kana */
function romForms(kana: string): string[] {
  const out = new Set<string>()
  const plain = kana.replace(/\s/g, '')
  out.add(canon(toRomaji(plain)))
  for (const r of PARTICLE_ROM[plain] ?? []) out.add(canon(r))
  return [...out].filter(Boolean)
}

const strip = (s: string) => s.replace(/[\s。、．，！？!?…「」『』（）()・]/g, '')
const normJp = (s: string) => katakanaToHiragana(strip(s.normalize('NFKC')))

/** Vérifie une réponse écrite : kana, kanji ou rōmaji (la graphie du rōmaji est tolérante). */
export function checkExamTyped(q: Pick<TypeQ, 'ans' | 'rom'>, raw: string): boolean {
  const input = raw.normalize('NFKC').trim()
  if (!input) return false
  if (/[^\x00-\x7F]/.test(input)) {
    if (/^[A-Za-zāīūēōâîûêô\s'’-]+$/.test(input)) return q.rom.includes(canon(input))
    const typed = normJp(input)
    return q.ans.some((a) => normJp(a) === typed)
  }
  return q.rom.includes(canon(input))
}

/** Bonne réponse d'un ordre : le morceau placé sur la case ★ doit être le bon (comme au JLPT). */
export function checkOrder(q: OrderQ, seq: number[] | undefined): boolean {
  return !!seq && seq.length === q.parts.length && seq[q.star] === q.star
}

export function gradeQuestion(q: Question, a: Answer): boolean {
  if (q.t === 'mcq') return typeof a === 'number' && a === q.a
  if (q.t === 'type') return typeof a === 'string' && checkExamTyped(q, a)
  return Array.isArray(a) && checkOrder(q, a)
}

// ───────── Distracteurs de lecture (kana plausibles) ─────────
const VOICED: Record<string, string> = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'じ', つ: 'ず', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' }
const UNVOICED: Record<string, string> = { が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ', ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ', だ: 'た', で: 'て', ど: 'と', ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ', ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ' }
const LOOK: Array<[string, string]> = [['し', 'つ'], ['ぬ', 'め'], ['わ', 'れ'], ['ね', 'れ'], ['あ', 'お'], ['さ', 'ち'], ['る', 'ろ'], ['は', 'ほ'], ['ま', 'む'], ['き', 'さ']]
const SMALL = 'ゃゅょぁぃぅぇぉっー'
const O_ROW = 'おこごそぞとどのほぼぽもよろ'
const E_ROW = 'えけげせぜてでねへべめれ'
const U_ROW = 'うくぐすずつぬふぶむゆる'
const KAKI = 'かきくけこさしすせそたちつてとぱぴぷぺぽ'

/** Variantes « presque justes » d'une lecture : voisement, voyelle longue, っ, ordre, kana qui se ressemblent. */
export function readingVariants(kana: string): { voice: string[]; vowel: string[]; tsu: string[]; swap: string[]; look: string[] } {
  const c = [...kana]
  const out = { voice: [] as string[], vowel: [] as string[], tsu: [] as string[], swap: [] as string[], look: [] as string[] }
  const put = (k: keyof typeof out, arr: string[]) => {
    const s = arr.join('')
    if (s !== kana && !out[k].includes(s)) out[k].push(s)
  }
  c.forEach((ch, i) => {
    const flip = VOICED[ch] ?? UNVOICED[ch]
    if (flip) put('voice', [...c.slice(0, i), flip, ...c.slice(i + 1)])
    if (ch === 'は' || ch === 'ひ' || ch === 'ふ' || ch === 'へ' || ch === 'ほ') {
      const semi = ({ は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' } as Record<string, string>)[ch]
      put('voice', [...c.slice(0, i), semi, ...c.slice(i + 1)])
    }
    // voyelle longue : on retire un う/お/い de trop, ou on en ajoute un
    const next = c[i + 1]
    if (next === 'う' && (O_ROW.includes(ch) || U_ROW.includes(ch))) put('vowel', [...c.slice(0, i + 1), ...c.slice(i + 2)])
    else if (next === 'い' && E_ROW.includes(ch)) put('vowel', [...c.slice(0, i + 1), ...c.slice(i + 2)])
    else if (!SMALL.includes(ch) && ch !== 'ん') {
      if (O_ROW.includes(ch) && next !== 'う') put('vowel', [...c.slice(0, i + 1), 'う', ...c.slice(i + 1)])
      if (E_ROW.includes(ch) && next !== 'い') put('vowel', [...c.slice(0, i + 1), 'い', ...c.slice(i + 1)])
      if (U_ROW.includes(ch) && next !== 'う') put('vowel', [...c.slice(0, i + 1), 'う', ...c.slice(i + 1)])
    }
    // petit っ
    if (ch === 'っ') put('tsu', [...c.slice(0, i), ...c.slice(i + 1)])
    else if (i >= 1 && next && KAKI.includes(next) && c[i - 1] !== 'ん' && ch !== 'っ' && !SMALL.includes(ch)) put('tsu', [...c.slice(0, i + 1), 'っ', ...c.slice(i + 1)])
    // deux kana qui échangent leur place
    if (next && !SMALL.includes(ch) && !SMALL.includes(next) && ch !== next && !(c[i + 2] && SMALL.includes(c[i + 2]))) {
      put('swap', [...c.slice(0, i), next, ch, ...c.slice(i + 2)])
    }
    for (const [x, y] of LOOK) {
      if (ch === x) put('look', [...c.slice(0, i), y, ...c.slice(i + 1)])
      else if (ch === y) put('look', [...c.slice(0, i), x, ...c.slice(i + 1)])
    }
  })
  return out
}

/** 3 mauvaises lectures, variées ; null si le mot est trop court. */
export function readingDistractors(kana: string, rng: Rng): string[] | null {
  const v = readingVariants(kana)
  const cats = shuffle([v.voice, v.vowel, v.tsu, v.swap, v.look], rng).map((l) => shuffle(l, rng))
  const out: string[] = []
  for (let round = 0; out.length < 3 && round < 3; round++) {
    for (const list of cats) {
      const cand = list[round]
      if (cand && !out.includes(cand) && out.length < 3) out.push(cand)
    }
  }
  return out.length === 3 ? out : null
}

// ───────── Questions générées à partir de TES decks (N5 / N4 / N3) ─────────
const firstSense = (fr: string) => fr.split(/\s*[;,/]\s*/)[0].replace(/\s*\([^)]*\)\s*/g, ' ').trim()
const isHira = (s: string) => /^[ぁ-ゟー]+$/.test(s)

function toMcq(base: Omit<McqQ, 't' | 'opts' | 'a'>, correct: Opt, wrong: Opt[], rng: Rng, fr?: boolean): McqQ {
  const all = shuffle([correct, ...wrong], rng)
  return { ...base, t: 'mcq', opts: all, a: all.indexOf(correct), fr }
}

function genKread(words: Item[], n: number, rng: Rng, lvl: ExamLevel): McqQ[] {
  const pool = shuffle(words.filter((w) => hasKanji(w.jp) && isHira(w.kana) && w.kana.length >= 3 && w.kana.length <= 8 && !/[A-Za-z0-9\s]/.test(w.jp)), rng)
  const out: McqQ[] = []
  for (const w of pool) {
    if (out.length >= n) break
    const bad = readingDistractors(w.kana, rng)
    if (!bad) continue
    out.push(
      toMcq(
        { id: `g:${lvl}:kread:${w.id}`, sec: 'voc', kind: 'kread', q: `[[${w.jp}]] の 読み方は どれですか。`, x: `${w.jp} se lit ${w.kana} (${w.romaji}) : ${w.fr}.` },
        { t: w.kana },
        bad.map((t) => ({ t })),
        rng
      )
    )
  }
  return out
}

function genKmean(words: Item[], n: number, rng: Rng, lvl: ExamLevel, avoid: Set<string>): McqQ[] {
  const out: McqQ[] = []
  const pool = shuffle(words.filter((w) => w.pos !== 'part' && w.pos !== 'pre' && firstSense(w.fr).length <= 34 && !avoid.has(w.id)), rng)
  for (const w of pool) {
    if (out.length >= n) break
    const ok = firstSense(w.fr)
    const senses = new Set(w.fr.split(/\s*[;,/]\s*/).map((s) => s.toLowerCase()))
    const g = posGroup(w.pos)
    const wrong: string[] = []
    for (const d of shuffle(words, rng)) {
      if (wrong.length >= 3) break
      if (d.id === w.id || posGroup(d.pos) !== g) continue
      const t = firstSense(d.fr)
      if (!t || t.length > 34 || senses.has(t.toLowerCase()) || wrong.includes(t)) continue
      wrong.push(t)
    }
    if (wrong.length < 3) continue
    avoid.add(w.id)
    out.push(
      toMcq(
        { id: `g:${lvl}:kmean:${w.id}`, sec: 'voc', kind: 'kmean', q: `「${w.jp}」の 意味は どれですか。`, qk: `「${w.kana}」 の いみ は どれ です か`, x: `${w.jp} (${w.kana} · ${w.romaji}) = ${w.fr}.` },
        { t: ok },
        wrong.map((t) => ({ t })),
        rng,
        true
      )
    )
  }
  return out
}

function genWrite(words: Item[], n: number, rng: Rng, lvl: ExamLevel, avoid: Set<string>): TypeQ[] {
  // un sens = un seul mot du deck, pour qu'aucune réponse correcte ne soit refusée
  const count = new Map<string, number>()
  for (const w of words) {
    const s = firstSense(w.fr).toLowerCase()
    count.set(s, (count.get(s) ?? 0) + 1)
  }
  const pool = shuffle(
    words.filter(
      (w) => ['n', 'v', 'i', 'na', 'adv'].includes(w.pos) && count.get(firstSense(w.fr).toLowerCase()) === 1 && !w.fr.includes(';') && w.fr.length <= 26 && w.kana.replace(/[ー]/g, '').length <= 7 && !avoid.has(w.id) && !/[A-Za-z0-9\s]/.test(w.kana)
    ),
    rng
  )
  return pool.slice(0, n).map((w) => {
    avoid.add(w.id)
    const ans = [w.jp, w.kana, ...(w.alt ?? [])]
    const rom = [canon(w.romaji)]
    return {
      id: `g:${lvl}:write:${w.id}`,
      sec: 'voc' as const,
      kind: 'write',
      t: 'type' as const,
      q: `« ${w.fr} »`,
      hint: POS_LABEL[w.pos] ?? '',
      fr: true,
      ans,
      rom,
      good: w.kana !== w.jp ? `${w.jp}（${w.kana}）· ${w.romaji}` : `${w.jp} · ${w.romaji}`,
      x: `${w.fr} → ${w.jp}${w.kana !== w.jp ? ` (${w.kana})` : ''}, ${w.romaji}.`
    }
  })
}

// ───────── Questions de la banque ─────────
function fromRaw(lvl: ExamLevel, raw: RawQ, idx: number, rng: Rng): Question {
  const id = `${lvl}:${idx}`
  if (raw.t === 'mcq') {
    const o = raw.o ?? []
    const order = shuffle(o.map((_, i) => i), rng)
    const opts: Opt[] = order.map((i) => ({ t: o[i], k: raw.ok?.[i] || undefined }))
    return { id, t: 'mcq', sec: raw.s, kind: raw.k, q: raw.q ?? '', qk: raw.qk, x: raw.x, opts, a: order.indexOf(raw.a ?? 0) }
  }
  if (raw.t === 'type') {
    const ans = raw.ans ?? []
    const rom = [...new Set(ans.flatMap(romForms))]
    const label = /^（[０-９0-9]+）/.exec(raw.q ?? '')?.[0]
    return { id, t: 'type', sec: raw.s, kind: raw.k, q: raw.q ?? '', qk: raw.qk, x: raw.x, ans, rom, good: ans[0], hint: raw.hint, label }
  }
  const parts = raw.parts ?? []
  const tiles = shuffle(parts.map((_, i) => i), rng)
  // jamais déjà dans le bon ordre au départ
  if (tiles.every((t, i) => t === i)) tiles.reverse()
  return {
    id,
    t: 'order',
    sec: raw.s,
    kind: 'order',
    q: '',
    x: raw.x,
    pre: raw.pre ?? '',
    prek: raw.prek,
    post: raw.post ?? '',
    postk: raw.postk,
    parts: parts.map((t, i) => ({ t, k: raw.partsk?.[i] })),
    star: raw.star ?? 0,
    tiles
  }
}

function sampleSets(list: RawQ[], nSets: number, rng: Rng): RawQ[][] {
  const groups = new Map<string, RawQ[]>()
  for (const q of list) {
    const key = q.set ?? `solo-${groups.size}`
    groups.set(key, [...(groups.get(key) ?? []), q])
  }
  return pick([...groups.values()], nSets, rng)
}

// ───────── Composition d'un examen ─────────
interface Plan {
  kread: number
  kmean: number
  write: number
  ctx: number
  para: number
  gmcq: number
  order: number
  tset: number
  rset: number
}
export const PLAN: Record<ExamMode, Plan> = {
  mini: { kread: 1, kmean: 1, write: 1, ctx: 1, para: 0, gmcq: 2, order: 1, tset: 1, rset: 1 },
  full: { kread: 3, kmean: 2, write: 3, ctx: 4, para: 2, gmcq: 6, order: 3, tset: 1, rset: 2 }
}
const DECK_LEVELS: ExamLevel[] = ['N5', 'N4', 'N3']

/** mots du deck dont l'écriture en kanji existe en double (ex. 一日 : ついたち / いちにち) : ambigus, donc évités */
function uniqueWords(items: Item[], lvl: ExamLevel): Item[] {
  const all = items.filter((i) => i.kind === 'word')
  const seen = new Map<string, number>()
  for (const w of all) seen.set(w.jp, (seen.get(w.jp) ?? 0) + 1)
  return all.filter((w) => w.deck === lvl && seen.get(w.jp) === 1)
}

export function buildExam(lvl: ExamLevel, mode: ExamMode, items: Item[], rng: Rng = Math.random): Exam {
  const raw = BANK[lvl]
  const plan = PLAN[mode]
  const single = (q: Question): Page => ({ id: `p:${q.id}`, sec: q.sec, qs: [q] })
  const rawPage = (kind: string, n: number) =>
    pick(
      raw.map((q, i) => ({ q, i })).filter((x) => x.q.k === kind),
      n,
      rng
    ).map((x) => single(fromRaw(lvl, x.q, x.i, rng)))
  const setPages = (kind: string, n: number): Page[] =>
    sampleSets(
      raw.filter((q) => q.k === kind),
      n,
      rng
    ).map((grp) => {
      const qs = grp.map((q) => fromRaw(lvl, q, raw.indexOf(q), rng))
      return { id: `p:${lvl}:${grp[0].set ?? qs[0].id}`, sec: grp[0].s, ctx: grp[0].ctx, ctxk: grp[0].ctxk, qs }
    })

  const voc: Page[] = []
  if (DECK_LEVELS.includes(lvl)) {
    const words = uniqueWords(items, lvl)
    const avoid = new Set<string>()
    voc.push(...genKread(words, plan.kread, rng, lvl).map(single))
    voc.push(...rawPage('ctx', plan.ctx), ...rawPage('para', plan.para))
    voc.push(...genKmean(words, plan.kmean, rng, lvl, avoid).map(single))
    voc.push(...genWrite(words, plan.write, rng, lvl, avoid).map(single))
  } else {
    voc.push(...rawPage('kread', plan.kread + plan.kmean))
    voc.push(...rawPage('ctx', plan.ctx), ...rawPage('para', plan.para + 1))
    voc.push(...rawPage('kwrite', plan.write))
  }
  const gram = [...rawPage('gmcq', plan.gmcq), ...rawPage('order', plan.order), ...setPages('tset', plan.tset)]
  const read = setPages('rset', plan.rset)
  const pages = [...voc, ...gram, ...read]
  return { lvl, mode, pages, total: pages.reduce((n, p) => n + p.qs.length, 0) }
}

// ───────── Correction ─────────
export interface QResult {
  q: Question
  ans: Answer
  ok: boolean
}
export interface ExamResult {
  ok: number
  total: number
  pct: number
  passed: boolean
  sections: Record<Section, { ok: number; total: number }>
  rows: QResult[]
}

export function gradeExam(exam: Exam, answers: Record<string, Answer>): ExamResult {
  const sections: ExamResult['sections'] = { voc: { ok: 0, total: 0 }, gram: { ok: 0, total: 0 }, read: { ok: 0, total: 0 } }
  const rows: QResult[] = []
  let ok = 0
  for (const p of exam.pages) {
    for (const q of p.qs) {
      const good = gradeQuestion(q, answers[q.id])
      sections[q.sec].total++
      if (good) {
        sections[q.sec].ok++
        ok++
      }
      rows.push({ q, ans: answers[q.id], ok: good })
    }
  }
  const total = rows.length
  const pct = total ? ok / total : 0
  return { ok, total, pct, passed: pct >= PASS, sections, rows }
}

/** Un nouvel examen (non enregistré) avec seulement les questions ratées. */
export function retryExam(exam: Exam, result: ExamResult): Exam {
  const bad = new Set(result.rows.filter((r) => !r.ok).map((r) => r.q.id))
  const pages = exam.pages
    .map((p) => ({ ...p, qs: p.qs.filter((q) => bad.has(q.id)) }))
    .filter((p) => p.qs.length)
  return { ...exam, pages, total: pages.reduce((n, p) => n + p.qs.length, 0), practice: true }
}

export function correctText(q: Question): string {
  if (q.t === 'mcq') return q.opts[q.a]?.t ?? ''
  if (q.t === 'type') return q.good
  return q.pre + q.parts.map((p) => p.t).join(' ') + q.post
}

export function answerText(q: Question, a: Answer): string {
  if (a === undefined || a === '' || (Array.isArray(a) && !a.length)) return '—'
  if (q.t === 'mcq') return typeof a === 'number' ? q.opts[a]?.t ?? '—' : '—'
  if (q.t === 'type') return typeof a === 'string' ? a : '—'
  return Array.isArray(a) ? q.pre + a.map((i) => q.parts[i]?.t ?? '？').join(' ') + q.post : '—'
}

// ───────── Historique (stocké dans `ach`, compatible avec les anciennes versions) ─────────
export interface ExamRecord {
  lvl: ExamLevel
  mode: ExamMode
  ok: number
  total: number
  t: number
}
export const examKey = (r: ExamRecord) => `x:${r.lvl}:${r.mode === 'full' ? 'f' : 'm'}:${r.ok}:${r.total}:${r.t}`

export function examHistory(ach: Record<string, number>): ExamRecord[] {
  const out: ExamRecord[] = []
  for (const key of Object.keys(ach)) {
    if (!key.startsWith('x:')) continue
    const [, lvl, m, ok, total, t] = key.split(':')
    if (!EXAM_LEVELS.includes(lvl as ExamLevel)) continue
    const rec = { lvl: lvl as ExamLevel, mode: (m === 'f' ? 'full' : 'mini') as ExamMode, ok: Number(ok), total: Number(total), t: Number(t) }
    if (!Number.isFinite(rec.ok) || !Number.isFinite(rec.total) || !Number.isFinite(rec.t) || rec.total <= 0) continue
    out.push(rec)
  }
  return out.sort((a, b) => b.t - a.t)
}

export interface LevelBest {
  /** meilleur score sur un examen complet (0..1) */
  full: number | null
  /** meilleur score sur un test rapide (0..1) */
  mini: number | null
  /** examen complet réussi (≥ 70 %) */
  passed: boolean
  tries: number
}
export function bestByLevel(history: ExamRecord[]): Record<ExamLevel, LevelBest> {
  const res = {} as Record<ExamLevel, LevelBest>
  for (const l of EXAM_LEVELS) res[l] = { full: null, mini: null, passed: false, tries: 0 }
  for (const r of history) {
    const b = res[r.lvl]
    const pct = r.ok / r.total
    b.tries++
    if (r.mode === 'full') {
      b.full = Math.max(b.full ?? 0, pct)
      if (pct >= PASS) b.passed = true
    } else b.mini = Math.max(b.mini ?? 0, pct)
  }
  return res
}

export function examStats(ach: Record<string, number>) {
  const h = examHistory(ach)
  const best = bestByLevel(h)
  return {
    exams: h.length,
    examsPassed: EXAM_LEVELS.filter((l) => best[l].passed),
    examPerfect: h.some((r) => r.ok === r.total && r.total >= 10)
  }
}

/** Niveau d'examen conseillé : celui de ton estimation (mots retenus), ou le suivant s'il est déjà validé. */
export function recommendedLevel(milestoneId: string, best: Record<ExamLevel, LevelBest>): ExamLevel {
  const start: ExamLevel = milestoneId === 'start' || milestoneId === 'n5' ? 'N5' : milestoneId === 'n5ok' || milestoneId === 'n4' ? 'N4' : 'N3'
  let i = EXAM_LEVELS.indexOf(start)
  while (i < EXAM_LEVELS.length - 1 && best[EXAM_LEVELS[i]].passed) i++
  return EXAM_LEVELS[i]
}

// ───────── Lectures affichées ─────────
const toAsciiDigits = (s: string) => s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))

/** Rōmaji d'un texte en kana espacé ; garde les trous （１）（　） et les retours à la ligne. */
export function romajiOf(kk: string): string {
  return kk
    .split('\n')
    .map((line) =>
      line
        .split(/(（[^）]*）)/)
        .map((part) => {
          if (/^（[^）]*）$/.test(part)) {
            const inner = part.slice(1, -1).trim()
            return inner ? `(${toAsciiDigits(inner)})` : '(____)'
          }
          return toRomaji(part.replace(/[☆★○●◆◇■□▲△→←]/g, ' '))
        })
        .filter(Boolean)
        .join(' ')
    )
    .join('\n')
}

/** Texte français / japonais d'une question avec [[mot]] souligné → segments. */
export function splitMark(text: string): Array<{ t: string; mark: boolean }> {
  const out: Array<{ t: string; mark: boolean }> = []
  const re = /\[\[(.+?)\]\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), mark: false })
    out.push({ t: m[1], mark: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ t: text.slice(last), mark: false })
  return out
}
