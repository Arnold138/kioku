import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { DECKS } from '../lib/deck'
import { countDue } from '../lib/queue'
import { Bar, Sheet } from './ui'

/** « Mes decks » : la liste des paquets, ouverte depuis une seule ligne de l'accueil. */
export function DecksSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, items, startSession } = useStore()
  const now = Date.now()
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Mes decks</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Touche un deck pour réviser ce qui est à faire dedans.</p>
        </div>
        <div className="list">
          {DECKS.map((d) => {
            const deckItems = items.filter((i) => i.deck === d.id)
            if (d.id === 'perso' && deckItems.length === 0) return null
            const f = { deck: d.id, pos: 'all' as const }
            const c = countDue(state, items, f, now)
            const known = deckItems.filter((i) => {
              const r = state.cards[`${i.id}:r`]
              return r && r.s === 'review' && r.i >= 3
            }).length
            return (
              <motion.button
                whileTap={{ scale: 0.99 }}
                key={d.id}
                className="list-row tap"
                onClick={() => {
                  onClose()
                  startSession(f)
                }}
              >
                <div className="tile" style={{ background: `hsl(${d.hue} 80% 93%)` }}>{d.emoji}</div>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <div className="muted small">{d.sub} · {known}/{deckItems.length}</div>
                  <div style={{ marginTop: 6 }}><Bar pct={deckItems.length ? known / deckItems.length : 0} thin /></div>
                </div>
                <span className={'badge tnum' + (c.total ? '' : ' zero')}>{c.total}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}
