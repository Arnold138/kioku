import { describe, expect, it, beforeEach } from 'vitest'
import { dayNumber, dayKey, newCard, type CardState } from '../lib/scheduler'
import { dayTotal, emptyState, mergeStates, sanitize, DEFAULT_SETTINGS } from '../lib/state'
import { baseItems, type Item } from '../lib/deck'
import { ALL, buildQueue, buildPractice } from '../lib/queue'
import { useStore } from '../lib/store'
import { ACHIEVEMENTS } from '../lib/achievements'
import { VERB_FORMS, checkForm, conjKind, conjugate, formTable, formsAtInterval, formsFor, pickForm, verbClass } from '../lib/conjugate'
import { conjKey, conjReward, conjugatedTotal, drillPool, pickDrill } from '../lib/conjdrill'

const now = Date.now()
const today = dayNumber(now)
const known = (extra: Partial<CardState> = {}): CardState => ({ ...newCard(now - 5 * 86_400_000), s: 'review', i: 10, d: today + 5, r: 4, ...extra })
const word = (jp: string, kana?: string): Item => baseItems.find((x) => x.kind === 'word' && x.jp === jp && (!kana || x.kana === kana))!
const form = (it: Item, id: string) => {
  const f = formsFor(it).find((x) => x.id === id)
  return f ? conjugate(it, f) : null
}
const verbs = baseItems.filter((i) => i.kind === 'word' && i.pos === 'v')

describe('v1.14 — conjugaison', () => {
  it('reconnaît la classe de tous les verbes du deck', () => {
    expect(verbs.length).toBeGreaterThan(280)
    expect(verbs.filter((v) => !verbClass(v)).map((v) => v.jp)).toEqual([])
    expect(verbClass(word('食べる'))).toBe('ichidan')
    expect(verbClass(word('帰る'))).toBe('godan') // exception en -eru
    expect(verbClass(word('入る'))).toBe('godan')
    expect(verbClass(word('着る'))).toBe('ichidan')
    expect(verbClass(word('切る'))).toBe('godan')
    expect(verbClass(word('来る'))).toBe('kuru')
    expect(verbClass(word('案内する'))).toBe('suru')
  })

  it('formes justes, avec les kanji du mot', () => {
    const cases: Array<[string, string, string]> = [
      ['食べる', 'masu', '食べます'], ['食べる', 'nai', '食べない'], ['食べる', 'teiru', '食べている'], ['食べる', 'shiekiukemi', '食べさせられる'],
      ['行く', 'te', '行って'], ['行く', 'ta', '行った'], ['書く', 'te', '書いて'], ['泳ぐ', 'ta', '泳いだ'], ['話す', 'te', '話して'],
      ['待つ', 'kanou', '待てる'], ['読む', 'ta', '読んだ'], ['死ぬ', 'vol', '死のう'], ['遊ぶ', 'ba', '遊べば'], ['買う', 'nai', '買わない'],
      ['帰る', 'te', '帰って'], ['来る', 'nai', '来ない'], ['来る', 'masu', '来ます'], ['来る', 'ba', '来れば'], ['する', 'kanou', 'できる'],
      ['案内する', 'temorau', '案内してもらう'], ['案内する', 'tekureru', '案内してくれる'], ['案内する', 'teageru', '案内してあげる'],
      ['起きる', 'teiru', '起きている'], ['生まれる', 'te', '生まれて'], ['思う', 'ta', '思った'], ['いらっしゃる', 'masu', 'いらっしゃいます'],
      ['書く', 'shieki', '書かせる'], ['書く', 'ukemi', '書かれる'], ['書く', 'meirei', '書け'], ['落る', 'masu', '落ちます']
    ]
    for (const [jp, id, out] of cases) expect([jp, id, form(word(jp), id)?.jp]).toEqual([jp, id, out])
    expect(form(word('来る'), 'nai')!.kana).toBe('こない')
    expect(form(word('ある', 'ある') ?? word('在る'), 'nai')?.kana ?? form(word('在る'), 'nai')!.kana).toBe('ない')
  })

  it('adjectifs en い (et いい) et en な', () => {
    expect(form(word('高い'), 'ta')!.jp).toBe('高かった')
    expect(form(word('高い'), 'nai')!.jp).toBe('高くない')
    expect(form(word('高い'), 'te')!.jp).toBe('高くて')
    expect(form(word('いい'), 'nai')!.jp).toBe('よくない')
    expect(form(word('いい'), 'ta')!.jp).toBe('よかった')
    expect(form(word('静か'), 'nakatta')!.jp).toBe('静かじゃなかった')
    expect(form(word('静か'), 'adv')!.jp).toBe('静かに')
    expect(conjKind(word('大きな'))).toBe(null) // adjectif « pré-nom » : pas de formes
  })

  it('les verbes d\'état ou de politesse n\'ont pas les formes qui n\'existent pas', () => {
    const ids = (jp: string) => formsFor(word(jp)).map((f) => f.id)
    expect(ids('分かる')).not.toContain('kanou')
    expect(ids('分かる')).toContain('ta')
    expect(ids('いらっしゃる')).not.toContain('shieki')
    expect(ids('あげる')).not.toContain('teageru')
    expect(ids('食べる')).toHaveLength(VERB_FORMS.length)
  })

  it('accepte kana, kanji, rōmaji et les formes courtes de l\'oral', () => {
    const c = form(word('食べる'), 'teiru')!
    expect(checkForm(c, '食べている').ok).toBe(true)
    expect(checkForm(c, 'たべている').ok).toBe(true)
    expect(checkForm(c, 'tabeteiru').ok).toBe(true)
    expect(checkForm(c, '食べてる').ok).toBe(true)
    expect(checkForm(c, '食べます').ok).toBe(false)
    const p = form(word('見る'), 'kanou')!
    expect(checkForm(p, 'みられる').ok).toBe(true)
    expect(checkForm(p, 'みれる').ok).toBe(true) // ら抜き, très courant à l'oral
    expect(checkForm(p, '').script).toBe('vide')
  })

  it('le tableau d\'un verbe a toutes ses formes', () => {
    const t = formTable(word('案内する'))
    expect(t.map((r) => r.jp)).toContain('案内してもらう')
    expect(t.length).toBe(VERB_FORMS.length)
  })
})

