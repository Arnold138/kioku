import { useEffect, useRef, useState } from 'react'
import { fetchWeather, roomPhase, roomWeather, type Weather, type WeatherSetting } from '../lib/room'
import { createRoom, loadImage, type RoomRenderer } from '../lib/roomGl'

const url = (f: string) => `${import.meta.env.BASE_URL}room/${f}`
const SEEN = 'kioku:chambre:vus' // livres déjà vus sur cet appareil (hors sauvegarde) : les nouveaux apparaissent en fondu

function readSeen(): number | null {
  try { const v = localStorage.getItem(SEEN); return v == null ? null : Number(v) } catch { return null }
}
function writeSeen(n: number) {
  try { localStorage.setItem(SEEN, String(n)) } catch { /* sans importance */ }
}

/**
 * Chambre d'étude vivante (v1.16) : Arnold écrit à son bureau, elle est sur le lit avec son téléphone,
 * Yuki dort contre elle. Un livre de plus sur la pile tous les 25 points.
 * Toucher Yuki la réveille ; toucher Arnold le fait écrire plus vite.
 */
export function RoomScene({ books, sky, weather }: { books: number; sky?: string; weather?: WeatherSetting }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const room = useRef<RoomRenderer | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [realWx, setRealWx] = useState<Weather | null>(null)
  const [tick, setTick] = useState(0)
  const [say, setSay] = useState<'' | 'yuki' | 'me'>('')
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const redraw = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    let raf = 0
    ;(async () => {
      try {
        const [base, next, reveal, fx, win, city] = await Promise.all(
          ['a.webp', 'b.webp', 'reveal.png', 'fx.png', 'win.webp', 'city.png'].map((f) => loadImage(url(f))))
        if (!alive || !canvas.current) return
        const r = createRoom(canvas.current, { base, next, reveal, fx, win, city })
        if (!r) { setFailed(true); return }
        room.current = r
        setReady(true)
        const t0 = performance.now()
        let last = t0
        redraw.current = () => r.frame((performance.now() - t0) / 1000, 0.016)
        const loop = (now: number) => {
          raf = requestAnimationFrame(loop)
          if (document.hidden || now - last < 33) return // ~30 images/s, en pause quand l'app est cachée
          const dt = Math.min(0.1, (now - last) / 1000)
          last = now
          r.frame((now - t0) / 1000, dt)
        }
        if (reduce) r.frame(0.3, 0)
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

  // Livres (les nouveaux depuis la dernière visite apparaissent en fondu) et ciel / météo
  const first = useRef(true)
  useEffect(() => {
    const r = room.current
    if (!r) return
    if (first.current) {
      const seen = readSeen()
      r.setBooks(seen == null || reduce ? books : Math.min(seen, books), true)
    }
    r.setBooks(books, reduce)
    writeSeen(books)
    r.setEnv({ ...roomPhase(sky, new Date()), ...roomWeather(weather, realWx) }, first.current || reduce)
    first.current = false
    if (reduce) r.frame(0.3, 0)
  }, [ready, books, sky, weather, realWx, tick, reduce])

  const talk = (who: 'yuki' | 'me') => {
    const r = room.current
    if (r && !reduce) { if (who === 'yuki') r.pet(3.5); else r.writeBurst(3.5) }
    if (reduce) redraw.current()
    setSay(who)
    window.setTimeout(() => setSay((s) => (s === who ? '' : s)), 2200)
  }

  return (
    <div className="room-scene">
      <img className="room-fallback" src={url('a.webp')} alt="" aria-hidden="true" style={{ opacity: ready && !failed ? 0 : 1 }} />
      {!failed && <canvas ref={canvas} className="room-canvas" aria-hidden="true" />}
      <button type="button" className="room-hot room-hot-yuki" aria-label="Caresser Yuki" onClick={() => talk('yuki')} />
      <button type="button" className="room-hot room-hot-me" aria-label="Toi, à ton bureau" onClick={() => talk('me')} />
      <span className={`room-say room-say-yuki${say === 'yuki' ? ' show' : ''}`} lang="ja" aria-live="polite">{say === 'yuki' ? 'にゃあ…' : ''}</span>
      <span className={`room-say room-say-me${say === 'me' ? ' show' : ''}`} lang="ja" aria-live="polite">{say === 'me' ? 'よし、もう一文！' : ''}</span>
    </div>
  )
}
