import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { unlockSpeech } from '../lib/tts'

export type StudyMode = 'normal' | 'car' | 'loop'
const LS_MODE = 'kioku:mode'
export function lastMode(): StudyMode {
  try {
    const m = localStorage.getItem(LS_MODE)
    return m === 'car' || m === 'loop' ? m : 'normal'
  } catch {
    return 'normal'
  }
}

const MODES: Array<{ id: StudyMode; title: string; text: string; icon: JSX.Element }> = [
  { id: 'normal', title: 'Normal', text: 'Mots et phrases à l\'écran, tu notes avec les boutons.', icon: <><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M10 18h4" /></> },
  { id: 'car', title: 'Mode voiture', text: 'L\'app parle, tu réponds à voix haute puis tu dis « bien » ou « encore ». Rien à toucher.', icon: <><path d="M5 17h14l-1.5-6.5A2 2 0 0 0 15.6 9H8.4a2 2 0 0 0-1.9 1.5Z" /><circle cx="8" cy="17" r="2" /><circle cx="16" cy="17" r="2" /></> },
  { id: 'loop', title: 'Écoute en boucle', text: 'Tes mots les plus ratés, des mots nouveaux et des phrases, qui défilent seuls. Sans noter.', icon: <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><rect x="2" y="14" width="5" height="7" rx="2" /><rect x="17" y="14" width="5" height="7" rx="2" /></> },
]

/** v1.21 — Avant la séance : Normal, Mode voiture ou Écoute en boucle. Le dernier choix est présélectionné. */
export function ModeSheet({ count, onPick, onClose }: { count: number; onPick: (m: StudyMode) => void; onClose: () => void }) {
  const [mode, setMode] = useState<StudyMode>(lastMode)
  const go = () => {
    try { localStorage.setItem(LS_MODE, mode) } catch { /* navigation privée */ }
    unlockSpeech()
    onPick(mode)
  }
  return createPortal(
    <div className="mode-veil" onClick={onClose}>
      <motion.div className="mode-sheet neon" role="dialog" aria-label="Choisir le mode" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} onClick={(e) => e.stopPropagation()}>
        <div className="mode-head"><span>Mission du jour</span><span className="mode-count tnum">{count} carte{count > 1 ? 's' : ''}</span></div>
        <div className="mode-title">Comment veux-tu réviser ?</div>
        {MODES.map((m) => (
          <button key={m.id} className={'mode-opt' + (mode === m.id ? ' on' : '')} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}>
            <span className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{m.icon}</svg></span>
            <span><b>{m.title}</b><span>{m.text}</span></span>
          </button>
        ))}
        <button className="pill-btn" onClick={go}>Commencer</button>
      </motion.div>
    </div>,
    document.body,
  )
}