describe('v1.14 — cartes de forme', () => {
  const v = word('食べる')

  it('les formes s\'ajoutent avec la mémoire de la carte : N5, puis N4 (7 j), puis N3 (21 j)', () => {
    const lv = (i: number) => new Set(formsAtInterval(v, i).map((f) => f.lvl))
    expect([...lv(0)]).toEqual(['N5'])
    expect(lv(7).has('N4')).toBe(true)
    expect(lv(7).has('N3')).toBe(false)
    expect(lv(21).has('N3')).toBe(true)
  })

  it('la forme demandée change d\'une révision à l\'autre, sans rien stocker', () => {
    const seen = new Set([0, 1, 2, 3, 4, 5].map((r) => pickForm(v, { i: 30, r })!.id))
    expect(seen.size).toBeGreaterThan(3)
    expect(pickForm(v, { i: 30, r: 2 })!.id).toBe(pickForm(v, { i: 30, r: 2 })!.id)
  })

  it('se débloquent quand le mot est retenu, avec leur propre quota (0 = désactivées)', () => {
    const st = emptyState()
    st.settings = { ...st.settings, newPerDay: 0, production: false, naturalPerDay: 0, reviewsPerDay: 0, clozePerDay: 0, formsPerDay: 3 }
    verbs.slice(0, 10).forEach((w) => (st.cards[`${w.id}:r`] = known()))
    const q = buildQueue(st, baseItems, ALL, now)
    expect(q.freshForm).toHaveLength(3)
    expect(q.freshForm!.every((k) => k.endsWith(':f'))).toBe(true)
    st.settings.formsPerDay = 0
    expect(buildQueue(st, baseItems, ALL, now).freshForm).toHaveLength(0)
    // un nom n'a pas de carte de forme ; un verbe pas encore retenu non plus
    const st2 = emptyState()
    st2.cards[`${word('朝').id}:r`] = known()
    st2.cards[`${verbs[0].id}:r`] = known({ i: 1 })
    expect(buildQueue(st2, baseItems, ALL, now).freshForm).toHaveLength(0)
  })

  it('une carte de forme commencée revient en révision et dans l\'entraînement libre', () => {
    const st = emptyState()
    st.cards[`${v.id}:r`] = known()
    st.cards[`${v.id}:f`] = known({ d: today - 1 })
    expect(buildQueue(st, baseItems, ALL, now).review).toContain(`${v.id}:f`)
    expect(buildPractice(st, baseItems, ALL)).toContain(`${v.id}:f`)
  })

  describe('en séance', () => {
    beforeEach(() => {
      useStore.getState().init()
      const st = emptyState()
      st.settings = { ...st.settings, newPerDay: 0, production: false, naturalPerDay: 0, reviewsPerDay: 0, clozePerDay: 0, formsPerDay: 2, chunk: 0 }
      st.cards[`${v.id}:r`] = known()
      useStore.setState({ state: st, session: null, toasts: [] })
    })
    it('une nouvelle carte de forme compte dans « nf » (pas dans les nouveaux mots) et suit FSRS', () => {
      useStore.getState().startSession(ALL)
      const key = useStore.getState().session!.current!
      expect(key).toBe(`${v.id}:f`)
      useStore.getState().reveal()
      useStore.getState().rate(4)
      const st = useStore.getState().state
      expect(st.cards[key].s).toBe('review')
      expect(st.cards[key].fs).toBeGreaterThan(0)
      expect(dayTotal(st, dayKey(today)).nf).toBe(1)
      expect(dayTotal(st, dayKey(today)).nw).toBe(0)
      expect(dayTotal(st, dayKey(today)).nc ?? 0).toBe(0)
    })
  })

  it('compatibilité : ancienne sauvegarde → 5 par jour ; « :f » et « nf » voyagent à la synchro ; un ancien appareil peut réviser la carte', () => {
    const old = JSON.parse(JSON.stringify({ ...emptyState(), settings: { ...DEFAULT_SETTINGS } }))
    delete old.settings.formsPerDay
    expect(sanitize(old).settings.formsPerDay).toBe(5)
    const a = { ...emptyState(), cards: { 'w46:f': known() }, daily: { '2026-11-01': { x: { n: 1, nw: 0, np: 0, ok: 1, xp: 5, sec: 1, nf: 1 } } } }
    const m = mergeStates(emptyState(), a)
    expect(m.cards['w46:f']).toBeTruthy()
    expect(m.daily['2026-11-01'].x.nf).toBe(1)
    // un ancien appareil (sans fs/fd) modifie la carte plus tard : elle reste valide et gagne à la fusion
    const later = { ...emptyState(), cards: { 'w46:f': { ...known({ r: 9 }), t: now + 1000, fs: undefined, fd: undefined } } }
    const m2 = mergeStates(m, later)
    expect(m2.cards['w46:f'].r).toBe(9)
    expect(pickForm(word('言う'), m2.cards['w46:f'])).toBeTruthy()
  })
})

