import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { dayNumber } from '../lib/scheduler'
import { LOOP_DURATIONS, LOOP_FORMATS, LOOP_GAPS, buildLoop, loadLoopPrefs, saveLoopPrefs } from '../lib/loop'
import { keepAwake, speak, speakFr, stopSpeaking, unlockSpeech } from '../lib/tts'
import { Icon } from './ui'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
const fit = (jp: string) => (jp.length <= 3 ? 56 : jp.length <= 6 ? 40 : jp.length <= 10 ? 28 : 22)

/**
 * v1.21 — Écoute en boucle, comme un lecteur de musique : le japonais, un décompte pour réfléchir,
 * puis la traduction, et ça passe au suivant tout seul. Rien n'est noté.
 */
export function LoopPlayer() {
  const { state, items, setLoop } = useStore()
  const [prefs, setPrefs] = useState(loadLoopPrefs)
  const list = useMemo(() => buildLoop(state.cards, items, dayNumber(Date.now()), 90, prefs.fmt), [prefs.fmt]) // eslint-disable-line
  const [draft, setDraft] = useState(prefs)
  const [setup, setSetup] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [idx, setIdx] = useState(0)
  const [left, setLeft] = useState(prefs.dur * 60)
  const [cd, setCd] = useState<number | null>(null)
  const [showFr, setShowFr] = useState(false)
  const cur = list.length ? list[idx % list.length] : null

  useEffect(() => {
    let release = () => {}
    void keepAwake().then((r) => (release = r))
    return () => {
      release()
      stopSpeaking()
    }
  }, [])

  // une carte : japonais → décompte → traduction → la suivante
  // (`replay` relance la même carte quand on touche « précédent » sur la première)
  const [replay, setReplay] = useState(0)
  const nav = useRef(false) // vrai juste après un appui sur précédent / suivant
  useEffect(() => {
    setShowFr(false)
    setCd(null)
    if (!cur) return
    let alive = true
    const touched = nav.current
    nav.current = false
    const run = async () => {
      // v1.22 : petite pause après l'arrêt du son précédent (sur iPhone, relancer la voix tout de suite peut échouer en silence)
      await wait(180)
      if (!alive) return
      if (!playing) {
        if (touched) void speak(cur.it.kana || cur.it.jp) // en pause : on fait juste entendre le mot choisi
        return
      }
      await speak(cur.it.kana || cur.it.jp)
      for (let n = prefs.gap; n > 0; n--) {
        if (!alive) return
        setCd(n)
        await wait(1000)
      }
      if (!alive) return
      setCd(null)
      setShowFr(true)
      await speakFr(cur.it.fr)
      await wait(1500)
      if (alive) setIdx((i) => (i + 1) % list.length)
    }
    void run()
    return () => {
      alive = false
      stopSpeaking()
    }
  }, [playing, idx, prefs.gap, replay, list]) // eslint-disable-line

  // le temps qui reste
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => clearInterval(t)
  }, [playing])
  useEffect(() => {
    if (left === 0) setPlaying(false)
  }, [left])

  const play = () => {
    unlockSpeech()
    if (!playing && left === 0) setLeft(prefs.dur * 60)
    setPlaying((p) => !p)
  }
  // v1.22 : « précédent » revient au mot d'avant et le relit (sur la première carte : la relit)
  const go = (d: number) => {
    if (!list.length) return
    unlockSpeech()
    nav.current = true
    if (!(d < 0 && idx === 0)) setIdx((i) => (i + d + list.length) % list.length)
    setReplay((n) => n + 1)
  }
  const start = () => {
    unlockSpeech()
    saveLoopPrefs(draft)
    if (draft.fmt !== prefs.fmt) setIdx(0)
    setPrefs(draft)
    setLeft(draft.dur * 60)
    setSetup(false)
    setPlaying(true)
  }
  const total = prefs.dur * 60

  return (
    <motion.div className="study neon loop" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
      <div className="lis-top">
        <button className="icon-btn" onClick={() => setLoop(false)} aria-label="Fermer">{Icon.close()}</button>
        <span className="lis-t">Écoute en boucle</span>
        <span className="lis-left tnum">{fmt(left)}</span>
        <button className="lis-plus" onClick={() => { setDraft(prefs); setSetup((o) => !o); setPlaying(false) }} aria-label="Réglages de l'écoute" aria-expanded={setup}>＋</button>
      </div>
      {setup ? (
        <div className="loop-setup">
          <div className="opt">
            <span>Format<small>de l'écoute</small></span>
            <div className="seg">{LOOP_FORMATS.map((f) => <button key={f.id} aria-pressed={draft.fmt === f.id} onClick={() => setDraft({ ...draft, fmt: f.id })}>{f.label}</button>)}</div>
          </div>
          <div className="opt">
            <span>Durée<small>de l'écoute</small></span>
            <div className="seg">{LOOP_DURATIONS.map((d) => <button key={d} aria-pressed={draft.dur === d} onClick={() => setDraft({ ...draft, dur: d })}>{d} min</button>)}</div>
          </div>
          <div className="opt">
            <span>Temps pour réfléchir<small>avant la traduction</small></span>
            <div className="seg">{LOOP_GAPS.map((g) => <button key={g} aria-pressed={draft.gap === g} onClick={() => setDraft({ ...draft, gap: g })}>{g} s</button>)}</div>
          </div>
          <button className="pill-btn" onClick={start}>C'est parti</button>
        </div>
      ) : (
        <div className="lis-stage">
          {cur ? (
            <>
              <div className="eyebrow">{cur.label}</div>
              <div className="nbox loop-box">
                <span className="jp w" style={{ fontSize: fit(cur.it.jp) }}>{cur.it.jp}</span>
                {cur.it.kana && cur.it.kana !== cur.it.jp && <span className="jp k">{cur.it.kana}</span>}
              </div>
              <div className="cd tnum" aria-live="polite">{cd ?? ''}</div>
              <div className="loop-answer" style={{ visibility: showFr ? 'visible' : 'hidden' }}>
                <div className={'mean' + (cur.it.fr.length > 26 ? ' long' : '')}>{cur.it.fr}</div>
                {cur.it.note && <p className="loop-note">{cur.it.note}</p>}
              </div>
            </>
          ) : (
            <div className="mean long">Rien à écouter pour l'instant.</div>
          )}
        </div>
      )}
      <div className="lis-bar"><i style={{ width: `${(1 - left / total) * 100}%` }} /></div>
      <div className="ctrls2">
        <button className="c2" onClick={() => go(-1)} aria-label="Précédent" disabled={!cur}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
        </button>
        <button className="c2 main" onClick={play} aria-label={playing ? 'Pause' : 'Lecture'} disabled={!cur || setup}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>
        </button>
        <button className="c2" onClick={() => go(1)} aria-label="Suivant" disabled={!cur}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
        </button>
      </div>
    </motion.div>
  )
}
