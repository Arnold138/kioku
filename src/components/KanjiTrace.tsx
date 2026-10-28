import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { motion } from 'framer-motion'
import { checkStroke, type KanjiStrokes, type Pt } from '../lib/trace'

const MAX_TRIES = 3

/**
 * v1.13 — Une case pour tracer un kanji au doigt, trait par trait.
 * Chaque trait est vérifié (forme, place, sens) ; après 3 essais ratés, le trait se dessine tout seul.
 */
export function KanjiTrace({ ch, data, model, onDone }: { ch: string; data: KanjiStrokes; model: boolean; onDone: (mistakes: number) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [k, setK] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [tries, setTries] = useState(0)
  const [pts, setPts] = useState<Pt[]>([])
  const [msg, setMsg] = useState('')
  const [flash, setFlash] = useState(0)
  const [demo, setDemo] = useState(0) // 0 = pas d'animation, sinon un compteur qui relance l'animation
  const drawing = useRef(false)
  const total = data.s.length
  const done = k >= total

  useEffect(() => {
    setK(0)
    setMistakes(0)
    setTries(0)
    setPts([])
    setMsg('')
    setDemo((d) => d + 1) // on montre l'ordre des traits au début
  }, [ch])

  const toLocal = (e: PointerEvent<SVGSVGElement>): Pt | null => {
    const el = svg.current
    const m = el?.getScreenCTM()
    if (!el || !m) return null
    const p = el.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const q = p.matrixTransform(m.inverse())
    return [q.x, q.y]
  }

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (done) return
    setDemo(0)
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = toLocal(e)
    setPts(p ? [p] : [])
  }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    const p = toLocal(e)
    if (p) setPts((cur) => [...cur, p])
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    const user = pts
    setPts([])
    if (user.length < 2 && data.p[k] && Math.hypot(data.p[k][0] - data.p[k][14], data.p[k][1] - data.p[k][15]) > 12) return
    const res = checkStroke(user, data.p[k])
    if (res.ok) {
      const next = k + 1
      setK(next)
      setTries(0)
      setMsg(next >= total ? '' : '')
      if (next >= total) onDone(mistakes)
      return
    }
    const t = tries + 1
    setMistakes((m) => m + 1)
    setFlash((f) => f + 1)
    if (t >= MAX_TRIES) {
      setMsg('Ce trait s\'est dessiné pour toi. Continue !')
      const next = k + 1
      setK(next)
      setTries(0)
      if (next >= total) onDone(mistakes + 1)
    } else {
      setTries(t)
      setMsg(res.reversed ? 'Dans l\'autre sens : regarde le point de départ.' : 'Presque ! Regarde le trait qui clignote.')
    }
  }

  const start = !done && data.p[k] ? [data.p[k][0], data.p[k][1]] : null
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

  return (
    <div className="trace">
      <svg
        ref={svg}
        className="trace-pad"
        viewBox="0 0 109 109"
        role="img"
        aria-label={`Tracer ${ch}, trait ${Math.min(k + 1, total)} sur ${total}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <path d="M54.5 2 V107 M2 54.5 H107" className="trace-grid" />
        {model && data.s.map((d, i) => <path key={`m${i}`} d={d} className="trace-model" />)}
        {data.s.slice(0, k).map((d, i) => <path key={`d${i}`} d={d} className="trace-ink" />)}
        {demo > 0 &&
          data.s.map((d, i) => (
            <motion.path
              key={`demo${demo}-${i}`}
              d={d}
              className="trace-demo"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: i * 0.55, duration: 0.5, ease: 'easeInOut' }}
              onAnimationComplete={i === total - 1 ? () => setTimeout(() => setDemo(0), 700) : undefined}
            />
          ))}
        {flash > 0 && !done && data.s[k] && (
          <motion.path key={`f${flash}`} d={data.s[k]} className="trace-hint" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0, 0.9, 0] }} transition={{ duration: 1.4 }} />
        )}
        {start && demo === 0 && model && <circle cx={start[0]} cy={start[1]} r={3.2} className="trace-start" />}
        {line && <polyline points={line} className="trace-live" />}
      </svg>
      <div className="trace-info">
        <span className="tnum">{done ? `${total} / ${total} traits` : `Trait ${k + 1} / ${total}`}</span>
        <button className="chip btn-chip" onClick={() => setDemo((d) => d + 1)}>▶ Ordre des traits</button>
      </div>
      {msg && <div className="trace-msg">{msg}</div>}
    </div>
  )
}