describe('v1.14 — entraînement Conjugaison', () => {
  it('pioche dans tes mots retenus (ou déjà vus), un mot par question', () => {
    const st = emptyState()
    verbs.slice(0, 12).forEach((w) => (st.cards[`${w.id}:r`] = known()))
    const pool = drillPool(st, baseItems, 'v', 'known')
    expect(pool).toHaveLength(12)
    const qs = pickDrill(pool, ['base'])
    expect(qs).toHaveLength(10)
    expect(new Set(qs.map((q) => q.word.id)).size).toBe(10)
    expect(qs.every((q) => q.c.form.group === 'base')).toBe(true)
    expect(drillPool(emptyState(), baseItems, 'adj', 'all').every((w) => conjKind(w) !== 'v')).toBe(true)
  })

  it('XP : 12 par forme juste, combo, +40 si 10/10 ; historique « cj: »', () => {
    const r = conjReward(new Array(10).fill(true))
    expect(r.answers).toBe(120)
    expect(r.perfect).toBe(40)
    expect(r.combo).toBeGreaterThan(0)
    expect(conjReward([true, false]).total_xp).toBe(12)
    expect(conjugatedTotal({ [conjKey(7, 10, 1)]: 1, [conjKey(3, 10, 2)]: 2, 'tk:4:5:3': 3 })).toBe(10)
  })

  it('le store crédite l\'XP et débloque « Premières formes » à 10', () => {
    useStore.getState().init()
    useStore.setState({ state: emptyState(), session: null, toasts: [] })
    const r = useStore.getState().recordConj({ results: new Array(10).fill(true) })
    expect(r.total_xp).toBeGreaterThan(160)
    expect(useStore.getState().state.ach.cj10).toBeTruthy()
    expect(ACHIEVEMENTS.filter((a) => a.family === 'conj').map((a) => a.id)).toEqual(['cj10', 'cj100', 'cj500'])
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })
})

describe('v1.14 — nouveaux mots de la vidéo', () => {
  it('ajoutés comme des mots normaux, proposés en premier dans les nouvelles cartes', () => {
    for (const jp of ['案内する', '地元', '後で', 'ドーナツ', '食べ歩き', 'わざわざ', '夜明け']) expect(word(jp)).toBeTruthy()
    expect(new Set(baseItems.map((i) => i.id)).size).toBe(baseItems.length)
    const st = emptyState()
    const q = buildQueue(st, baseItems, ALL, now)
    expect(q.fresh[0]).toBe(`${word('案内する').id}:r`)
    // 昼ご飯 s'écrit aussi comme ça
    expect(word('昼御飯').alt).toContain('昼ご飯')
  })
})
