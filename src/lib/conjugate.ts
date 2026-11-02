/**
 * v1.14 — Formes des verbes et des adjectifs.
 *
 * Tout est calculé à partir du mot (écriture + lecture) : rien n'est stocké en plus dans la sauvegarde.
 * Une « carte de forme » a l'identifiant « <mot>:f ». Elle se débloque quand le mot est retenu, et la forme
 * demandée change à chaque révision (selon le nombre de révisions de la carte). Les formes s'ajoutent avec la
 * mémoire de la carte : formes N5 au début, N4 quand elle tient 7 jours, N3 à 21 jours.
 */
import type { Item } from './deck'
import { katakanaToHiragana, toRomaji } from './romaji'
import { checkTyped, type TypedResult } from './typing'

export type FormGroup = 'base' | 'envie' | 'pot' | 'don' | 'adj'
export type FormLvl = 'N5' | 'N4' | 'N3'
export type ConjKind = 'v' | 'i' | 'na'

export interface FormDef {
  id: string
  /** nom court affiché sur la carte */
  name: string
  /** ce que la forme veut dire, en français */
  fr: string
  group: FormGroup
  lvl: FormLvl
  kind: ConjKind
}

export const FORM_GROUPS: Array<{ id: FormGroup; label: string; sub: string }> = [
  { id: 'base', label: 'Base', sub: 'ます · ない · た · て · ている' },
  { id: 'envie', label: 'Envie / intention', sub: 'たい · よう · ば · たら' },
  { id: 'pot', label: 'Potentiel, passif, causatif', sub: 'られる · させる · させられる · impératif' },
  { id: 'don', label: 'Donner / recevoir', sub: 'てもらう · てくれる · てあげる' },
  { id: 'adj', label: 'Adjectifs', sub: 'くない · かった · くて · く · だった…' }
]

export const VERB_FORMS: FormDef[] = [
  { id: 'masu', name: 'ます', fr: 'poli', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'masen', name: 'ません', fr: 'poli négatif', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'mashita', name: 'ました', fr: 'poli passé', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'masendeshita', name: 'ませんでした', fr: 'poli passé négatif', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'nai', name: 'ない', fr: 'négatif', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'ta', name: 'た', fr: 'passé', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'nakatta', name: 'なかった', fr: 'passé négatif', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'te', name: 'て', fr: 'forme て (« et… », pour enchaîner ou demander)', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'teiru', name: 'ている', fr: 'continu (« en train de… » ou un état)', group: 'base', lvl: 'N5', kind: 'v' },
  { id: 'tai', name: 'たい', fr: 'envie (« je veux… »)', group: 'envie', lvl: 'N5', kind: 'v' },
  { id: 'mashou', name: 'ましょう', fr: 'proposition polie (« …ons ! »)', group: 'envie', lvl: 'N5', kind: 'v' },
  { id: 'vol', name: 'volitif', fr: 'intention (« …ons ! », « je vais… »)', group: 'envie', lvl: 'N4', kind: 'v' },
  { id: 'ba', name: 'ば', fr: 'condition (« si… »)', group: 'envie', lvl: 'N4', kind: 'v' },
  { id: 'tara', name: 'たら', fr: 'condition (« si / quand… »)', group: 'envie', lvl: 'N4', kind: 'v' },
  { id: 'kanou', name: 'potentiel', fr: '« pouvoir… »', group: 'pot', lvl: 'N4', kind: 'v' },
  { id: 'ukemi', name: 'passif', fr: '« être … » (subir)', group: 'pot', lvl: 'N4', kind: 'v' },
  { id: 'shieki', name: 'causatif', fr: '« faire / laisser … »', group: 'pot', lvl: 'N4', kind: 'v' },
  { id: 'meirei', name: 'impératif', fr: 'ordre direct (« … ! »)', group: 'pot', lvl: 'N4', kind: 'v' },
  { id: 'shiekiukemi', name: 'causatif-passif', fr: '« être obligé de … »', group: 'pot', lvl: 'N3', kind: 'v' },
  { id: 'temorau', name: 'てもらう', fr: '« se faire … » (quelqu\'un le fait pour moi, je le demande)', group: 'don', lvl: 'N4', kind: 'v' },
  { id: 'tekureru', name: 'てくれる', fr: '« quelqu\'un … pour moi »', group: 'don', lvl: 'N4', kind: 'v' },
  { id: 'teageru', name: 'てあげる', fr: '« je … pour quelqu\'un »', group: 'don', lvl: 'N4', kind: 'v' }
]

