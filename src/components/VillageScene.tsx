import { useMemo } from 'react'
import type { Building, CityStatus, Sky } from '../lib/village'

// v1.11 — le village dessiné (SVG). Tout vient de tes cartes : rien n'est stocké.
// Le dessin est fait sur une scène de 390 × 312 (coordonnées), qui s'étire en largeur.

const SKIES: Record<Sky, { top: string; mid: string; bot: string; mount: string; hill: string; ground: string; stars: number; orb: string; orbGlow: number }> = {
  nuit: { top: '#070a24', mid: '#1d1645', bot: '#4a2550', mount: '#2a2156', hill: '#1e1842', ground: '#120f2a', stars: 1, orb: '#fff4d6', orbGlow: 0.14 },
  aube: { top: '#1b2a5e', mid: '#7a4f8c', bot: '#f29a7a', mount: '#4b3a78', hill: '#2f2758', ground: '#1a1536', stars: 0.3, orb: '#ffe1b8', orbGlow: 0.22 },
  jour: { top: '#4f9de0', mid: '#9fd0f0', bot: '#ffe1c4', mount: '#6b7fb5', hill: '#4d6a9e', ground: '#2c3d66', stars: 0, orb: '#fff6d8', orbGlow: 0.35 }
}

/** Couleurs propres à chaque ville. */
const PALETTE: Record<string, { wall: string; roof: string; roof2: string }> = {
  shirakawa: { wall: '#2b2250', roof: '#5b4630', roof2: '#6d5538' },
  nara: { wall: '#2b2250', roof: '#43358a', roof2: '#7a2e2a' },
  kyoto: { wall: '#2a2147', roof: '#3a2d63', roof2: '#8a2f2f' },
  osaka: { wall: '#25213f', roof: '#2f3c6b', roof2: '#a33a3a' },
  tokyo: { wall: '#1f2340', roof: '#2f3a66', roof2: '#3d4f8a' }
}

const LIT = '#ffc56b'
const DIM = '#3a2f6b'
const GROUND_Y = 258

// constellation de la série : jusqu'à 7 étoiles, une par jour de série
const CONST = [
  [44, 74],
  [66, 60],
  [92, 66],
  [108, 52],
  [132, 58],
  [146, 78],
  [170, 70]
]
const STARS = [
  [34, 46, 1.2],
  [78, 98, 0.9],
  [122, 36, 1.1],
  [206, 34, 1.3],
  [246, 98, 0.8],
  [274, 52, 1],
  [362, 120, 0.9],
  [12, 128, 0.8],
  [196, 92, 0.7],
  [228, 64, 0.9]
]
const SLOTS = [124, 200, 266, 334]
const WIDTH: Record<Building['shape'], number> = { shop: 46, shrine: 58, station: 50, school: 40, house: 40, hall: 48 }

function Leaves({ x, n, seed }: { x: number; n: number; seed: number }) {
  const shown = Math.min(7, n)
  return (
    <g>
      {Array.from({ length: shown }, (_, i) => {
        const dx = ((seed * 37 + i * 53) % 44) - 22
        const dy = ((seed * 11 + i * 29) % 12) + 2
        const rot = (seed * 41 + i * 67) % 180
        const fill = ['#f59e0b', '#ea580c', '#c2410c'][(seed + i) % 3]
        return <ellipse key={i} cx={x + dx} cy={GROUND_Y + dy} rx={3} ry={1.6} fill={fill} transform={`rotate(${rot} ${x + dx} ${GROUND_Y + dy})`} />
      })}
      {n > 0 && <ellipse className="v-leaf-fall" cx={x + 8} cy={GROUND_Y - 30} rx={2.6} ry={1.4} fill="#f59e0b" />}
    </g>
  )
}

function Roof({ shape, x, w, top, color, color2, city }: { shape: Building['shape']; x: number; w: number; top: number; color: string; color2: string; city: string }) {
  const l = x - w / 2 - 6
  const r = x + w / 2 + 6
  if (shape === 'shrine' || shape === 'hall') {
    return (
      <>
        <path d={`M${l} ${top + 3} Q${x} ${top - 22} ${r} ${top + 3} Q${x} ${top - 8} ${l} ${top + 3} Z`} fill={shape === 'shrine' ? color2 : color} />
        {shape === 'hall' && <rect x={x - 3} y={top - 14} width={6} height={4} fill={color2} />}
      </>
    )
  }
  if (shape === 'station') return <rect x={l + 2} y={top - 5} width={w + 8} height={6} rx={1} fill={color} />
  // toit à deux pentes ; à Shirakawa-gō, très pentu (gasshō-zukuri, toit de chaume)
  const peak = city === 'shirakawa' && (shape === 'house' || shape === 'shop') ? 30 : 20
  return (
    <>
      <path d={`M${l} ${top + 2} L${x} ${top - peak} L${r} ${top + 2} Z`} fill={color} />
      {city === 'shirakawa' && <path d={`M${x - 7} ${top - peak + 7} L${x} ${top - peak} L${x + 7} ${top - peak + 7} Z`} fill="#ece8ff" opacity={0.55} />}
    </>
  )
}

