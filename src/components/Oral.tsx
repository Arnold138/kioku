import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import type { Item } from '../lib/deck'
import { POS_LABEL } from '../lib/deck'
import { speak, canSpeak, stopSpeaking } from '../lib/tts'
import { canRecognize, canRecord, playUrl, recognizeJa, startRecording, RECOGNIZE_MSG, type Listening as RecListening, type Recording, type RecognizeError } from '../lib/mic'
import { ORAL_ROUND, ORAL_XP_PER, checkSpoken, pickOral, type OralMode, type OralReward, type OralSrc } from '../lib/oral'
import { listenMult } from '../lib/rewards'
import { Sheet } from './ui'
import { Challenges, ComboBadge, RewardBreakdown, XpPop } from './Rewards'

/** XP affiché en direct pour la n-ième réussite d'affilée. */
const liveXp = (mode: OralMode, combo: number) => Math.round(ORAL_XP_PER[mode] * listenMult(combo))

// ───────────────────────── Shadowing : écoute → répète → compare ─────────────────────────
function ShadowStep({ item, onDone }: { item: Item; onDone: (ok: boolean) => void }) {
  const [phase, setPhase] = useState<'idle' | 'rec' | 'done'>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const recRef = useRef<Recording | null>(null)
  const recordOk = canRecord()
  const text = item.kana || item.jp

  // nouvelle carte : on lit le modèle, et on libère l'enregistrement précédent
  useEffect(() => {
    void speak(text)
    return () => {
      recRef.current?.cancel()
      stopSpeaking()
    }
  }, [item.id]) // eslint-disable-line
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const record = async () => {
    setErr('')
    stopSpeaking()
    try {
      recRef.current = await startRecording(15_000, () => void stop())
      setPhase('rec')
    } catch {
      setErr('Kioku n\'a pas accès au micro. Autorise-le dans les réglages de l\'iPhone (Safari → Micro), ou répète simplement à voix haute.')
    }
  }
  const stop = async () => {
    const r = recRef.current
    recRef.current = null
    if (!r) return
    const u = await r.stop()
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return u
    })
    setPhase('done')
  }
  /** Le modèle puis ton essai, l'un après l'autre : c'est là qu'on entend la différence. */
  const compare = async () => {
    if (!url || busy) return
    setBusy(true)
    await speak(text)
    await new Promise((r) => setTimeout(r, 250))
    await playUrl(url)
    setBusy(false)
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="oral-card">
        <div className={'jp oral-jp' + (item.jp.length > 9 ? ' long' : '')}>{item.jp}</div>
        {item.kana && item.kana !== item.jp && <div className="kana-line jp">{item.kana.replace(/\s+/g, ' ')}</div>}
        <div className="romaji-line">{item.romaji}</div>
        <div className="muted small" style={{ marginTop: 4 }}>{item.fr}</div>
      </div>

      <div className="oral-steps">
        <button className="chip btn-chip" onClick={() => void speak(text)}>▶ Écouter</button>
        <button className="chip btn-chip" onClick={() => void speak(text, 0.55)}>🐢 Plus lent</button>
      </div>

      {recordOk ? (
        <div className="mic-zone">
          {phase === 'rec' ? (
            <button className="mic-btn rec" onClick={() => void stop()} aria-label="Arrêter l'enregistrement"><span className="mic-sq" /></button>
          ) : (
            <button className="mic-btn" onClick={() => void record()} aria-label="Enregistrer">🎙️</button>
          )}
          <div className="mic-label">{phase === 'rec' ? 'Je t\'écoute… appuie pour arrêter' : phase === 'done' ? 'Refaire un essai' : 'À toi : répète en imitant la voix'}</div>
          {phase === 'done' && url && (
            <div className="oral-steps">
              <button className="chip btn-chip" disabled={busy} onClick={() => void playUrl(url)}>🗣️ Mon essai</button>
              <button className="chip btn-chip accent-chip" disabled={busy} onClick={() => void compare()}>⇄ Modèle puis moi</button>
            </div>
          )}
        </div>
      ) : (
        <div className="typed-result" style={{ alignItems: 'flex-start' }}>L'enregistrement n'est pas disponible ici : répète à voix haute juste après la voix, en imitant le rythme et la mélodie.</div>
      )}
      {err && <div className="typed-result bad" style={{ alignItems: 'flex-start' }}>{err}</div>}

      <div className="oral-rate">
        <button className="btn plain" disabled={phase === 'rec'} onClick={() => onDone(false)}>À retravailler</button>
        <button className="btn" disabled={phase === 'rec'} onClick={() => onDone(true)}>Comme le modèle ✓</button>
      </div>
    </div>
  )
}