const ADJ_FORMS_BASE: Array<Omit<FormDef, 'kind' | 'group'>> = [
  { id: 'nai', name: 'négatif', fr: '« pas … »', lvl: 'N5' },
  { id: 'ta', name: 'passé', fr: '« c\'était … »', lvl: 'N5' },
  { id: 'nakatta', name: 'passé négatif', fr: '« ce n\'était pas … »', lvl: 'N5' },
  { id: 'te', name: 'forme て', fr: '« … et » (pour enchaîner)', lvl: 'N5' },
  { id: 'adv', name: 'adverbe', fr: '« …ment » (devant un verbe)', lvl: 'N5' },
  { id: 'naru', name: 'devenir', fr: '« devenir … »', lvl: 'N4' },
  { id: 'sugi', name: 'trop', fr: '« trop … »', lvl: 'N4' },
  { id: 'tara', name: 'たら', fr: '« si c\'est … »', lvl: 'N4' },
  { id: 'ba', name: 'condition', fr: '« si c\'est … » (ば / なら)', lvl: 'N4' }
]
export const ADJ_FORMS: Record<'i' | 'na', FormDef[]> = {
  i: ADJ_FORMS_BASE.map((f) => ({ ...f, kind: 'i', group: 'adj' })),
  na: ADJ_FORMS_BASE.map((f) => ({ ...f, kind: 'na', group: 'adj' }))
}

// ───────────────────────── Classes de verbes ─────────────────────────
export type VerbClass = 'ichidan' | 'godan' | 'suru' | 'kuru'

/** Verbes en -iru / -eru qui se conjuguent pourtant comme des verbes en う (godan). */
const GODAN_RU = new Set(['知る', '切る', '走る', '要る', '入る', '帰る', '滑る', '参る', '限る', '減る', '握る', '喋る', '蹴る', '照る', '散る', '混じる', '焦る', '湿る', '茂る', '覆る'])
/** Verbes honorifiques en -aru : ます → い (いらっしゃいます), impératif en い. */
const HONOR_ARU = new Set(['いらっしゃる', 'くださる', 'なさる', 'おっしゃる'])
/** Verbes d'état : pas de potentiel, passif, causatif, impératif, volitif ni « donner / recevoir ». */
const STATIVE = new Set(['在る', '有る', 'ある', 'できる', '分かる', 'わかる', '見える', '聞こえる', '要る', '違う'])
/** Verbes de politesse (honorifiques / modestes) : seulement les formes de base et d'envie. */
const POLITE = new Set(['いらっしゃる', 'くださる', 'なさる', 'おっしゃる', '申す', '致す', '参る', '申し上げる', '差し上げる', 'いただく', 'ごらんになる', 'おいでになる', '召し上がる', '伺う', 'うかがう', 'おる'])
/** Verbes de don eux-mêmes : pas de てもらう / てくれる / てあげる. */
const GIVING = new Set(['あげる', '上げる', 'くれる', 'もらう', '差し上げる', 'いただく', 'くださる'])
/** « donner (à moi) » : seulement les formes de base (くれたい n'existe pas). */
const GIVER_TO_ME = new Set(['くれる', 'くださる'])
/** Écritures anciennes du deck → écriture actuelle (pour afficher les formes avec le bon okurigana). */
const MODERN_JP: Record<string, string> = { 落る: '落ちる', 終る: '終わる', 曲る: '曲がる', 楽む: '楽しむ', 落す: '落とす' }

const IE_ROW = 'いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ'
const GODAN_ROWS: Record<string, [string, string, string, string]> = {
  う: ['わ', 'い', 'え', 'お'],
  く: ['か', 'き', 'け', 'こ'],
  ぐ: ['が', 'ぎ', 'げ', 'ご'],
  す: ['さ', 'し', 'せ', 'そ'],
  つ: ['た', 'ち', 'て', 'と'],
  ぬ: ['な', 'に', 'ね', 'の'],
  ぶ: ['ば', 'び', 'べ', 'ぼ'],
  む: ['ま', 'み', 'め', 'も'],
  る: ['ら', 'り', 'れ', 'ろ']
}

