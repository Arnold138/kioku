import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Item } from '../lib/deck'
import type { Rating } from '../lib/scheduler'
import { speak, canSpeak, stopSpeaking } from '../lib/tts'
import { canRecognize, recognizeJa, RECOGNIZE_MSG, type Listening, type RecognizeError } from '../lib/mic'
import {
  changeChoices, checkRecall, originalPart, rebuildPieces, stepsFor, suggestRating, variantPool, variantSentence,
  type BlockMode, type Piece, type RecallCheck, type SentenceBlocks, type Step,
} from '../lib/blocks'

const STEP_NAME: Record<Step, string> = { discover: 'Découvre', rebuild: 'Reconstruis', change: 'Change un bloc', recall: 'Dis-la de mémoire' }
const KEYBOARD = 'kioku:blocs:clavier' // préférence de l'appareil : écrire plutôt que parler

const readKb = () => { try { return localStorage.getItem(KEYBOARD) === '1' } catch { return false } }
const say = (t: string) => { if (canSpeak()) void speak(t) }

export interface BlockResult { rating: Rating; note: string }

/**
 * Recto d'une carte de phrase en blocs (v1.17). Nouvelle phrase : Découvre → Reconstruis → Change un bloc → Dis-la de mémoire.
 * En révision : Reconstruis (phrase récente) ou Dis-la de mémoire (phrase solide). À la fin, la carte se retourne avec une note proposée.
 */