// ───────────────────────── Production orale : tu vois le sens, tu dis le mot ─────────────────────────
function SpeakStep({ item, onDone }: { item: Item; onDone: (ok: boolean) => void }) {
  type Phase = 'ask' | 'listening' | 'result'
  const [phase, setPhase] = useState<Phase>('ask')
  const [ok, setOk] = useState<boolean | null>(null)
  const [heard, setHeard] = useState('')
  const [err, setErr] = useState<RecognizeError | null>(null)
  const [tries, setTries] = useState(0)
  const lis = useRef<RecListening | null>(null)
  const recog = canRecognize()

  useEffect(() => () => lis.current?.abort(), [item.id])

  const listen = async () => {
    setErr(null)
    stopSpeaking()
    const l = recognizeJa()
    lis.current = l
    setPhase('listening')
    try {
      const alts = await l.result
      const c = checkSpoken(item, alts)
      setHeard(c.heard)
      setOk((prev) => prev || c.ok) // une bonne réponse reste bonne si tu réessaies pour le plaisir
      setTries((n) => n + 1)
      setPhase('result')
      if (c.ok) void speak(item.kana || item.jp)
    } catch (e) {
      const code = (typeof e === 'string' ? e : 'other') as RecognizeError
      setErr(code)
      // pas de micro / pas de reconnaissance : on passe en vérification « à la main »
      setPhase(code === 'no-speech' || code === 'aborted' ? 'ask' : 'result')
    } finally {
      lis.current = null
    }
  }
  const reveal = (asWrong: boolean) => {
    if (asWrong) setOk(false)
    setPhase('result')
    void speak(item.kana || item.jp)
  }
  const manual = phase === 'result' && ok === null // résultat sans verdict du téléphone

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="oral-card">
        <span className="chip accent">Dis-le en japonais</span>
        <div className={'oral-fr' + (item.fr.length > 22 ? ' long' : '')}>{item.fr}</div>
        {item.kind === 'word' && <span className="chip">{POS_LABEL[item.pos] ?? item.pos}</span>}
      </div>

      {phase !== 'result' && (
        <div className="mic-zone">
          {recog ? (
            <>
              <button className={'mic-btn' + (phase === 'listening' ? ' rec' : '')} onClick={() => (phase === 'listening' ? lis.current?.stop() : void listen())} aria-label={phase === 'listening' ? 'Terminer' : 'Parler'}>
                {phase === 'listening' ? <span className="mic-sq" /> : '🎙️'}
              </button>
              <div className="mic-label">{phase === 'listening' ? 'J\'écoute… dis le mot' : 'Appuie, puis dis le mot à voix haute'}</div>
            </>
          ) : (
            <div className="typed-result" style={{ alignItems: 'flex-start' }}>{RECOGNIZE_MSG.unsupported}</div>
          )}
          {err && <div className="muted small" style={{ textAlign: 'center' }}>{RECOGNIZE_MSG[err]}</div>}
          <div className="oral-steps">
            {!recog && <button className="btn" onClick={() => reveal(false)}>Je l'ai dit · voir la réponse</button>}
            <button className="known-btn" onClick={() => reveal(true)}>Je ne sais pas — voir la réponse</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {phase === 'result' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="stack" style={{ gap: 10 }}>
            {ok !== null && (
              <div className={'typed-result ' + (ok ? 'good' : 'bad')}>
                {ok ? '✓ Bien dit !' : tries ? '✗ Pas reconnu' : '✗ Pas cette fois'}
                {heard && <span>Le téléphone a compris : <b className="jp">{heard}</b></span>}
              </div>
            )}
            {err && ok === null && <div className="muted small">{RECOGNIZE_MSG[err]}</div>}
            <div className="listen-answer">
              <div className="jp" style={{ fontSize: 28, fontWeight: 700 }}>{item.jp}</div>
              {item.kana !== item.jp && <div className="kana-line jp">{item.kana}</div>}
              <div className="romaji-line">{item.romaji}</div>
              {canSpeak() && <button className="chip btn-chip" style={{ marginTop: 6 }} onClick={() => void speak(item.kana || item.jp)}>🔊 Écouter</button>}
            </div>
            {manual ? (
              <div className="oral-rate">
                <button className="btn plain" onClick={() => onDone(false)}>Raté</button>
                <button className="btn" onClick={() => onDone(true)}>Je l'avais ✓</button>
              </div>
            ) : ok ? (
              <button className="btn block" onClick={() => onDone(true)}>Suivant</button>
            ) : (
              <>
                <div className="oral-rate">
                  {recog && tries > 0 && tries < 3 && <button className="btn plain" onClick={() => { setPhase('ask'); setHeard('') }}>🎙️ Réessayer</button>}
                  <button className="btn" onClick={() => onDone(false)}>Suivant</button>
                </div>
                {tries > 0 && <button className="known-btn" onClick={() => onDone(true)}>En fait, je l'ai bien dit (le téléphone s'est trompé)</button>}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ───────────────────────── Page « Oral » ─────────────────────────
export function Oral({ open, onClose, back }: { open: boolean; onClose: () => void; back?: { label: string; onBack: () => void } }) {
  const { items, state, recordOral } = useStore()
  const [mode, setMode] = useState<OralMode>('h')
  const [src, setSrc] = useState<OralSrc>('sentences')
  const [qs, setQs] = useState<Item[] | null>(null)
  const [i, setI] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [combo, setCombo] = useState(0)
  const [pop, setPop] = useState({ id: 0, xp: 0 })
  const [reward, setReward] = useState<OralReward | null>(null)
  const startRef = useRef(0)
  const savedRef = useRef(false)

  const reset = () => {
    setQs(null)
    setI(0)
    setResults([])
    setCombo(0)
    setPop({ id: 0, xp: 0 })
    setReward(null)
    savedRef.current = false
    stopSpeaking()
  }
  useEffect(() => {
    if (!open) reset()
  }, [open])

  const done = !!qs && i >= qs.length
  useEffect(() => {
    if (done && qs && !savedRef.current) {
      savedRef.current = true
      setReward(recordOral({ mode, results, sec: (Date.now() - startRef.current) / 1000 }))
    }
  }, [done]) // eslint-disable-line

  const start = () => {
    const list = pickOral(items, state.cards, mode, src)
    reset()
    startRef.current = Date.now()
    setQs(list)
  }
  const answer = (ok: boolean) => {
    setResults((r) => [...r, ok])
    if (ok) {
      const c = combo + 1
      setCombo(c)
      setPop((p) => ({ id: p.id + 1, xp: liveXp(mode, c) }))
    } else {
      setCombo(0)
      setPop((p) => ({ id: p.id + 1, xp: 0 }))
    }
    setI((n) => n + 1)
  }

  const score = results.filter(Boolean).length
  const q = qs?.[i]

  return (
    <Sheet open={open} onClose={onClose} back={back}>
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Oral 🗣️</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Parler, c'est ce qui fixe le mieux. Ça ne change pas ton planning de révision.</p>
        </div>

        {!qs && (
          <>
            <div>
              <div className="free-sec">Exercice</div>
              <div className="stack" style={{ gap: 8 }}>
                <button className={'mode-opt' + (mode === 'h' ? ' on' : '')} onClick={() => setMode('h')}>
                  <div><div className="t">Shadowing</div><div className="d">Tu écoutes, tu répètes en imitant, tu compares ta voix au modèle</div></div>
                </button>
                <button className={'mode-opt' + (mode === 'v' ? ' on' : '')} onClick={() => setMode('v')}>
                  <div><div className="t">Production orale</div><div className="d">Tu vois le sens en français, tu dis le mot en japonais : le téléphone vérifie</div></div>
                </button>
              </div>
            </div>
            {mode === 'h' && (
              <div>
                <div className="free-sec">Ce que je répète</div>
                <div className="seg">
                  <button className={src === 'words' ? 'on' : ''} onClick={() => setSrc('words')}>Des mots</button>
                  <button className={src === 'sentences' ? 'on' : ''} onClick={() => setSrc('sentences')}>Des phrases</button>
                </div>
              </div>
            )}
            <div className="listen-gain">
              <span>⚡ <b>{ORAL_XP_PER[mode]} XP</b> par réussite</span>
              <span>🔥 combo jusqu'à <b>×1,6</b></span>
              <span>💯 <b>+50 XP</b> si 10/10</span>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              {mode === 'h'
                ? '🎧 Avec des écouteurs, c\'est encore mieux. Imite tout : le rythme, la mélodie, les pauses — pas seulement les sons.'
                : canRecognize()
                  ? '🎙️ Le micro est demandé la première fois. Dis la forme du dictionnaire (食べる, pas 食べます).'
                  : 'La reconnaissance vocale n\'est pas disponible ici : tu diras le mot à voix haute, puis tu vérifieras toi-même.'}
            </p>
            <button className="btn block" onClick={start}>Commencer · {ORAL_ROUND} {mode === 'v' || src === 'words' ? 'mots' : 'phrases'}</button>
          </>
        )}

        {qs && !done && q && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="row spread small muted" style={{ alignItems: 'center', minHeight: 28 }}>
              <span>{mode === 'h' ? 'Phrase' : 'Mot'} {i + 1} / {qs.length}</span>
              <span className="row" style={{ gap: 8, position: 'relative' }}>
                <ComboBadge combo={combo} mult={listenMult(combo)} />
                <span className="tnum">{score} réussi{score > 1 ? 's' : ''}</span>
                <XpPop id={pop.id} xp={pop.xp} />
              </span>
            </div>
            <div className="bar thin"><i style={{ width: `${(i / qs.length) * 100}%` }} /></div>
            {mode === 'h' ? <ShadowStep key={q.id} item={q} onDone={answer} /> : <SpeakStep key={q.id} item={q} onDone={answer} />}
          </div>
        )}

        {qs && done && (
          <div className="summary listen-end" style={{ paddingTop: 8 }}>
            <motion.div className="emoji" initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
              {score === qs.length ? '🏆' : score >= 8 ? '🗣️' : score >= 5 ? '💬' : '🌱'}
            </motion.div>
            {score === qs.length && qs.length >= ORAL_ROUND && (
              <motion.div className="perfect-tag" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}>PARFAIT</motion.div>
            )}
            <motion.h2 style={{ margin: 0, fontSize: 30 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{score} / {qs.length}</motion.h2>
            <p className="muted" style={{ margin: 0 }}>
              {score === qs.length ? 'Ta bouche suit ton oreille, bravo !' : score >= 7 ? 'Belle séance d\'oral.' : 'Continue : c\'est en parlant qu\'on prend l\'habitude.'}
            </p>
            <div className="dots">
              {results.map((ok, k) => (
                <motion.i key={k} className={ok ? 'ok' : 'ko'} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.05 * k }} />
              ))}
            </div>
            {reward && <RewardBreakdown reward={reward} per={ORAL_XP_PER[mode]} done={['🗣️', 'Exercice oral terminé']} />}
            <div style={{ width: '100%', textAlign: 'left' }}><Challenges compact /></div>
            <button className="btn block" style={{ marginTop: 6 }} onClick={start}>Rejouer</button>
            <button className="btn plain block" onClick={reset}>Changer d'exercice</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