function House({ b, x, city }: { b: Building; x: number; city: string }) {
  const pal = PALETTE[city] ?? PALETTE.shirakawa
  const full = WIDTH[b.shape]
  if (b.stage === 0) {
    // terrain : juste un emplacement en pointillés et un piquet
    return (
      <g opacity={0.75}>
        <rect x={x - full / 2} y={GROUND_Y - 6} width={full} height={6} fill="none" stroke="#ffd88a" strokeOpacity={0.45} strokeDasharray="3 3" />
        <rect x={x - 0.7} y={GROUND_Y - 16} width={1.4} height={10} fill="#d6b07a" />
        <rect x={x - 6} y={GROUND_Y - 20} width={12} height={6} rx={1} fill="#d6b07a" />
      </g>
    )
  }
  const w = b.stage === 1 ? Math.round(full * 0.6) : full
  const h = b.stage === 1 ? 16 : b.stage === 2 ? 28 : 36
  const top = GROUND_Y - h
  const lit = b.stage === 3
  const win = Math.max(1, Math.floor((w - 8) / 14))
  return (
    <g>
      {lit && <rect x={x - w / 2 + 2} y={top + 4} width={w - 4} height={h - 8} fill={LIT} opacity={0.5} filter="url(#vGlow)" />}
      <rect x={x - w / 2} y={top} width={w} height={h} fill={b.stage === 1 ? '#241d45' : pal.wall} />
      <Roof shape={b.shape} x={x} w={w} top={top} color={b.stage === 1 ? '#33286a' : pal.roof} color2={pal.roof2} city={city} />
      {b.stage >= 2 &&
        Array.from({ length: win }, (_, i) => {
          const wx = x - w / 2 + 6 + i * ((w - 12) / Math.max(1, win)) + 1
          const on = lit || i === 0
          return <rect key={i} x={wx} y={top + 7} width={9} height={8} rx={1} fill={on ? LIT : DIM} className={lit && i === 0 ? 'v-flicker' : undefined} />
        })}
      {lit && b.shape === 'shop' && <rect x={x - 7} y={GROUND_Y - 8} width={14} height={6} fill="#e5484d" />}
      {lit && (
        <g>
          <circle cx={x + w / 2 + 6} cy={GROUND_Y - 12} r={6} fill="#ffb35c" opacity={0.55} filter="url(#vGlow)" />
          <rect x={x + w / 2 + 5.3} y={GROUND_Y - 12} width={1.4} height={12} fill="#1b1638" />
          <ellipse cx={x + w / 2 + 6} cy={GROUND_Y - 12} rx={3} ry={3.8} fill="#ffb35c" />
        </g>
      )}
    </g>
  )
}