const jpOf = (it: Pick<Item, 'jp'>) => MODERN_JP[it.jp] ?? it.jp
const kanaOf = (it: Pick<Item, 'kana'>) => katakanaToHiragana(it.kana.replace(/\s+/g, ''))

/** Le mot se conjugue-t-il ? (verbe, adjectif en い ou en な) */
export function conjKind(it: Pick<Item, 'pos' | 'kind' | 'kana' | 'jp'>): ConjKind | null {
  if (it.kind !== 'word') return null
  const kana = kanaOf(it)
  if (it.pos === 'v') return verbClass(it) ? 'v' : null
  if (it.pos === 'i') return kana.endsWith('い') && kana.length >= 2 ? 'i' : null
  if (it.pos === 'na') return kana.length >= 1 ? 'na' : null
  return null
}

export function verbClass(it: Pick<Item, 'jp' | 'kana'>): VerbClass | null {
  const kana = kanaOf(it)
  const jp = jpOf(it)
  if (kana.endsWith('する')) return 'suru'
  if (kana === 'くる' && (jp === '来る' || jp === 'くる')) return 'kuru'
  const last = kana.slice(-1)
  if (!GODAN_ROWS[last]) return null
  if (last === 'る' && kana.length >= 2 && IE_ROW.includes(kana.slice(-2, -1)) && !GODAN_RU.has(jp)) return 'ichidan'
  return 'godan'
}

export const VERB_CLASS_LABEL: Record<VerbClass, string> = {
  ichidan: 'verbe en る (ichidan)',
  godan: 'verbe en う (godan)',
  suru: 'verbe en する (irrégulier)',
  kuru: '来る (irrégulier)'
}

// ───────────────────────── Conjugaison (en kana) ─────────────────────────
/** Formes en kana : la première est la réponse principale, les suivantes sont aussi acceptées. */
function verbKana(kana: string, cls: VerbClass, form: string, jp: string): string[] {
  const te = teForm(kana, cls, jp)
  const ta = te.replace(/て$/, 'た').replace(/で$/, 'だ')
  if (form === 'te') return [te]
  if (form === 'ta') return [ta]
  if (form === 'teiru') return [te + 'いる', te.slice(0, -1) + (te.endsWith('で') ? 'でる' : 'てる')]
  if (form === 'tara') return [ta + 'ら']
  if (form === 'temorau') return [te + 'もらう']
  if (form === 'tekureru') return [te + 'くれる']
  if (form === 'teageru') return [te + 'あげる']

  if (cls === 'suru') {
    const p = kana.slice(0, -2)
    const m: Record<string, string[]> = {
      stem: [p + 'し'],
      nai: [p + 'しない'],
      vol: [p + 'しよう'],
      ba: [p + 'すれば'],
      kanou: [p + 'できる'],
      ukemi: [p + 'される'],
      shieki: [p + 'させる'],
      shiekiukemi: [p + 'させられる'],
      meirei: [p + 'しろ', p + 'せよ']
    }
    return politeOr(form, m, p + 'し')
  }
  if (cls === 'kuru') {
    const p = kana.slice(0, -2)
    const m: Record<string, string[]> = {
      nai: [p + 'こない'],
      vol: [p + 'こよう'],
      ba: [p + 'くれば'],
      kanou: [p + 'こられる', p + 'これる'],
      ukemi: [p + 'こられる'],
      shieki: [p + 'こさせる'],
      shiekiukemi: [p + 'こさせられる'],
      meirei: [p + 'こい']
    }
    return politeOr(form, m, p + 'き')
  }
  if (cls === 'ichidan') {
    const s = kana.slice(0, -1)
    const m: Record<string, string[]> = {
      nai: [s + 'ない'],
      vol: [s + 'よう'],
      ba: [s + 'れば'],
      kanou: [s + 'られる', s + 'れる'],
      ukemi: [s + 'られる'],
      shieki: [s + 'させる'],
      shiekiukemi: [s + 'させられる'],
      meirei: [s + 'ろ', s + 'よ']
    }
    return politeOr(form, m, s)
  }
  // godan
  const s = kana.slice(0, -1)
  const [a, i, e, o] = GODAN_ROWS[kana.slice(-1)]
  const honor = HONOR_ARU.has(kana)
  const masuStem = s + (honor ? 'い' : i)
  const m: Record<string, string[]> = {
    nai: [kana === 'ある' ? 'ない' : s + a + 'ない'],
    vol: [s + o + 'う'],
    ba: [s + e + 'ば'],
    kanou: [s + e + 'る'],
    ukemi: [s + a + 'れる'],
    shieki: [s + a + 'せる'],
    shiekiukemi: kana.endsWith('す') ? [s + a + 'せられる'] : [s + a + 'される', s + a + 'せられる'],
    meirei: [honor ? (kana === 'くださる' ? 'ください' : s + 'い') : s + e]
  }
  return politeOr(form, m, masuStem)
}

