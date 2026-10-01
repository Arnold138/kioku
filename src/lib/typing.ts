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
