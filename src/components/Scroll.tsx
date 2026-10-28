import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { goldCount, scrollKanji, type ScrollKanji } from '../lib/scroll'
import { Sheet } from './ui'

/** v1.12 — Le parchemin d'or, rangé au sanctuaire. */
export function ScrollSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, items } = useStore()
  const list = useMemo(() => (open ? scrollKanji(state, items) : []), [open, state, items])
  const gold = goldCount(list)
  const [pick, setPick] = useState<ScrollKanji | null>(null)
  const sorted = useMemo(() => [...list].sort((a, b) => Number(b.gold) - Number(a.gold)), [list])
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Le parchemin d'or</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Chaque kanji d'un mot <b>solide</b> (revu à 21 jours ou plus) s'écrit à l'encre dorée. Les autres kanji que tu reconnais sont à l'encre noire.
          </p>
        </div>
        <div className="scroll-head">
          <div><b className="tnum">{gold}</b><span>kanji d'or</span></div>
          <div><b className="tnum">{list.length - gold}</b><span>à l'encre</span></div>
          <div><b className="tnum">{list.length}</b><span>kanji en tout</span></div>
        </div>
        <div className="scroll">
          <div className="scroll-rod" aria-hidden="true" />
          <div className="scroll-paper">
            {sorted.length === 0 && <p className="scroll-empty">Le rouleau est encore vierge. Retiens tes premiers mots écrits en kanji.</p>}
            <div className="scroll-grid">
              {sorted.map((k, i) => (
                <motion.button
                  key={k.ch}
                  className={'sk' + (k.gold ? ' gold' : '')}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(1.2, i * 0.008) }}
                  onClick={() => setPick(k)}
                  aria-label={`${k.ch} : ${k.example.jp}, ${k.example.fr}`}
                >
                  {k.ch}
                </motion.button>
              ))}
            </div>
          </div>
          <div className="scroll-rod" aria-hidden="true" />
        </div>
        {pick && (
          <div className="glass-card row" style={{ gap: 14 }}>
            <span className={'sk big' + (pick.gold ? ' gold' : '')}>{pick.ch}</span>
            <div className="grow">
              <div style={{ fontWeight: 700 }}><span className="jp">{pick.example.jp}</span> · {pick.example.fr}</div>
              <div className="muted small">Dans {pick.words} de tes mots · {pick.gold ? 'encre d\'or' : 'pas encore solide'}</div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
