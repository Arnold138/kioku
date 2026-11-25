import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { parseCardId } from '../lib/deck'
import type { Rating } from '../lib/scheduler'
import { keepAwake, speak, speakFr, stopSpeaking } from '../lib/tts'
import { canRecognize, recognize, type Listening } from '../lib/mic'
import { carCommand } from '../lib/loop'
import { Icon } from './ui'

type Phase = 'q' | 'think' | 'a' | 'cmd' | 'wait'
const DOT: Record<Phase, string> = { q: 'parle', think: 'à toi', a: 'parle', cmd: 'bien · encore', wait: 'touche ✓ ou ✕' }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * v1.21 — Mode voiture : l'app dit le mot, te laisse répondre à voix haute, donne le sens,
 * puis écoute « bien » ou « encore ». Deux grosses touches si la voix ne passe pas.
 */
export function CarMode() {
  const { session: s, byId, reveal, rate, endSession, continueRound } = useStore()
  const [phase, setPhase] = useState<Phase>('q')
  const [shown, setShown] = useState(false)
  const key = s?.current ?? null
  const parsed = key ? parseCardId(key) : null
  const item = parsed ? byId.get(parsed.itemId) : undefined
  const prod = parsed?.dir === 'p'

  useEffect(() => {
    let release = () => {}
    void keepAwake().then((r) => (release = r))
    return () => release()
  }, [])

  useEffect(() => {
    if (!s || s.finished) return
    if (s.pause) {
      const t = setTimeout(continueRound, 900)
      return () => clearTimeout(t)
    }
    if (!item) return
    let alive = true
    let rec: Listening | null = null
    const run = async () => {
      setShown(false)
      setPhase('q')
      await wait(350)
      if (!alive) return
      await (prod ? speakFr(item.fr) : speak(item.kana || item.jp))
      if (!alive) return
      setPhase('think')
      await wait(item.kind === 'sentence' ? 6000 : 4000)
      if (!alive) return
      reveal()
      setShown(true)
      setPhase('a')
      await (prod ? speak(item.kana || item.jp) : speakFr(item.fr))
      if (!alive) return
      if (canRecognize()) {
        for (let i = 0; i < 3 && alive; i++) {
          setPhase('cmd')
          rec = recognize('fr-FR')
          try {
            const r = carCommand(await rec.result)
            if (r && alive) return void rate(r)
          } catch (e) {
            if (e === 'unsupported' || e === 'not-allowed') break
          }
        }
      }
      if (alive) setPhase('wait')
    }
    void run()
    return () => {
      alive = false
      rec?.abort()
      stopSpeaking()
    }
  }, [key, s?.answered, s?.pause, s?.finished]) // eslint-disable-line

  if (!s) return null
  const pct = s.total ? Math.min(1, s.done / s.total) : 1
  const answer = (r: Rating) => {
    stopSpeaking()
    reveal()
    rate(r)
  }
  const jpBox = item && (
    <div className={'nbox' + (item.kind === 'sentence' ? ' sent' : item.jp.length > 6 ? ' xs' : item.jp.length > 3 ? ' sm' : '')}>
      <span className="jp w">{item.jp}</span>
      {item.kana && item.kana !== item.jp && <span className="jp k">{item.kana}</span>}
    </div>
  )
  const live = phase === 'think' || phase === 'cmd'

  return (
    <motion.div className="study neon car-mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="lis-top">
        <button className="icon-btn" onClick={() => { stopSpeaking(); endSession() }} aria-label="Arrêter">{Icon.close()}</button>
        <span className="lis-t">Voiture</span>
        <span className="lis-left tnum">{Math.min(s.done + 1, s.total)} / {s.total}</span>
      </div>
      <div className="lis-stage">
        {s.pause ? (
          <div className="mean">Manche suivante…</div>
        ) : item ? (
          <>
            <div className="eyebrow">{prod ? 'dis-le en japonais' : item.kind === 'sentence' ? 'phrase' : 'mot'}</div>
            {prod ? (shown ? jpBox : <div className="mean">{item.fr}</div>) : jpBox}
            <div className="mean" style={{ visibility: shown && !prod ? 'visible' : 'hidden' }}>{item.fr}</div>
            <div className={'dot' + (live ? ' live' : '')}><i />{DOT[phase]}</div>
          </>
        ) : null}
      </div>
      <div className="lis-bar"><i style={{ width: `${pct * 100}%` }} /></div>
      <div className="ctrls2 car2">
        <button className="c2 big2 no" onClick={() => answer(1)} aria-label="Encore" disabled={!item || s.pause}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <button className="c2 big2 ok" onClick={() => answer(4)} aria-label="Bien" disabled={!item || s.pause}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        </button>
      </div>
      <p className="car-help">Dis « bien », « facile », « encore » ou « difficile ».</p>
    </motion.div>
  )
}
