/**
 * v1.14 — Entraînement « Conjugaison » (Réviser librement).
 *
 * Une manche de 10 questions : un mot, une forme, tu l'écris. Ça ne change pas le planning des cartes.
 * L'historique est rangé dans les trophées (clés « cj:<bonnes>:<total>:<date> »), comme l'écoute et le tracé.
 */
import type { Item } from './deck'
import type { AppState } from './state'
import { isKnown } from './scheduler'
import { conjugate, conjKind, formsFor, type Conjugated, type FormGroup } from './conjugate'
import { listenMult, type ListenReward } from './rewards'

export const CONJ_ROUND = 10
export const CONJ_XP = 12
export const CONJ_PERFECT = 40

export type ConjSrc = 'known' | 'all'
export type ConjWords = 'v' | 'adj' | 'both'

export interface DrillQ {
  word: Item
  c: Conjugated
}

/** Mots qui se conjuguent, selon tes choix. « Mes mots » = mots retenus (sinon, déjà vus). */
export function drillPool(state: AppState, items: Item[], words: ConjWords, src: ConjSrc): Item[] {
  const all = items.filter((it) => {
    const k = conjKind(it)
    if (!k) return false
    return words === 'both' || (words === 'v' ? k === 'v' : k !== 'v')
  })
  if (src === 'all') return all
  const known = all.filter((it) => {
    const c = state.cards[`${it.id}:r`]
    return c && isKnown(c)
  })
  if (known.length >= 5) return known
  // pas encore assez de mots retenus : on prend aussi ceux déjà vus
  return all.filter((it) => {
    const c = state.cards[`${it.id}:r`]
    return c && c.s !== 'new'
  })
}

export function pickDrill(pool: Item[], groups: FormGroup[], n = CONJ_ROUND, rnd = Math.random): DrillQ[] {
  const wanted = new Set(groups)
  const cands: DrillQ[] = []
  for (const word of pool) {
    for (const f of formsFor(word)) {
      if (!wanted.has(f.group)) continue
      const c = conjugate(word, f)
      if (c) cands.push({ word, c })
    }
  }
  // tirage au hasard, un mot au plus une fois par manche
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[cands[i], cands[j]] = [cands[j], cands[i]]
  }
  const out: DrillQ[] = []
  const used = new Set<string>()
  for (const q of cands) {
    if (used.has(q.word.id)) continue
    used.add(q.word.id)
    out.push(q)
    if (out.length >= n) break
  }
  return out
}

export type ConjReward = ListenReward

/** 12 XP par bonne forme, multipliés par le combo (comme l'écoute), +40 XP si tout est juste. */
export function conjReward(results: boolean[]): ConjReward {
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
    answers += CONJ_XP
    combo += CONJ_XP * (listenMult(streak) - 1)
  }
  const ok = results.filter(Boolean).length
  const total = results.length
  const perfect = total >= CONJ_ROUND && ok === total ? CONJ_PERFECT : 0
  combo = Math.round(combo)
  return { ok, total, answers, combo, perfect, base: 0, total_xp: answers + combo + perfect, bestCombo: best }
}

export const conjKey = (ok: number, total: number, t: number) => `cj:${ok}:${total}:${t}`

/** Nombre total de formes justes à l'entraînement (pour les trophées). */
export function conjugatedTotal(ach: Record<string, number>): number {
  let n = 0
  for (const k of Object.keys(ach)) {
    if (!k.startsWith('cj:')) continue
    const v = Number(k.split(':')[1])
    if (Number.isFinite(v)) n += v
  }
  return n
}