function Monument({ city }: { city: CityStatus }) {
  const x = 60
  const built = city.built
  const red = '#e5484d'
  const op = built ? 1 : 0.4
  const kind = city.monument.kind
  return (
    <g>
      <g opacity={op}>
        {kind === 'torii' && (
          <g fill={red}>
            <rect x={x - 16} y={214} width={4.5} height={44} />
            <rect x={x + 11} y={214} width={4.5} height={44} />
            <path d={`M${x - 25} 212 Q${x} 205 ${x + 25} 212 L${x + 25} 218 Q${x} 211 ${x - 25} 218 Z`} />
            <rect x={x - 20} y={223} width={40} height={3.5} />
          </g>
        )}
        {kind === 'pagoda' && (
          <g>
            <rect x={x - 9} y={196} width={18} height={62} fill="#2b2250" />
            {[208, 222, 236, 250].map((y, i) => (
              <path key={y} d={`M${x - 20 + i} ${y} L${x} ${y - 10} L${x + 20 - i} ${y} Z`} fill="#7a2e2a" />
            ))}
            <rect x={x - 0.8} y={184} width={1.6} height={14} fill="#d6b07a" />
          </g>
        )}
        {kind === 'gate' && (
          <g>
            <rect x={x - 22} y={224} width={44} height={34} fill="#7a2e2a" />
            <rect x={x - 8} y={236} width={16} height={22} fill="#1b1638" />
            <path d={`M${x - 32} 226 Q${x} 196 ${x + 32} 226 Q${x} 214 ${x - 32} 226 Z`} fill="#3a2d63" />
          </g>
        )}
        {kind === 'castle' && (
          <g>
            <rect x={x - 22} y={240} width={44} height={18} fill="#d8d4e8" />
            <rect x={x - 14} y={222} width={28} height={18} fill="#ece8ff" />
            <path d={`M${x - 26} 242 L${x} 230 L${x + 26} 242 Z M${x - 18} 224 L${x} 210 L${x + 18} 224 Z`} fill="#2f3c6b" />
          </g>
        )}
        {kind === 'tower' && (
          <g fill="none" stroke="#ff5a3c" strokeWidth={2}>
            <path d={`M${x - 16} 258 L${x} 176 L${x + 16} 258 M${x - 10} 230 L${x + 10} 230 M${x - 6} 204 L${x + 6} 204`} />
          </g>
        )}
      </g>
      {!built && (
        <g stroke="#ffd88a" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3" fill="none">
          <path d={`M${x - 26} 258 L${x - 26} 190 M${x + 26} 258 L${x + 26} 190 M${x - 26} 204 L${x + 26} 204 M${x - 26} 190 L${x + 26} 190`} />
        </g>
      )}
    </g>
  )
}

function Decor({ city }: { city: string }) {
  if (city === 'nara')
    // un cerf
    return (
      <g fill="#c9a27a" className="v-bob">
        <ellipse cx={168} cy={250} rx={7} ry={3.6} />
        <rect x={162} y={252} width={1.4} height={6} />
        <rect x={172} y={252} width={1.4} height={6} />
        <path d="M174 248 L177 241 L179 242 L176 249 Z" />
        <path d="M178 240 l-2 -4 M178 240 l2 -4" stroke="#c9a27a" strokeWidth={1} />
      </g>
    )
  if (city === 'kyoto')
    return (
      <g fill="#3f6f4a">
        {[372, 378, 384].map((x, i) => (
          <rect key={x} x={x} y={200 + i * 6} width={2.6} height={58 - i * 6} rx={1} />
        ))}
      </g>
    )
  return null
}

export interface SceneProps {
  city: CityStatus
  buildings: Building[]
  sky: Sky
  streak: number
  height?: number
  labels?: boolean
  className?: string
}

