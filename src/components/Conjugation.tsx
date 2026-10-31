import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import type { Item } from '../lib/deck'
import { speak, canSpeak } from '../lib/tts'
import { toRomaji } from '../lib/romaji'
import type { TypedResult } from '../lib/typing'
import { listenMult } from '../lib/rewards'
import { FORM_GROUPS, VERB_CLASS_LABEL, checkForm, conjKind, formTable, verbClass, type Conjugated, type FormGroup } from '../lib/conjugate'
import { CONJ_ROUND, CONJ_XP, CONJ_PERFECT, drillPool, pickDrill, type ConjReward, type ConjSrc, type ConjWords, type DrillQ } from '../lib/conjdrill'
import { Sheet, Icon } from './ui'
import { Challenges, ComboBadge, RewardBreakdown, XpPop } from './Rewards'

/** « verbe en う (godan) », « adjectif en い »… */
export function wordKindLabel(it: Item): string {
  const k = conjKind(it)
  if (k === 'i') return 'adjectif en い'
  if (k === 'na') return 'adjectif en な'
  const c = verbClass(it)
  return c ? VERB_CLASS_LABEL[c] : ''
}

/** Le mot à conjuguer et la forme demandée. */
function FormAsk({ it, c, compact }: { it: Item; c: Conjugated; compact?: boolean }) {
  return (
    <>
      <div className="jp" style={{ fontSize: compact ? 34 : 40, fontWeight: 700, lineHeight: 1.15 }}>{it.jp}</div>
      {it.kana !== it.jp && <div className="kana-line jp">{it.kana}</div>}
      <div className="muted small">{it.fr}</div>
      <div className="form-ask">
        <span className="form-arrow">↓</span>
        <span className="form-name jp">{c.form.name}</span>
        <span className="form-fr">{c.form.fr}</span>
        <span className="chip tnum">{c.form.lvl}</span>
      </div>
    </>
  )
}

function FormAnswer({ it, c, typed }: { it: Item; c: Conjugated; typed: TypedResult | null }) {
  return (
    <>
      {typed && typed.script !== 'vide' && (
        <div className={'typed-result ' + (typed.ok ? 'good' : 'bad')}>
          {typed.ok ? '✓ Bonne réponse' : '✗ Pas tout à fait'}
          {!typed.ok && <span>Tu as écrit : <b className="jp">{typed.input}</b></span>}
        </div>
      )}
      <div className="muted small jp">{it.jp} · {c.form.name}</div>
      <div className="jp" style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', lineHeight: 1.2 }}>{c.jp}</div>
      {c.kana !== c.jp && <div className="kana-line jp">{c.kana}</div>}
      <div className="romaji-line">{toRomaji(c.kana)}</div>
      {c.altJp.length > 0 && <div className="muted small">Aussi accepté : <span className="jp">{c.altJp.join(' · ')}</span></div>}
      <div className="muted small">{c.form.fr} · {wordKindLabel(it)}</div>
    </>
  )
}

/** v1.14 — recto d'une carte de forme (révisions). */
export function FormFront({ it, c }: { it: Item; c: Conjugated }) {
  return (
    <div className="face front">
      <span className="chip kind accent">{conjKind(it) === 'v' ? 'Forme du verbe' : 'Forme de l\'adjectif'}</span>
      <FormAsk it={it} c={c} />
    </div>
  )
}

/** v1.14 — verso d'une carte de forme. */
export function FormBack({ it, c, typed, extras }: { it: Item; c: Conjugated; typed: TypedResult | null; extras: JSX.Element }) {
  return (
    <div className="face back">
      {canSpeak() && (
        <button className="icon-btn speak" aria-label="Écouter" onClick={(e) => { e.stopPropagation(); void speak(c.kana) }}>{Icon.speaker()}</button>
      )}
      <FormAnswer it={it} c={c} typed={typed} />
      {extras}
    </div>
  )
}

