import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { ALL } from '../lib/queue'
import { FESTIVAL_DECK, FESTIVAL_GOAL, activeFestival, festivalEnd, festivalItems, festivalKey, festivalProgress, festivalYear } from '../lib/festivals'
import { isKnown } from '../lib/scheduler'

/** v1.12 — La fête de saison du moment : 15 mots, une décoration pour le village. */
export function FestivalCard({ full, onStart }: { full?: boolean; onStart?: () => void }) {
  const { state, startSession } = useStore()
  const now = new Date()
  const f = activeFestival(now)
  if (!f) return null
  const prog = festivalProgress(state, f.id)
  const won = !!state.ach[festivalKey(f.id, festivalYear(f, now))]
  const words = festivalItems(f.id)
  const pct = Math.min(1, prog.known / FESTIVAL_GOAL)
  const start = () => {
    onStart?.()
    startSession({ ...ALL, deck: FESTIVAL_DECK, ids: words.map((w) => w.id), free: true, ...(won ? { scope: 'practice' as const } : {}) }, 0)
  }
  return (
    <motion.div className="festival" style={{ ['--fest' as string]: f.hue }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <span className="festival-bg jp-display" aria-hidden="true">{f.jp}</span>
      <div className="festival-top">
        <span className="festival-tag">Fête de saison · jusqu'au {festivalEnd(f)}</span>
        <b className="festival-title"><span className="jp-display">{f.jp}</span> {f.name}</b>
        <span className="festival-desc">
          {won ? <>Décoration gagnée : {f.reward} ✓</> : <>Retiens {FESTIVAL_GOAL} mots sur {prog.total} pour gagner {f.reward} dans ton village.</>}
        </span>
      </div>
      <div className="festival-prog">
        <div className="festival-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.round(pct * 100)}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} /></div>
        <span className="tnum">{prog.known} mot{prog.known > 1 ? 's' : ''} retenu{prog.known > 1 ? 's' : ''} sur {prog.total}</span>
      </div>
      {full && (
        <div className="festival-words">
          {words.map((w) => {
            const c = state.cards[`${w.id}:r`]
            const ok = !!c && isKnown(c)
            return (
              <span key={w.id} className={'fw' + (ok ? ' ok' : c ? ' seen' : '')}>
                <span className="jp">{w.jp}</span>
                {ok && <small>✓</small>}
              </span>
            )
          })}
        </div>
      )}
      <motion.button whileTap={{ scale: 0.97 }} className="festival-go" onClick={start}>
        {won ? 'Réviser les mots de la fête' : prog.known ? 'Continuer les mots de la fête' : 'Apprendre les mots de la fête'}
      </motion.button>
    </motion.div>
  )
}