export function VillageScene({ city, buildings, sky, streak, height = 312, labels = false, className }: SceneProps) {
  const s = SKIES[sky]
  const shown = useMemo(() => buildings.slice(0, SLOTS.length), [buildings])
  const walkers = Math.min(3, buildings.filter((b) => b.stage >= 2).length)
  const leaves = buildings.reduce((n, b) => n + b.leaves, 0)
  const dirty = shown.findIndex((b) => b.leaves > 0)
  const stars = Math.min(7, streak)
  const id = city.id
  return (
    <svg className={className} viewBox="0 0 390 312" preserveAspectRatio="xMidYMax slice" width="100%" height={height} role="img" aria-label={`${city.name} : ${buildings.filter((b) => b.stage >= 1).length} bâtiments, ${leaves} feuilles à balayer`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.top} />
          <stop offset="0.55" stopColor={s.mid} />
          <stop offset="1" stopColor={s.bot} />
        </linearGradient>
        <filter id="vGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="vSoft" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10" /></filter>
      </defs>
      <rect x="0" y="0" width="390" height="312" fill={`url(#sky-${id})`} />
      <g fill="#fff" opacity={s.stars}>
        {STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} className={i % 3 === 0 ? 'v-twinkle' : undefined} style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
      </g>
      {stars > 0 && (
        <g opacity={Math.max(0.35, s.stars)} stroke="#ffe7a8" strokeWidth={0.7} strokeOpacity={0.45} fill="#ffe7a8">
          {stars > 1 && <path d={'M' + CONST.slice(0, stars).map(([x, y]) => `${x} ${y}`).join(' L')} fill="none" />}
          {CONST.slice(0, stars).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === stars - 1 ? 2.3 : 1.7} />
          ))}
        </g>
      )}
      <circle cx="318" cy="78" r="40" fill={s.orb} opacity={s.orbGlow} filter="url(#vSoft)" />
      <circle cx="318" cy="78" r={sky === 'jour' ? 19 : 17} fill={s.orb} />
      <path d="M0 214 L64 186 L118 200 L188 128 L210 118 L234 130 L300 190 L350 180 L390 194 L390 312 L0 312 Z" fill={s.mount} />
      <path d="M188 128 L210 118 L234 130 L224 140 L214 132 L203 142 L196 136 Z" fill="#ece8ff" opacity={0.5} />
      <path d="M0 238 Q90 208 180 230 T390 224 L390 312 L0 312 Z" fill={s.hill} />

      <Monument city={city} />
      {shown.map((b, i) => (
        <House key={b.id} b={b} x={SLOTS[i]} city={city.id} />
      ))}
      <Decor city={city.id} />
      {/* érables d'automne */}
      <rect x="370" y="236" width="3" height="22" fill="#3a2418" />
      <circle cx="372" cy="232" r="10" fill="#c2410c" />
      <circle cx="364" cy="239" r="6.5" fill="#ea580c" />

      <path d="M0 254 Q195 244 390 254 L390 312 L0 312 Z" fill={s.ground} />
      {shown.map((b, i) => (b.leaves > 0 ? <Leaves key={b.id} x={SLOTS[i]} n={b.leaves} seed={i + 1} /> : null))}

      {/* habitants qui se promènent */}
      {walkers >= 1 && (
        <g className="v-walk"><g className="v-step">
          <circle cx="0" cy="250" r="2.8" fill="#f5f0ff" /><path d="M-3 253 h6 l1.2 8 h-8.4 z" fill="#7c6cff" />
        </g></g>
      )}
      {walkers >= 2 && (
        <g className="v-walk-back"><g className="v-step slow">
          <circle cx="0" cy="252" r="2.6" fill="#ffe4d6" /><path d="M-3 255 h6 l1 7 h-8 z" fill="#e5484d" />
        </g></g>
      )}
      {walkers >= 3 && (
        <g className="v-walk late"><g className="v-step">
          <circle cx="0" cy="251" r="2.4" fill="#ffe4d6" /><path d="M-2.6 254 h5.2 l1 6.6 h-7.2 z" fill="#0f9f8f" />
        </g></g>
      )}
      {/* le balayeur, devant le bâtiment le plus couvert de feuilles */}
      {dirty >= 0 && (
        <g transform={`translate(${SLOTS[dirty] + 18} 0)`}>
          <circle cx="0" cy="250" r="2.8" fill="#ffe4d6" />
          <path d="M-3 253 h6 l1 7 h-8 z" fill="#0f9f8f" />
          <g className="v-sweep">
            <rect x="2.5" y="254" width="1" height="10" fill="#d6b07a" />
            <path d="M0.5 263 h5 l1 3 h-7 z" fill="#d6b07a" />
          </g>
        </g>
      )}
      {/* le chat du village */}
      <g fill="#f5f0ff" className="v-bob">
        <ellipse cx="238" cy="262" rx="5.5" ry="4" />
        <circle cx="238" cy="256" r="3.6" />
        <path d="M235 254 L235.6 250 L237.6 253.4 Z M241 254 L240.4 250 L238.4 253.4 Z" />
      </g>

      {labels &&
        shown.map((b, i) => {
          const txt = `${b.sign} ${Math.round(b.pct * 100)} %`
          const w = b.sign.length * 11 + 34
          const x = Math.min(386 - w, Math.max(4, SLOTS[i] - w / 2))
          const y = i % 2 ? 150 : 172
          return (
            <g key={b.id}>
              <rect x={x} y={y} width={w} height={20} rx={8} fill="rgba(20,16,48,0.8)" stroke={b.stage === 3 ? 'rgba(255,197,107,0.7)' : 'rgba(255,255,255,0.25)'} />
              <text x={x + w / 2} y={y + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="'Hiragino Maru Gothic ProN', 'Hiragino Sans', sans-serif">{txt}</text>
            </g>
          )
        })}
      {labels && (
        <g>
          <rect x="18" y="128" width="84" height="20" rx="8" fill={city.built ? 'rgba(229,72,77,0.92)' : 'rgba(20,16,48,0.8)'} stroke="rgba(255,216,138,0.6)" strokeDasharray={city.built ? undefined : '3 2'} />
          <text x="60" y="142" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="'Hiragino Maru Gothic ProN', 'Hiragino Sans', sans-serif">
            {city.monument.kanji} {city.built ? '✓' : `${Math.round(city.monumentPct * 100)} %`}
          </text>
        </g>
      )}
    </svg>
  )
}