/** Toutes les formes d'un mot, rangées par groupe. */
export function FormsSheet({ open, onClose, word }: { open: boolean; onClose: () => void; word: Item }) {
  const rows = useMemo(() => (open ? formTable(word) : []), [open, word])
  const groups = FORM_GROUPS.filter((g) => rows.some((r) => r.form.group === g.id))
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <h2 className="jp" style={{ margin: 0, fontSize: 28 }}>{word.jp}</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>{word.kana !== word.jp ? `${word.kana} · ` : ''}{word.fr} · {wordKindLabel(word)}</p>
        </div>
        {groups.map((g) => (
          <div key={g.id}>
            <div className="free-sec">{g.label}</div>
            <div className="list">
              {rows.filter((r) => r.form.group === g.id).map((r) => (
                <button key={r.form.id} className="list-row tap form-row" onClick={() => canSpeak() && void speak(r.kana)}>
                  <div className="grow">
                    <div className="jp" style={{ fontWeight: 700, fontSize: 18 }}>{r.jp}</div>
                    <div className="muted small">{r.kana !== r.jp ? <span className="jp">{r.kana} · </span> : null}{r.form.name === r.form.fr ? r.form.fr : `${r.form.name} — ${r.form.fr}`}</div>
                  </div>
                  <span className="chip tnum">{r.form.lvl}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {canSpeak() && <p className="muted small" style={{ margin: 0 }}>Touche une forme pour l'écouter.</p>}
      </div>
    </Sheet>
  )
}

const ALL_VERB_GROUPS: FormGroup[] = ['base', 'envie', 'pot', 'don']

/**
 * v1.14 — Entraînement « Conjugaison » (Réviser librement) : 10 questions, tu écris la forme demandée.
 * XP comme l'écoute (combo jusqu'à ×1,6), sans effet sur le planning.
 */
export function Conjugation({ open, onClose, back }: { open: boolean; onClose: () => void; back?: { label: string; onBack: () => void } }) {
  const { state, items, recordConj } = useStore()
  const [words, setWords] = useState<ConjWords>('v')
  const [groups, setGroups] = useState<FormGroup[]>(['base'])
  const [src, setSrc] = useState<ConjSrc>('known')
  const [qs, setQs] = useState<DrillQ[] | null>(null)
  const [i, setI] = useState(0)
  const [draft, setDraft] = useState('')
  const [typed, setTyped] = useState<TypedResult | null>(null)
  const [results, setResults] = useState<boolean[]>([])
  const [combo, setCombo] = useState(0)
  const [pop, setPop] = useState({ id: 0, xp: 0 })
  const [reward, setReward] = useState<ConjReward | null>(null)
  const [table, setTable] = useState<Item | null>(null)
  const t0 = useRef(0)

  const pool = useMemo(() => (open ? drillPool(state, items, words, src) : []), [open, state.cards, items, words, src]) // eslint-disable-line
  const effGroups: FormGroup[] = words === 'adj' ? ['adj'] : words === 'both' ? [...groups, 'adj'] : groups
  const reset = () => {
    setQs(null)
    setI(0)
    setDraft('')
    setTyped(null)
    setResults([])
    setCombo(0)
    setReward(null)
  }
  useEffect(() => {
    if (!open) reset()
  }, [open])

  const start = () => {
    reset()
    t0.current = Date.now()
    setQs(pickDrill(pool, effGroups))
  }
  const q = qs?.[i]
  const done = !!qs && i >= qs.length
  const score = results.filter(Boolean).length

  const check = () => {
    if (!q || typed) return
    const r = checkForm(q.c, draft)
    setTyped(r)
    const ok = r.ok
    const nc = ok ? combo + 1 : 0
    setCombo(nc)
    if (ok) setPop({ id: pop.id + 1, xp: Math.round(CONJ_XP * listenMult(nc)) })
    setResults([...results, ok])
    if (canSpeak()) void speak(q.c.kana)
  }
  const next = () => {
    setTyped(null)
    setDraft('')
    setI(i + 1)
  }
  useEffect(() => {
    if (done && qs && qs.length && !reward) setReward(recordConj({ results, sec: (Date.now() - t0.current) / 1000 }))
  }, [done]) // eslint-disable-line

  const toggle = (g: FormGroup) => setGroups(groups.includes(g) ? (groups.length > 1 ? groups.filter((x) => x !== g) : groups) : [...groups, g])

  return (
    <Sheet open={open} onClose={onClose} back={back}>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Conjugaison 🔀</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Un mot, une forme : tu l'écris. Ça ne change pas ton planning de révision.</p>
        </div>

        {!qs && (
          <>
            <div>
              <div className="free-sec">Mots</div>
              <div className="seg">
                <button className={words === 'v' ? 'on' : ''} onClick={() => setWords('v')}>Verbes</button>
                <button className={words === 'adj' ? 'on' : ''} onClick={() => setWords('adj')}>Adjectifs</button>
                <button className={words === 'both' ? 'on' : ''} onClick={() => setWords('both')}>Les deux</button>
              </div>
            </div>
            {words !== 'adj' && (
              <div>
                <div className="free-sec">Formes des verbes</div>
                <div className="stack" style={{ gap: 8 }}>
                  {FORM_GROUPS.filter((g) => ALL_VERB_GROUPS.includes(g.id)).map((g) => (
                    <button key={g.id} className={'mode-opt' + (groups.includes(g.id) ? ' on' : '')} onClick={() => toggle(g.id)}>
                      <div><div className="t">{g.label}</div><div className="d jp">{g.sub}</div></div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="free-sec">Parmi</div>
              <div className="seg">
                <button className={src === 'known' ? 'on' : ''} onClick={() => setSrc('known')}>Mes mots</button>
                <button className={src === 'all' ? 'on' : ''} onClick={() => setSrc('all')}>Tous les mots</button>
              </div>
            </div>
            <div className="listen-gain">
              <span>⚡ <b>{CONJ_XP} XP</b> par forme juste</span>
              <span>🔥 combo jusqu'à <b>×1,6</b></span>
              <span>💯 <b>+{CONJ_PERFECT} XP</b> si 10/10</span>
            </div>
            <p className="muted small" style={{ margin: 0 }}>Écris en kana, en kanji ou en rōmaji. Les formes courtes de l'oral sont acceptées aussi (食べてる pour 食べている).</p>
            <button className="btn block" disabled={pool.length === 0} style={pool.length === 0 ? { opacity: 0.45 } : undefined} onClick={start}>
              {pool.length === 0 ? 'Aucun mot pour l\'instant' : `Commencer · ${CONJ_ROUND} formes`}
            </button>
          </>
        )}

        {qs && !done && q && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="row spread small muted" style={{ alignItems: 'center', minHeight: 28 }}>
              <span>Forme {i + 1} / {qs.length}</span>
              <span className="row" style={{ gap: 8, position: 'relative' }}>
                <ComboBadge combo={combo} mult={listenMult(combo)} />
                <span className="tnum">{score} juste{score > 1 ? 's' : ''}</span>
                <XpPop id={pop.id} xp={pop.xp} />
              </span>
            </div>
            <div className="bar thin"><i style={{ width: `${(i / qs.length) * 100}%` }} /></div>
            <div className="oral-card conj-card">
              {typed ? <FormAnswer it={q.word} c={q.c} typed={typed} /> : <FormAsk it={q.word} c={q.c} compact />}
            </div>
            {!typed ? (
              <form className="typing-form" onSubmit={(e) => { e.preventDefault(); check() }}>
                <input
                  key={i}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="La forme, en kana ou en rōmaji"
                  autoFocus
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  aria-label="La forme demandée"
                />
                <button className="btn" type="submit">Vérifier</button>
                <button className="known-btn" type="button" onClick={check}>Je ne sais pas — voir la réponse</button>
              </form>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                <button className="btn block" autoFocus onClick={next}>{i + 1 < qs.length ? 'Suivant' : 'Voir le bilan'}</button>
                <button className="btn plain block" onClick={() => setTable(q.word)}>📖 Toutes les formes de {q.word.jp}</button>
              </div>
            )}
          </div>
        )}

        {qs && qs.length === 0 && (
          <p className="muted">Pas de forme à proposer avec ces choix. Essaie « Tous les mots » ou un autre groupe.</p>
        )}

        {qs && done && qs.length > 0 && (
          <div className="summary listen-end" style={{ paddingTop: 8 }}>
            <motion.div className="emoji" initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
              {score === qs.length ? '🏆' : score >= 8 ? '🔀' : score >= 5 ? '💪' : '🌱'}
            </motion.div>
            {score === qs.length && qs.length >= CONJ_ROUND && (
              <motion.div className="perfect-tag" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}>PARFAIT</motion.div>
            )}
            <motion.h2 style={{ margin: 0, fontSize: 30 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{score} / {qs.length}</motion.h2>
            <p className="muted" style={{ margin: 0 }}>
              {score === qs.length ? 'Toutes les formes justes, bravo !' : score >= 7 ? 'Belle série de formes.' : 'Les formes rentrent à force de les écrire : continue.'}
            </p>
            <div className="dots">
              {results.map((ok, k) => (
                <motion.i key={k} className={ok ? 'ok' : 'ko'} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.05 * k }} />
              ))}
            </div>
            {reward && <RewardBreakdown reward={reward} per={CONJ_XP} done={['🔀', 'Conjugaison terminée']} />}
            <div style={{ width: '100%', textAlign: 'left' }}><Challenges compact /></div>
            <button className="btn block" style={{ marginTop: 6 }} onClick={start}>Rejouer</button>
            <button className="btn plain block" onClick={reset}>Changer les formes</button>
          </div>
        )}
      </div>
      {table && <FormsSheet open={!!table} onClose={() => setTable(null)} word={table} />}
    </Sheet>
  )
}
