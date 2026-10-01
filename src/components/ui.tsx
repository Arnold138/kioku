import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const Icon = {
  home: (a?: boolean) => (
    <svg viewBox="0 0 24 24" {...S} fill={a ? 'currentColor' : 'none'}>
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  cards: (a?: boolean) => (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="4" y="5" width="16" height="14" rx="3" fill={a ? 'currentColor' : 'none'} />
      <path d="M8 10h8M8 14h5" stroke={a ? '#fff' : 'currentColor'} />
    </svg>
  ),
  chart: (a?: boolean) => (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="4" y="12" width="4" height="8" rx="1.5" fill={a ? 'currentColor' : 'none'} />
      <rect x="10" y="6" width="4" height="14" rx="1.5" fill={a ? 'currentColor' : 'none'} />
      <rect x="16" y="9" width="4" height="11" rx="1.5" fill={a ? 'currentColor' : 'none'} />
    </svg>
  ),
  gear: (a?: boolean) => (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="3.2" fill={a ? 'currentColor' : 'none'} />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  close: () => (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  undo: () => (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  ),
  speaker: () => (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ),
  search: () => (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  plus: () => (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  check: () => (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

/** Anneau de progression animé. */
export function Ring({ pct, size = 96, stroke = 11, children, color = 'url(#g)' }: { pct: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, pct))
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        />
      </svg>
      <div className="center">{children}</div>
    </div>
  )
}

export function Bar({ pct, thin }: { pct: number; thin?: boolean }) {
  return (
    <div className={'bar' + (thin ? ' thin' : '')}>
      <motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
    </div>
  )
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => i.offset.y > 120 && onClose()}
          >
            <div className="grab-zone" onPointerDown={(e) => controls.start(e)}>
              <div className="grab" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={() => onChange(!on)} />
}

export function Stepper({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label="Moins">−</button>
      <b className="tnum">{value}</b>
      <button onClick={() => onChange(Math.min(max, value + step))} aria-label="Plus">+</button>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}
