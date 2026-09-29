// Conversion kana → rōmaji (Hepburn simplifié, fidèle à l'écriture kana :
// おう → "ou", おお → "oo" — pas de macrons, pour retrouver facilement les kana).

const BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o'
}

// Combinaisons (kana + petit ya/yu/yo ou voyelle)
const COMBO: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', しぇ: 'she',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ちぇ: 'che',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo', じぇ: 'je',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
  つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
  いぇ: 'ye'
}

const SPECIAL_TOKENS: Record<string, string> = {
  こんにちは: 'konnichiwa',
  こんばんは: 'konbanwa',
  は: 'wa', // particule isolée
  を: 'o',
  へ: 'e'
}

export function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/ヽ/g, 'ゝ')
}

const VOWELS = 'aiueo'

function convertToken(token: string): string {
  const s = katakanaToHiragana(token)
  let out = ''
  let i = 0
  let geminate = false
  while (i < s.length) {
    const c = s[i]
    if (c === 'っ') {
      geminate = true
      i++
      continue
    }
    if (c === 'ー') {
      const last = out[out.length - 1]
      if (last && VOWELS.includes(last)) out += last
      i++
      continue
    }
    let syl: string | undefined
    let len = 1
    const two = s.slice(i, i + 2)
    if (two.length === 2 && COMBO[two]) {
      syl = COMBO[two]
      len = 2
    } else if (BASE[c] !== undefined) {
      syl = BASE[c]
    } else if (c === 'ゝ') {
      // signe de répétition : répète la dernière syllabe
      syl = ''
    } else {
      // caractère inconnu (kanji, ponctuation…) : on le garde tel quel
      out += c
      i++
      geminate = false
      continue
    }
    if (c === 'ん') {
      // n' devant voyelle ou y : "hon'ya"
      const next = s[i + 1]
      const nextRom = next ? (COMBO[s.slice(i + 1, i + 3)] ?? BASE[next] ?? '') : ''
      syl = nextRom && (VOWELS.includes(nextRom[0]) || nextRom[0] === 'y') ? "n'" : 'n'
    }
    if (geminate && syl) {
      // consonne doublée ; "ch" → "tch"
      syl = syl.startsWith('ch') ? 't' + syl : syl[0] + syl
    }
    geminate = false
    out += syl
    i += len
  }
  if (geminate) out += 't'
  return out
}

/** Convertit un texte kana (avec espaces éventuels) en rōmaji. */
export function toRomaji(kana: string): string {
  return kana
    .trim()
    .split(/\s+/)
    .map((t) => {
      const clean = t.replace(/[。、．，！？!?…「」『』（）()]/g, '')
      if (!clean) return ''
      const punct = t.replace(clean, '')
      const trail = /[？?]$/.test(t) ? '?' : /[！!]$/.test(t) ? '!' : /[。．]$/.test(t) ? '.' : ''
      void punct
      const rom = SPECIAL_TOKENS[clean] ?? convertToken(clean)
      return rom + trail
    })
    .filter(Boolean)
    .join(' ')
}

export const isKana = (s: string) => /^[ぁ-ゟ゠-ヿー・\s]+$/.test(s)
export const hasKanji = (s: string) => /[一-鿿]/.test(s)
