import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import type { Item } from '../lib/deck'
import { loadKanjiData, pickTraceWords, kanjiIn, traceReward, TRACE_XP, TRACE_PERFECT_BONUS, type KanjiStrokes } from '../lib/trace'
import { Sheet } from './ui'
import { KanjiTrace } from './KanjiTrace'

const ROUND = 5

/**
 * v1.13 — Exercice « Tracer les kanji ».
 * Sans `word` : 5 kanji tirés de tes mots retenus (Réviser librement). Avec `word` : les kanji de ce mot (depuis une carte).
 */
export function TracePractice({ open, onClose, back, word }: { open: boolean; onClose: () => void; back?: { label: string; onBack: () => void }; word?: Item }) {
  const { state, items, recordTrace } = useStore()
  const [data, setData] = useState<Record<string, KanjiStrokes> | null>(null)
  const [err, setErr] = useState(false)
  const [model, setModel] = useState(true)
  const [list, setList] = useState<Array<{ ch: string; word: Item }> | null>(null)
  const [i, setI] = useState(0)
  const [results, setResults] = useState<number[]>([])
  const [last, setLast] = useState<number | null>(null)
  const [xp, setXp] = useState<number | null>(null)
  const t0 = useRef(0)

  useEffect(() => {
    if (!open) return
    loadKanjiData().then(setData).catch(() => setErr(true))
  }, [open])

  const reset = () => {
    setList(null)
    setI(0)
    setResults([])
    setLast(null)
    setXp(null)
  }
  useEffect(() => {
    if (!open) reset()
  }, [open])

  const start = () => {
    if (!data) return
    const l = word ? kanjiIn(word.jp, data).map((ch) => ({ ch, word })) : pickTraceWords(state, items, ROUND, data)
    reset()
    t0.current = Date.now()
    setList(l)
  }
  // depuis une carte : on commence tout de suite
  useEffect(() => {
    if (open && word && data && !list) start()
  }, [open, word, data]) // eslint-disable-line

  const cur = list?.[i]
  const finished = !!list && i >= list.length
  useEffect(() => {
    if (finished && list && list.length && xp === null) setXp(recordTrace({ mistakes: results, sec: (Date.now() - t0.current) / 1000 }))
  }, [finished]) // eslint-disable-line

  const rw = traceReward(results)

  return (
    <Sheet open={open} onClose={onClose} back={back}>
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Tracer les kanji ✍️</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Trace au doigt, trait par trait, dans le bon ordre. Chaque trait est vérifié.</p>
        </div>
        {err && <div className="typed-result bad">Les tracés n'ont pas pu se charger. Réessaie avec une connexion.</div>}
        {!list && !word && (
          <>
            <div>
              <div className="free-sec">Aide</div>
              <div className="seg">
                <button className={model ? 'on' : ''} onClick={() => setModel(true)}>Avec le modèle</button>
                <button className={model ? '' : 'on'} onClick={() => setModel(false)}>De mémoire</button>
              </div>
              <p className="muted small" style={{ margin: '8px 2px 0' }}>
                {model ? 'Le kanji est dessiné en transparence, un point montre où commence chaque trait.' : 'Case vide : seule l\'animation de départ te montre le kanji.'}
              </p>
            </div>
            <div className="listen-gain">
              <span>⚡ <b>{TRACE_XP} XP</b> par kanji</span>
              <span>✨ <b>+{TRACE_PERFECT_BONUS} XP</b> sans faute</span>
            </div>
            <button className="btn block" disabled={!data} style={!data ? { opacity: 0.5 } : undefined} onClick={start}>{data ? `Commencer · ${ROUND} kanji` : 'Chargement des tracés…'}</button>
          </>
        )}
        {list && list.length === 0 && <p className="muted">Retiens d'abord quelques mots écrits en kanji : ils apparaîtront ici.</p>}
        {cur && data && !finished && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row spread small muted">
              <span>Kanji {i + 1} / {list!.length}</span>
              <span className="tnum">{results.filter((m) => m === 0).length} sans faute</span>
            </div>
            <div className="trace-word">
              <span className="jp" style={{ fontSize: 22, fontWeight: 700 }}>
                {[...cur.word.jp].map((c, k) => (c === cur.ch ? <b key={k} className="trace-target">{c}</b> : <span key={k}>{c}</span>))}
              </span>
              <span className="muted">{cur.word.kana} · {cur.word.fr}</span>
            </div>
            {last === null ? (
              <KanjiTrace key={`${i}-${cur.ch}`} ch={cur.ch} data={data[cur.ch]} model={model} onDone={(m) => setLast(m)} />
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="trace-result">
                <span className="jp trace-big">{cur.ch}</span>
                <b>{last === 0 ? 'Parfait, sans faute !' : `${last} erreur${last > 1 ? 's' : ''}`}</b>
                <span className="muted small">+{TRACE_XP + (last === 0 ? TRACE_PERFECT_BONUS : 0)} XP</span>
                <button className="btn block" onClick={() => { setResults((r) => [...r, last]); setLast(null); setI((n) => n + 1) }}>{i + 1 >= list!.length ? 'Voir mon bilan' : 'Kanji suivant'}</button>
              </motion.div>
            )}
          </div>
        )}
        {finished && list && list.length > 0 && (
          <div className="summary listen-end" style={{ paddingTop: 8 }}>
            <motion.div className="emoji" initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
              {rw.perfect === rw.total ? '🖌️' : '✍️'}
            </motion.div>
            <h2 style={{ margin: 0, fontSize: 28 }}>{rw.perfect} / {rw.total} sans faute</h2>
            <p className="muted" style={{ margin: 0 }}>{xp !== null ? `+${xp} XP` : ''}</p>
            {!word && <button className="btn block" onClick={start}>Encore {ROUND} kanji</button>}
            <button className="btn plain block" onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