function politeOr(form: string, m: Record<string, string[]>, stem: string): string[] {
  const nai = m.nai?.[0] ?? ''
  switch (form) {
    case 'masu': return [stem + 'ます']
    case 'masen': return [stem + 'ません']
    case 'mashita': return [stem + 'ました']
    case 'masendeshita': return [stem + 'ませんでした']
    case 'tai': return [stem + 'たい']
    case 'mashou': return [stem + 'ましょう']
    case 'nakatta': return [nai.replace(/い$/, 'かった')]
    default: return m[form] ?? []
  }
}

function teForm(kana: string, cls: VerbClass, jp: string): string {
  if (cls === 'suru') return kana.slice(0, -2) + 'して'
  if (cls === 'kuru') return kana.slice(0, -2) + 'きて'
  if (cls === 'ichidan') return kana.slice(0, -1) + 'て'
  const s = kana.slice(0, -1)
  if (kana === 'いく' || jp === '行く' || kana.endsWith('いく') && jp.endsWith('行く')) return s + 'って'
  if (kana === 'とう' || jp === '問う') return s + 'うて'
  switch (kana.slice(-1)) {
    case 'う': case 'つ': case 'る': return s + 'って'
    case 'む': case 'ぶ': case 'ぬ': return s + 'んで'
    case 'く': return s + 'いて'
    case 'ぐ': return s + 'いで'
    case 'す': return s + 'して'
  }
  return kana
}

function adjKana(kana: string, kind: 'i' | 'na', form: string): string[] {
  if (kind === 'i') {
    const s = kana === 'いい' ? 'よ' : kana.slice(0, -1)
    const m: Record<string, string[]> = {
      nai: [s + 'くない'],
      ta: [s + 'かった'],
      nakatta: [s + 'くなかった'],
      te: [s + 'くて'],
      adv: [s + 'く'],
      naru: [s + 'くなる'],
      sugi: kana === 'いい' ? ['よすぎる', 'よさすぎる'] : [s + 'すぎる'],
      tara: [s + 'かったら'],
      ba: [s + 'ければ']
    }
    return m[form] ?? []
  }
  const m: Record<string, string[]> = {
    nai: [kana + 'じゃない', kana + 'ではない'],
    ta: [kana + 'だった'],
    nakatta: [kana + 'じゃなかった', kana + 'ではなかった'],
    te: [kana + 'で'],
    adv: [kana + 'に'],
    naru: [kana + 'になる'],
    sugi: [kana + 'すぎる'],
    tara: [kana + 'だったら'],
    ba: [kana + 'なら']
  }
  return m[form] ?? []
}

/** Passe d'une forme en kana à la même forme écrite avec les kanji du mot. */
export function toJp(jp: string, kana: string, formKana: string): string {
  let k = 0
  while (k < jp.length && k < kana.length && jp[jp.length - 1 - k] === kana[kana.length - 1 - k]) k++
  const kanaStem = kana.length - k
  // la forme change le début du mot : on garde l'écriture en kana
  if (!formKana.startsWith(kana.slice(0, kanaStem))) return formKana
  return jp.slice(0, jp.length - k) + formKana.slice(kanaStem)
}

export interface Conjugated {
  form: FormDef
  /** réponse principale, avec les kanji */
  jp: string
  kana: string
  /** autres réponses acceptées (kana, et la même chose avec les kanji) */
  altKana: string[]
  altJp: string[]
}