export function BlockCard({ it, sb, mode, onDone }: { it: Item; sb: SentenceBlocks; mode: BlockMode; onDone: (r: BlockResult) => void }) {
  const steps = useMemo(() => stepsFor(mode, sb), [mode, sb])
  const [k, setK] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const step = steps[k]
  const next = () => setK((x) => Math.min(steps.length - 1, x + 1))
  const finish = (recall: RecallCheck | null, selfOk: boolean | null, gaveUp = false) => {
    const rating = suggestRating({ mode, mistakes, recall, selfOk, gaveUp })
    const note = gaveUp ? 'Pas trouvée cette fois' : recall ? (recall.ok ? 'Dite de mémoire ✓' : `${recall.hits.filter(Boolean).length} bloc${recall.hits.filter(Boolean).length > 1 ? 's' : ''} sur ${recall.hits.length}`)
      : selfOk != null ? (selfOk ? 'Dite de mémoire ✓' : 'À revoir') : mistakes ? `Reconstruite avec ${mistakes} erreur${mistakes > 1 ? 's' : ''}` : 'Reconstruite sans erreur ✓'
    onDone({ rating, note })
  }

  return (
    <div className="face front blk-face" onClick={(e) => e.stopPropagation()}>
      <div className="blk-head">
        <span className="chip kind accent">{STEP_NAME[step]}</span>
        {steps.length > 1 && (
          <span className="blk-dots" aria-label={`Étape ${k + 1} sur ${steps.length}`}>
            {steps.map((s, i) => <i key={s} className={i < k ? 'done' : i === k ? 'on' : ''} />)}
          </span>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} className="blk-body" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          {step === 'discover' && <Discover it={it} sb={sb} onNext={next} />}
          {step === 'rebuild' && (
            <Rebuild it={it} sb={sb} decoy={mode !== 'learn'} onMistake={() => setMistakes((m) => m + 1)}
              onNext={k === steps.length - 1 ? () => finish(null, null) : next} last={k === steps.length - 1} onGiveUp={() => finish(null, null, true)} />
          )}
          {step === 'change' && <Change id={it.id} sb={sb} onMistake={() => setMistakes((m) => m + 1)} onNext={next} />}
          {step === 'recall' && <Recall it={it} sb={sb} onDone={finish} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Chip({ b, onClick, dim, cls = '' }: { b: { jp: string; kana: string }; onClick?: () => void; dim?: boolean; cls?: string }) {
  return (
    <button type="button" className={'blk ' + cls + (dim ? ' dim' : '')} onClick={onClick} disabled={!onClick}>
      <span className="jp">{b.jp.replace(/[、。！？!?]$/, '')}</span>
      {b.kana && b.kana !== b.jp.replace(/[、。！？!?]$/, '') && <small className="jp">{b.kana}</small>}
    </button>
  )
}

function Discover({ it, sb, onNext }: { it: Item; sb: SentenceBlocks; onNext: () => void }) {
  return (
    <>
      <div className="blk-line">
        {sb.blocks.map((b, i) => <Chip key={i} b={b} onClick={() => say(b.kana)} />)}
      </div>
      <div className="meaning long">{it.fr}</div>
      <div className="hint">Touche un bloc pour l'écouter. Chaque bloc est un morceau qui a du sens.</div>
      <div className="blk-actions">
        {canSpeak() && <button type="button" className="btn plain" onClick={() => say(it.kana || it.jp)}>🔊 Toute la phrase</button>}
        <button type="button" className="btn" onClick={onNext}>Suivant</button>
      </div>
    </>
  )
}

function Rebuild({ it, sb, decoy, onMistake, onNext, onGiveUp, last }: { it: Item; sb: SentenceBlocks; decoy: boolean; onMistake: () => void; onNext: () => void; onGiveUp: () => void; last: boolean }) {
  const pieces = useMemo(() => rebuildPieces(sb, decoy), [sb, decoy])
  const [placed, setPlaced] = useState<Piece[]>([])
  const [shake, setShake] = useState<string | null>(null)
  const [errs, setErrs] = useState(0)
  const done = placed.length === sb.blocks.length
  const tap = (p: Piece) => {
    if (done || placed.includes(p)) return
    if (p.pos === placed.length || (p.pos >= 0 && sb.blocks[p.pos].jp === sb.blocks[placed.length].jp)) {
      const np = [...placed, p]
      setPlaced(np)
      if (np.length === sb.blocks.length) say(it.kana || it.jp)
      else say(p.kana)
    } else {
      setShake(p.key)
      setErrs((n) => n + 1)
      onMistake()
      window.setTimeout(() => setShake(null), 420)
    }
  }
  return (
    <>
      <div className="meaning long">{it.fr}</div>
      <div className={'blk-line slots' + (done ? ' ok' : '')}>
        {placed.map((p) => <Chip key={p.key} b={p} cls="in" />)}
        {!done && <span className="blk-slot" aria-hidden="true">？</span>}
      </div>
      {!done && <div className="blk-pool">
        {pieces.map((p) => (
          <motion.div key={p.key} animate={shake === p.key ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
            <Chip b={p} cls={placed.includes(p) ? 'used' : ''} onClick={placed.includes(p) || done ? undefined : () => tap(p)} />
          </motion.div>
        ))}
      </div>}
      {done ? (
        <div className="blk-actions">
          <div className={'typed-result ' + (errs ? 'tr close' : 'good')}>{errs ? `Reconstruite · ${errs} erreur${errs > 1 ? 's' : ''}` : '✓ Parfait !'}</div>
          <button type="button" className="btn" onClick={onNext}>{last ? 'Voir la carte' : 'Suivant'}</button>
        </div>
      ) : (
        <div className="blk-actions">
          <div className="hint">{decoy && pieces.length > sb.blocks.length ? 'Remets les blocs dans l\'ordre. Attention, un bloc est en trop.' : 'Remets les blocs dans l\'ordre.'}</div>
          {last && <button type="button" className="known-btn" onClick={onGiveUp}>Je ne sais pas — voir la réponse</button>}
        </div>
      )}
    </>
  )
}

function Change({ id, sb, onMistake, onNext }: { id: string; sb: SentenceBlocks; onMistake: () => void; onNext: () => void }) {
  const v = sb.variant!
  const choices = useMemo(() => changeChoices(sb, variantPool(id)), [sb, id])
  const orig = originalPart(sb)!
  const vs = variantSentence(sb)!
  const [picked, setPicked] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string[]>([])
  const pick = (c: { jp: string; ok: boolean }) => {
    if (picked) return
    if (c.ok) { setPicked(c.jp); say(vs.kana) } else { setWrong((w) => [...w, c.jp]); onMistake() }
  }
  return (
    <>
      <div className="hint">La même phrase, un bloc change :</div>
      <div className="meaning long">{v.fr}</div>
      <div className="blk-line">
        {sb.blocks.slice(0, v.i).map((b, i) => <Chip key={'a' + i} b={b} dim />)}
        {picked ? <Chip b={{ jp: v.jp, kana: v.kana }} cls="in new" /> : <span className="blk-slot wide" aria-label={`À la place de ${orig.jp}`}>？</span>}
        {sb.blocks.slice(v.j + 1).map((b, i) => <Chip key={'b' + i} b={b} dim />)}
      </div>
      <div className="blk-pool">
        {choices.map((c) => (
          <motion.div key={c.jp} animate={wrong.includes(c.jp) ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
            <button type="button" className={'blk choice' + (wrong.includes(c.jp) ? ' bad' : '') + (picked === c.jp ? ' in' : '')} disabled={!!picked || wrong.includes(c.jp)} onClick={() => pick(c)}>
              <span className="jp">{c.jp.replace(/[、。！？!?]$/, '')}</span>
            </button>
          </motion.div>
        ))}
      </div>
      <div className="blk-actions">
        {picked ? <button type="button" className="btn" onClick={onNext}>Suivant</button> : <div className="hint">Quel bloc faut-il mettre à la place de <b className="jp">{orig.jp.replace(/[、。！？!?]$/, '')}</b> ?</div>}
      </div>
    </>
  )
}

function Recall({ it, sb, onDone }: { it: Item; sb: SentenceBlocks; onDone: (r: RecallCheck | null, selfOk: boolean | null, gaveUp?: boolean) => void }) {
  const recog = canRecognize()
  const [kb, setKb] = useState(() => !recog || readKb())
  const [phase, setPhase] = useState<'ask' | 'listening' | 'result'>('ask')
  const [res, setRes] = useState<RecallCheck | null>(null)
  const [heard, setHeard] = useState('')
  const [err, setErr] = useState<RecognizeError | null>(null)
  const [draft, setDraft] = useState('')
  const lis = useRef<Listening | null>(null)
  useEffect(() => () => lis.current?.abort(), [])

  const toggleKb = () => {
    const v = !kb
    setKb(v)
    try { localStorage.setItem(KEYBOARD, v ? '1' : '0') } catch { /* sans importance */ }
  }
  const listen = async () => {
    setErr(null)
    stopSpeaking()
    const l = recognizeJa()
    lis.current = l
    setPhase('listening')
    try {
      const alts = await l.result
      const c = checkRecall(sb, alts)
      setHeard(alts[0] ?? '')
      setRes(c)
      setPhase('result')
      say(it.kana || it.jp)
    } catch (e) {
      const code = (typeof e === 'string' ? e : 'other') as RecognizeError
      setErr(code)
      setPhase('ask')
      if (code !== 'no-speech' && code !== 'aborted') setKb(true)
    } finally {
      lis.current = null
    }
  }
  const submit = () => {
    if (!draft.trim()) return
    const c = checkRecall(sb, [draft])
    setHeard(draft.trim())
    setRes(c)
    setPhase('result')
    say(it.kana || it.jp)
  }

  return (
    <>
      <div className="meaning long">{it.fr}</div>
      {phase !== 'result' ? (
        <>
          <div className="hint">Dis toute la phrase en japonais, sans regarder.</div>
          {kb ? (
            <form className="typing-form blk-form" onSubmit={(e) => { e.preventDefault(); submit() }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="kyou wa… / きょうは…" autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="go" aria-label="Ta phrase" />
              <button className="btn" type="submit">Vérifier</button>
            </form>
          ) : (
            <div className="mic-zone">
              <button type="button" className={'mic-btn' + (phase === 'listening' ? ' rec' : '')} onClick={() => (phase === 'listening' ? lis.current?.stop() : void listen())} aria-label={phase === 'listening' ? 'Terminer' : 'Parler'}>
                {phase === 'listening' ? <span className="mic-sq" /> : '🎙️'}
              </button>
              <div className="mic-label">{phase === 'listening' ? 'J\'écoute… dis la phrase' : 'Appuie, puis dis la phrase'}</div>
            </div>
          )}
          {err && <div className="muted small" style={{ textAlign: 'center' }}>{RECOGNIZE_MSG[err]}</div>}
          <div className="blk-actions">
            {recog && <button type="button" className="known-btn" onClick={toggleKb}>{kb ? '🎙️ Parler plutôt' : '⌨️ Écrire plutôt'}</button>}
            <button type="button" className="known-btn" onClick={() => onDone(null, null, true)}>Je ne sais pas — voir la réponse</button>
          </div>
        </>
      ) : res && (
        <>
          <div className={'typed-result ' + (res.ok ? 'good' : res.partial ? 'tr close' : 'bad')}>
            {res.ok ? '✓ Bien dit !' : res.partial ? '≈ En partie' : '✗ Pas encore'}
            {heard && <span>{kb ? 'Tu as écrit' : 'Le téléphone a compris'} : <b className="jp">{heard}</b></span>}
          </div>
          <div className="blk-line">
            {sb.blocks.map((b, i) => <Chip key={i} b={b} cls={res.hits[i] ? 'in' : 'miss'} onClick={() => say(b.kana)} />)}
          </div>
          <div className="blk-actions">
            {!res.ok && <button type="button" className="known-btn" onClick={() => onDone(null, true)}>En fait, je l'ai bien dite</button>}
            <button type="button" className="btn" onClick={() => onDone(res, null)}>Voir la carte</button>
          </div>
        </>
      )}
    </>
  )
}
