import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { ALL_CHALLENGES_BONUS, LISTEN_XP_PER, challengeProgress, listenMult, type ListenMode, type ListenReward } from '../lib/rewards'
import { dayKey, dayNumber } from '../lib/scheduler'

/** Nombre qui défile de 0 à `target`. */
export function useCountUp(target: number, ms = 900, delay = 0) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    let start = 0
    const t0 = setTimeout(() => {
      const step = (now: number) => {
        if (!start) start = now
        const p = Math.min(1, (now - start) / ms)
        setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => {
      clearTimeout(t0)
      cancelAnimationFrame(raf)
    }
  }, [target, ms, delay])
  return v
}

const heat = (n: number) => (n >= 20 ? 'h4' : n >= 10 ? 'h3' : n >= 5 ? 'h2' : 'h1')

/** Pastille de combo qui « saute » à chaque bonne réponse (visible à partir de 3). */
export function ComboBadge({ combo, mult, extra }: { combo: number; mult?: number; extra?: string }) {
  return (
    <AnimatePresence>
      {combo >= 3 && (
        <motion.span
          key={combo}
          className={'combo-badge ' + heat(combo)}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1.35, 1], opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          🔥 Combo {combo}
          {mult && mult > 1 ? <b>×{mult.toFixed(1).replace('.0', '').replace('.', ',')}</b> : null}
          {extra ? <b>{extra}</b> : null}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/** Petit « +15 XP » qui s'envole après une bonne réponse. */
export function XpPop({ id, xp }: { id: number; xp: number }) {
  return (
    <AnimatePresence>
      {xp > 0 && (
        <motion.span
          key={id}
          className="xp-pop"
          initial={{ opacity: 0, y: 6, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: -26, scale: 1 }}
          transition={{ duration: 1.1, times: [0, 0.15, 0.7, 1] }}
        >
          +{xp} XP
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/** XP d'une bonne réponse à l'écoute, combo compris (pour l'affichage en direct). */
export const listenAnswerXp = (mode: ListenMode, streak: number) => Math.round(LISTEN_XP_PER[mode] * listenMult(streak))

/** Bilan d'écoute animé : chaque ligne apparaît, puis le total défile. */
export function RewardBreakdown({ reward, mode }: { reward: ListenReward; mode: ListenMode }) {
  const rows: Array<[string, string, number]> = [
    ['✅', `${reward.ok} bonne${reward.ok > 1 ? 's' : ''} réponse${reward.ok > 1 ? 's' : ''} × ${LISTEN_XP_PER[mode]}`, reward.answers],
    ['🔥', `Combo · meilleur ${reward.bestCombo} d'affilée`, reward.combo],
    ['💯', 'Sans faute', reward.perfect],
    ['🎧', 'Écoute terminée', reward.base]
  ]
  const shown = rows.filter((r) => r[2] > 0)
  const delay = shown.length * 260 + 250
  const total = useCountUp(reward.total_xp, 900, delay)
  return (
    <div className="reward-box">
      {shown.map(([e, label, xp], i) => (
        <motion.div key={label} className="reward-row" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.26, type: 'spring', stiffness: 300, damping: 24 }}>
          <span className="e">{e}</span>
          <span className="grow">{label}</span>
          <b className="tnum">+{xp}</b>
        </motion.div>
      ))}
      <motion.div className="reward-total" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: delay / 1000, type: 'spring', stiffness: 260, damping: 18 }}>
        <span>Total</span>
        <b className="tnum">+{total} XP</b>
      </motion.div>
    </div>
  )
}

/** Défis du jour : trois petites missions, toujours les mêmes pour une date donnée. */
export function Challenges({ compact }: { compact?: boolean }) {
  const { state } = useStore()
  const day = dayKey(dayNumber(Date.now()))
  const list = challengeProgress(state, day)
  const doneN = list.filter((c) => c.done).length
  const all = !!state.ach[`q:${day}:all`]
  return (
    <div className={'card challenges' + (compact ? ' compact' : '')}>
      <div className="row spread" style={{ alignItems: 'baseline', marginBottom: 10 }}>
        <b>Défis du jour</b>
        <span className={'chip tnum ' + (all ? 'accent' : '')}>{all ? '🌈 Journée parfaite' : `${doneN}/3 · +${ALL_CHALLENGES_BONUS} XP si 3/3`}</span>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {list.map((c) => {
          const pct = c.target ? c.current / c.target : 0
          const shownCur = c.id === 'time' ? Math.floor(c.current / 60) : c.current
          const shownTarget = c.id === 'time' ? Math.floor(c.target / 60) : c.target
          return (
            <div key={c.id} className={'quest' + (c.done ? ' done' : '')}>
              <div className="quest-ico">{c.done ? '✓' : c.emoji}</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row spread" style={{ gap: 8 }}>
                  <span className="quest-label">{c.label}</span>
                  <span className="quest-xp tnum">+{c.xp}</span>
                </div>
                <div className="bar thin" style={{ marginTop: 6 }}>
                  <motion.i initial={{ width: 0 }} animate={{ width: `${Math.round(pct * 100)}%` }} transition={{ type: 'spring', stiffness: 90, damping: 18 }} />
                </div>
                {!c.done && c.target > 1 && <div className="muted tnum" style={{ fontSize: 11, marginTop: 3 }}>{shownCur} / {shownTarget}{c.id === 'time' ? ' min' : ''}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
