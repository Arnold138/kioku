import { isKana, katakanaToHiragana, toRomaji } from './romaji'
import type { Item } from './deck'

/**
 * Forme canonique d'un rōmaji, pour comparer sans se soucier de l'orthographe :
 * Hepburn (shi, chi, tsu, fu, ji) ou Kunrei/clavier (si, ti, tu, hu, zi), voyelles longues (ō, oo, ou),
 * n / nn / n', majuscules, espaces et ponctuation.
 */
export function canon(input: string): string {
  let s = input.toLowerCase().normalize('NFC')
  s = s.replace(/[āâ]/g, 'aa').replace(/[īî]/g, 'ii').replace(/[ūû]/g, 'uu').replace(/[ēê]/g, 'ee').replace(/[ōô]/g, 'oo')
  s = s.replace(/[\s'’`´\-.,;:!?。、！？…「」『』()（）・~〜]/g, '')
  s = s.replace(/tch/g, 'tt')
  s = s.replace(/shi/g, 'si').replace(/sh/g, 'sy')
  s = s.replace(/chi/g, 'ti').replace(/ch/g, 'ty').replace(/cy/g, 'ty')
  s = s.replace(/tsu/g, 'tu')
  s = s.replace(/fu/g, 'hu')
  s = s.replace(/ji/g, 'zi').replace(/jy/g, 'zy').replace(/j/g, 'zy')
  s = s.replace(/dzu/g, 'zu').replace(/di/g, 'zi').replace(/du/g, 'zu')
  s = s.replace(/wo/g, 'o')
  s = s.replace(/ou/g, 'oo').replace(/ei/g, 'ee').replace(/oh/g, 'oo')
  s = s.replace(/n+/g, 'n')
  return s
}

const strip = (s: string) => s.replace(/[\s。、．，！？!?…「」『』（）()・]/g, '')

export interface TypedResult {
  ok: boolean
  /** ce que l'utilisateur a saisi, tel quel */
  input: string
  /** le script détecté : rōmaji (lettres), kana ou kanji */
  script: 'romaji' | 'japonais' | 'vide'
}

/** Vérifie une réponse tapée pour un mot (carte de production : FR → JP). Tolérant sur l'orthographe du rōmaji. */
export function checkTyped(it: Item, raw: string): TypedResult {
  const input = raw.trim()
  if (!input) return { ok: false, input, script: 'vide' }

  // Ce qu'on accepte comme bonne réponse
  const jpForms = [it.jp, it.kana, ...(it.alt ?? [])].map((x) => katakanaToHiragana(strip(x)))
  const romajiForms = new Set<string>([canon(it.romaji)])
  // salutations en は prononcé « wa » : on accepte aussi l'écriture « ha »
  if (/は$/.test(it.kana.trim()) && /wa$/.test(it.romaji)) romajiForms.add(canon(it.romaji.replace(/wa$/, 'ha')))

  if (/[^\x00-\x7F]/.test(input)) {
    // saisie avec un clavier japonais (kana / kanji) — ou avec des macrons (ō)
    if (/^[A-Za-zāīūēōâîûêô\s'’\-]+$/.test(input)) return { ok: romajiForms.has(canon(input)), input, script: 'romaji' }
    const typed = katakanaToHiragana(strip(input))
    if (jpForms.includes(typed)) return { ok: true, input, script: 'japonais' }
    if (isKana(input)) return { ok: romajiForms.has(canon(toRomaji(input))), input, script: 'japonais' }
    return { ok: false, input, script: 'japonais' }
  }
  return { ok: romajiForms.has(canon(input)), input, script: 'romaji' }
}

// ───────── Traduction écrite (japonais → français) ─────────
// Aucune « vraie » correction automatique n'est possible pour une phrase libre : on compare les mots importants
// de ta traduction avec ceux de la traduction de référence, et c'est toi qui juges ensuite avec les 5 boutons.

const STOP = new Set(
  ('le la les l un une des de du d a à au aux en et ou je j tu il elle on nous vous ils elles me m te t se s ce c cet cette ces ' +
    'mon ma mes ton ta tes son sa ses notre votre leur leurs est es suis sommes etes sont etre ai as avons avez ont avoir ' +
    'que qu qui y ne n dans par pour sur avec chez tres bien aussi mais donc alors si comme quoi').split(' ')
)

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')

const stem = (w: string) => (w.length > 4 ? w.replace(/(ement|ees|ent|es|er|ez|ons|ait|ais|e|s|x|t)$/, '') : w.replace(/[sx]$/, ''))

/** mots « importants » d'un texte français, sous forme racinisée */
export function keyWords(text: string): Array<{ raw: string; stem: string }> {
  const out: Array<{ raw: string; stem: string }> = []
  const rawWords = text.replace(/\([^)]*\)/g, ' ').split(/[^A-Za-zÀ-ÿœŒ0-9]+/).filter(Boolean)
  for (const raw of rawWords) {
    const p = plain(raw).trim()
    if (!p || STOP.has(p)) continue
    out.push({ raw, stem: stem(p) })
  }
  return out
}

export type TrVerdict = 'ok' | 'close' | 'no' | 'vide'
export interface TranslationResult {
  verdict: TrVerdict
  input: string
  /** 0 → 1 : part des mots importants de la référence retrouvés */
  score: number
  /** mots importants de la référence qui manquent dans ta réponse */
  missing: string[]
}

const sameStem = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))

/** Compare ta traduction à la référence. Pour un mot seul, n'importe quel sens listé (séparés par , ; /) suffit. */
export function checkTranslation(it: Item, raw: string): TranslationResult {
  const input = raw.trim()
  if (!input) return { verdict: 'vide', input, score: 0, missing: [] }
  const mine = keyWords(input).map((k) => k.stem)
  const hit = (s: string) => mine.some((m) => sameStem(m, s))

  if (it.kind === 'word') {
    const senses = it.fr.split(/[,;/]/).map((x) => keyWords(x)).filter((k) => k.length)
    let best = 0
    for (const sense of senses) {
      const ratio = sense.filter((k) => hit(k.stem)).length / sense.length
      best = Math.max(best, ratio)
    }
    return { verdict: best >= 1 ? 'ok' : best > 0 ? 'close' : 'no', input, score: best, missing: [] }
  }

  const ref = keyWords(it.fr)
  if (!ref.length) return { verdict: 'close', input, score: 0, missing: [] }
  const found = ref.filter((k) => hit(k.stem))
  const missing = ref.filter((k) => !hit(k.stem)).map((k) => k.raw)
  const score = found.length / ref.length
  return { verdict: score >= 0.7 ? 'ok' : score >= 0.4 ? 'close' : 'no', input, score, missing }
}