/** Les formes possibles pour ce mot (sans tenir compte du niveau). */
export function formsFor(it: Item): FormDef[] {
  const kind = conjKind(it)
  if (!kind) return []
  if (kind !== 'v') return ADJ_FORMS[kind]
  const jp = jpOf(it)
  const kana = kanaOf(it)
  const key = (s: Set<string>) => s.has(jp) || s.has(kana)
  return VERB_FORMS.filter((f) => {
    if (key(STATIVE)) return f.group === 'base' ? f.id !== 'teiru' || jp === '違う' || jp === '分かる' : f.id === 'ba' || f.id === 'tara'
    if (key(POLITE) || key(GIVER_TO_ME)) return (f.group === 'base' && f.id !== 'teiru') || f.id === 'ba' || f.id === 'tara'
    if (f.group === 'don' && key(GIVING)) return false
    return true
  })
}

export function conjugate(it: Item, form: FormDef): Conjugated | null {
  const kind = conjKind(it)
  if (!kind || kind !== form.kind) return null
  const kana = kanaOf(it)
  const jp = jpOf(it)
  let list: string[]
  if (kind === 'v') {
    const cls = verbClass(it)
    if (!cls) return null
    list = verbKana(kana, cls, form.id, jp)
  } else list = adjKana(kana, kind, form.id)
  if (!list.length || !list[0]) return null
  const main = list[0]
  // 来る : le kanji 来 se lit き / こ / く selon la forme
  const write = (k: string) => (kind === 'v' && verbClass(it) === 'kuru' && jp.endsWith('来る') ? jp.slice(0, -2) + '来' + k.slice(kana.length - 1) : toJp(jp, kana, k))
  const jpForm = write(main)
  // mots en katakana (コピーする) : la lecture s'affiche comme l'écriture
  const isKatakanaWord = it.kana.replace(/\s+/g, '') !== kana
  return { form, jp: jpForm, kana: isKatakanaWord ? jpForm : main, altKana: list.slice(1), altJp: list.slice(1).map(write) }
}

/** Tableau complet des formes d'un mot (verso des cartes). */
export function formTable(it: Item): Conjugated[] {
  return formsFor(it)
    .map((f) => conjugate(it, f))
    .filter((c): c is Conjugated => !!c)
}

// ───────────────────────── Cartes de forme (révisions) ─────────────────────────
export const FORM_TIER_N4 = 7 // jours : la carte tient une semaine → formes N4
export const FORM_TIER_N3 = 21 // trois semaines → formes N3

/** Les formes que la carte peut demander, selon sa mémoire (intervalle en jours). */
export function formsAtInterval(it: Item, interval: number): FormDef[] {
  const max: FormLvl = interval >= FORM_TIER_N3 ? 'N3' : interval >= FORM_TIER_N4 ? 'N4' : 'N5'
  const rank: Record<FormLvl, number> = { N5: 0, N4: 1, N3: 2 }
  return formsFor(it).filter((f) => rank[f.lvl] <= rank[max])
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** La forme demandée par la carte : elle change à chaque révision, sans rien stocker. */
export function pickForm(it: Item, card: { i: number; r: number } | undefined): FormDef | null {
  const list = formsAtInterval(it, card?.i ?? 0)
  if (!list.length) return null
  return list[(hash(it.id) + (card?.r ?? 0) * 7) % list.length]
}

/** Ta réponse est bonne si elle correspond à la forme (kanji, kana ou rōmaji), ou à une variante acceptée. */
export function checkForm(c: Conjugated, raw: string): TypedResult {
  const cands: Array<[string, string]> = [[c.jp, c.kana], ...c.altKana.map((k, i): [string, string] => [c.altJp[i], k])]
  let first: TypedResult | null = null
  for (const [jp, k] of cands) {
    const kana = katakanaToHiragana(k)
    const it: Item = { id: '', kind: 'word', jp, kana, romaji: toRomaji(kana), fr: '', pos: '', lvl: 'N5', deck: '', order: 0, alt: [] }
    const r = checkTyped(it, raw)
    if (r.ok || r.script === 'vide') return r
    first ??= r
  }
  return first!
}

export const isFormKey = (cardKey: string) => cardKey.endsWith(':f')
