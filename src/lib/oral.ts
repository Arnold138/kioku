/**
 * v1.10 — Oral : shadowing (écouter → répéter → comparer) et production orale (dire le mot, le téléphone vérifie).
 *
 * Comme l'écoute, ces exercices ne touchent pas au planning des cartes : ils rapportent de l'XP,
 * et leur historique est rangé dans `ach` (aucun nouveau champ dans la sauvegarde) :
 *   o:<m>:<ok>:<total>:<t>   un exercice oral terminé (m = h shadowing · v production orale)
 */
import type { AppState } from './state'
import type { Item } from './deck'
import { isKnown } from './scheduler'
import { katakanaToHiragana } from './romaji'
import { listenMult } from './rewards'

export type OralMode = 'h' | 'v'
export const ORAL_ROUND = 10
/** XP par réussite : parler demande plus d'effort qu'une carte (≈ 10 XP). */
export const ORAL_XP_PER: Record<OralMode, number> = { h: 14, v: 18 }
export const ORAL_XP_BASE = 10
export const ORAL_XP_PERFECT = 50

export interface OralReward {
  ok: number
  total: number
  answers: number
  combo: number
  perfect: number
  base: number
  total_xp: number
  bestCombo: number
}

export function oralReward(mode: OralMode, results: boolean[]): OralReward {
  const per = ORAL_XP_PER[mode]
  let streak = 0
  let best = 0
  let answers = 0
  let combo = 0
  for (const ok of results) {
    if (!ok) {
      streak = 0
      continue
    }
    streak++
    best = Math.max(best, streak)
    answers += per
    combo += per * (listenMult(streak) - 1)
  }
  const ok = results.filter(Boolean).length
  const total = results.length
  const perfect = total >= ORAL_ROUND && ok === total ? ORAL_XP_PERFECT : 0
  const comboR = Math.round(combo)
  return { ok, total, answers, combo: comboR, perfect, base: ORAL_XP_BASE, total_xp: ORAL_XP_BASE + answers + comboR + perfect, bestCombo: best }
}

export const oralKey = (m: OralMode, ok: number, total: number, t: number) => `o:${m}:${ok}:${total}:${t}`

export function oralHistory(ach: Record<string, number>): Array<{ mode: OralMode; ok: number; total: number; t: number }> {
  const out: Array<{ mode: OralMode; ok: number; total: number; t: number }> = []
  for (const key of Object.keys(ach)) {
    if (!key.startsWith('o:')) continue
    const [, m, ok, total, t] = key.split(':')
    if (m !== 'h' && m !== 'v') continue
    const rec = { mode: m as OralMode, ok: Number(ok), total: Number(total), t: Number(t) }
    if (!Number.isFinite(rec.ok) || !Number.isFinite(rec.total) || !Number.isFinite(rec.t) || rec.total <= 0) continue
    out.push(rec)
  }
  return out.sort((a, b) => a.t - b.t)
}

// ───────────────────────── Choix des cartes ─────────────────────────
const shuffle = <T,>(a: T[], rnd = Math.random): T[] => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

export type OralSrc = 'words' | 'sentences'

/**
 * Cartes de l'exercice : d'abord celles que tu reconnais déjà (on parle ce qu'on comprend),
 * complétées par celles déjà vues, puis par du N5.
 * Production orale : seulement des mots (le téléphone reconnaît mal une phrase entière mot pour mot).
 */
export function pickOral(items: Item[], cards: AppState['cards'], mode: OralMode, src: OralSrc, rnd = Math.random): Item[] {
  const kind = mode === 'v' || src === 'words' ? 'word' : 'sentence'
  const pool = items.filter((i) => (kind === 'word' ? i.kind === 'word' || i.kind === 'custom' : i.kind === 'sentence') && (kind === 'sentence' ? i.jp.length <= 24 : i.kana.length >= 2))
  const seen = pool.filter((i) => {
    const c = cards[`${i.id}:r`]
    return c && c.s !== 'new'
  })
  const known = seen.filter((i) => isKnown(cards[`${i.id}:r`]!))
  const ordered = [...shuffle(known, rnd), ...shuffle(seen.filter((i) => !known.includes(i)), rnd), ...shuffle(pool.filter((i) => i.lvl === 'N5' && !seen.includes(i)), rnd)]
  return ordered.slice(0, ORAL_ROUND)
}

// ───────────────────────── Vérification de la réponse orale ─────────────────────────
/** Forme comparable : NFKC, sans espaces ni ponctuation, katakana → hiragana, sans « ～ ». */
export function normalizeJa(s: string): string {
  return katakanaToHiragana(
    s
      .normalize('NFKC')
      .replace(/[\s、。，．,.!?！？「」『』（）()〜~～・…:：;；"'“”]/g, '')
  )
}

export interface SpokenCheck {
  ok: boolean
  /** ce que le téléphone a compris (meilleure proposition) */
  heard: string
}

/**
 * Le mot prononcé correspond-il à la carte ? On accepte la forme écrite (kanji), la lecture en kana
 * et les variantes, et toute proposition du téléphone qui les contient
 * (ex. « 食べる » ou « たべる » pour 食べる ; « 秋です » pour 秋).
 */
export function checkSpoken(item: Pick<Item, 'jp' | 'kana' | 'alt'>, alternatives: string[]): SpokenCheck {
  const targets = [item.jp, item.kana, ...(item.alt ?? [])].map(normalizeJa).filter(Boolean)
  const heard = alternatives.find((a) => a.trim()) ?? ''
  for (const a of alternatives) {
    const n = normalizeJa(a)
    if (!n) continue
    // « contient » seulement pour une cible assez précise (2 kana ou plus, ou un kanji) : « あ » seul ne doit pas tout valider
    if (targets.some((t) => n === t || ((t.length >= 2 || /[一-鿿]/.test(t)) && n.includes(t)))) return { ok: true, heard: a.trim() }
  }
  return { ok: false, heard: heard.trim() }
}
