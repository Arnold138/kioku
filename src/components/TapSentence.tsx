import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { glossPieces, useGlossReady, type Gloss } from '../lib/gloss'
import { canSpeak, speak } from '../lib/tts'

/**
 * Phrase dont chaque mot se touche (v1.17) : une bulle donne sa forme de base, sa lecture, son sens et la grammaire.
 * Sans données pour cette phrase (phrase perso…), le texte s'affiche normalement.
 */
export function TapSentence({ id, jp, className = '' }: { id: string; jp: string; className?: string }) {
  useGlossReady()
  const g = glossPieces(id, jp)
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => setOpen(null), [id])
  if (!g) return <div className={className}>{jp}</div>
  return (
    <>
      <div className={className + ' tap-sent'}>
        {g.pieces.map((p, k) =>
          p.i < 0 ? <span key={k}>{p.text}</span> : (
            <span
              key={k}
              role="button"
              tabIndex={0}
              className={'tap-w' + (open === p.i ? ' on' : '')}
              onClick={(e) => { e.stopPropagation(); setOpen(open === p.i ? null : p.i); if (canSpeak()) void speak(g.words[p.i].r) }}
              onKeyDown={(e) => { if (e.key === 'Enter') setOpen(p.i) }}
            >{p.text}</span>
          ))}
      </div>
      <GlossSheet words={open == null ? [] : [g.words[open]]} onClose={() => setOpen(null)} />
    </>
  )
}

/** Bulle en bas de l'écran (hors de la carte qui se retourne, pour rester bien à plat). */
export function GlossSheet({ words, onClose }: { words: Gloss[]; onClose: () => void }) {
  useEffect(() => {
    if (!words.length) return
    const close = () => onClose()
    const id = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('click', close) }
  }, [words, onClose])
  return createPortal(
    <AnimatePresence>
      {words.length > 0 && (
        <motion.div className="gloss-sheet" role="dialog" aria-label="Sens du mot" onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.18 }}>
          {words.map((w, i) => (
            <div key={i} className="gloss-row">
              <div className="gloss-top">
                <span className="gloss-w jp">{w.s}</span>
                {w.r !== w.s && <span className="gloss-r jp">{w.r}</span>}
                {canSpeak() && <button type="button" className="icon-btn gloss-say" aria-label="Écouter" onClick={() => void speak(w.r)}>🔊</button>}
              </div>
              {w.base && <div className="gloss-base">forme de base : <b className="jp">{w.base}</b>{w.baseR && w.baseR !== w.base && <span className="jp"> ({w.baseR})</span>}</div>}
              {w.fr && <div className="gloss-fr">{w.fr}</div>}
              {w.g && <div className="gloss-g">{w.g}</div>}
            </div>
          ))}
          <button type="button" className="gloss-close" aria-label="Fermer" onClick={onClose}>✕</button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
