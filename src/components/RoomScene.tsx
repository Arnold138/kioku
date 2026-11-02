import { useEffect, useRef, useState } from 'react'
import { fetchWeather, roomPhase, roomPos, roomStep, roomWeather, type Weather, type WeatherSetting } from '../lib/room'
import { createRoom, loadImage, type RoomRenderer } from '../lib/roomGl'

const S = ['s1', 's2', 's3', 's4']
const url = (f: string) => `${import.meta.env.BASE_URL}room/${f}`

/** Chambre d'étude vivante (v1.15) : Arnold et Yuki, la pluie, la lampe… et un objet peint de plus tous les 50 mots. */
export function RoomScene({ words, sky, weather, height }: { words: number; sky?: string; weather?: WeatherSetting; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const room = useRef<RoomRenderer | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [realWx, setRealWx] = useState<Weather | null>(null)
  const [tick, setTick] = useState(0) // recalcul de l'heure chaque minute
  const step = roomStep(words)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Chargement des images et création du rendu
  useEffect(() => {
    let alive = true
    let raf = 0
    ;(async () => {
      try {
        const [states, reveal, fx, win, eyes, city] = await Promise.all([
          Promise.all(S.map((s) => loadImage(url(`${s}.webp`)))),
          Promise.all([0, 1, 2].map((i) => loadImage(url(`reveal${i}.png`)))),
          Promise.all(S.map((s) => loadImage(url(`fx_${s}.png`)))),
          Promise.all(S.map((s) => loadImage(url(`win_${s}.webp`)))),
          Promise.all(S.map((s) => loadImage(url(`eyes_${s}.png`)))),
          loadImage(url('city.png')),
        ])
        if (!alive || !canvas.current) return
        const r = createRoom(canvas.current, { states, reveal, fx, win, eyes, city })
        if (!r) { setFailed(true); return }
        room.current = r
        setReady(true)
        const t0 = performance.now()
        let last = t0
        const loop = (now: number) => {
          raf = requestAnimationFrame(loop)
          if (document.hidden || now - last < 33) return // ~30 images/s, en pause quand l'app est cachée
          const dt = Math.min(0.1, (now - last) / 1000)
          last = now
          r.frame((now - t0) / 1000, dt)
        }
        if (reduce) r.frame(0, 0)
        else raf = requestAnimationFrame(loop)
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      room.current?.destroy()
      room.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Vraie météo à Valence (rafraîchie toutes les 30 min)
  useEffect(() => {
    if (weather && weather !== 'auto') return
    let alive = true
    const get = () => fetchWeather().then((w) => { if (alive) setRealWx(w) })
    get()
    const id = window.setInterval(get, 30 * 60_000)
    return () => { alive = false; window.clearInterval(id) }
  }, [weather])

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  // Palier (les nouveaux objets apparaissent en fondu) et ciel / météo
  const first = useRef(true)
  useEffect(() => {
    const r = room.current
    if (!r) return
    r.setStep(step, first.current || reduce)
    r.setEnv({ ...roomPhase(sky, new Date()), ...roomWeather(weather, realWx) }, first.current || reduce)
    first.current = false
    if (reduce) r.frame(0, 0)
  }, [ready, step, sky, weather, realWx, tick, reduce])

  const k = Math.min(3, roomPos(step).k)
  return (
    <div className="room-scene" style={height ? { height } : undefined}>
      <img className="room-fallback" src={url(`${S[k]}.webp`)} alt="" aria-hidden="true" style={{ opacity: ready && !failed ? 0 : 1 }} />
      {!failed && <canvas ref={canvas} className="room-canvas" aria-hidden="true" />}
    </div>
  )
}
