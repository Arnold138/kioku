import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { countDue, ALL } from '../lib/queue'
import { computeProgress, dayTotal, levelFromXp, levelTitle, streaks, totalXp } from '../lib/state'
import { dayKey, dayNumber } from '../lib/scheduler'
import { estimateLevel } from '../lib/level'
import { bestByLevel, examHistory, recommendedLevel } from '../lib/exam'
import { Bar } from './ui'
import { FreeStudy } from './FreeStudy'
import { Exams } from './Exams'
import { Weak } from './Weak'
import { weakCards } from '../lib/insights'
import { Challenges } from './Rewards'

const QUICK = 10 // séance « 2 minutes » : 10 cartes
const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 26 } } }

export function Home() {
  const { state, items, startSession } = useStore()
  const [freeOpen, setFreeOpen] = useState(false)
  const [examsOpen, setExamsOpen] = useState(false)
  const [weakOpen, setWeakOpen] = useState(false)
  const now = Date.now()
  const day = dayKey(dayNumber(now))
  const due = useMemo(() => countDue(state, items, ALL, now), [state, items]) // eslint-disable-line
  const prog = useMemo(() => computeProgress(state, items), [state, items])
  const weak = useMemo(() => weakCards(state, items, now), [state, items]) // eslint-disable-line
  const weakMisses = weak.reduce((n, w) => n + w.misses, 0)
  const dt = dayTotal(state, day)
  const xp = totalXp(state)
  const lv = levelFromXp(xp)
  const title = levelTitle(lv.level)
  const st = streaks(state, now)
  const est = estimateLevel(prog.wordsKnownR)
  const goal = state.settings.goal
  const goalDone = dt.n >= goal
  const warm = state.settings.preSentences

  const best = useMemo(() => bestByLevel(examHistory(state.ach)), [state.ach])
  const rec = recommendedLevel(est.milestone.id, best)
  const passed = (Object.keys(best) as Array<keyof typeof best>).filter((l) => best[l].passed)
  const examSub = passed.length ? `Validé : ${passed.join(' · ')} · conseillé : ${rec}` : `Test de niveau · conseillé : ${rec}`

  return (
    <motion.div className="stack" variants={container} initial="hidden" animate="show">
      {/* 1 · Objectif du jour + défis du jour, dans un seul bloc, tout en haut */}
      <motion.div variants={item}>
        <Challenges
          header={
            <div className="goal-head" aria-label="Objectif du jour">
              <div className="row spread" style={{ alignItems: 'baseline' }}>
                <b>Objectif du jour</b>
                <span className="row tnum" style={{ gap: 10 }}>
                  {goalDone ? <span className="gs-done">atteint ✓</span> : <b>{dt.n} / {goal}</b>}
                  <span title="Série de jours">🔥 <b>{st.current}</b></span>
                </span>
              </div>
              <div style={{ marginTop: 8 }}><Bar pct={dt.n / goal} thin /></div>
            </div>
          }
        />
      </motion.div>

      {/* 2 · À étudier */}
      <motion.div variants={item} className="hero compact">
        <div className="label">À étudier</div>
        <div className="row spread" style={{ alignItems: 'flex-end', marginTop: 4 }}>
          <div className="big tnum">{due.total}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="chip">✨ {due.fresh} nouv.</span>
            <span className="chip">🔁 {due.review + due.learning} à revoir</span>
          </div>
        </div>
        {due.deferred > 0 && (
          <p className="small" style={{ margin: '10px 0 0', opacity: 0.85 }}>
            {due.deferred} révision{due.deferred > 1 ? 's' : ''} reportée{due.deferred > 1 ? 's' : ''} à demain (quota du jour)
          </p>
        )}
        {due.total > 0 ? (
          <>
            <motion.button whileTap={{ scale: 0.97 }} className="btn white block" style={{ marginTop: 16 }} onClick={() => startSession(ALL, 0, { warm })}>
              Commencer
            </motion.button>
            {weak.length > 0 && (
              <motion.button whileTap={{ scale: 0.97 }} className="weak-btn" onClick={() => setWeakOpen(true)}>
                <span>🔥 Mes points faibles</span>
                <small className="tnum">{weak.length} carte{weak.length > 1 ? 's' : ''} · {weakMisses} raté{weakMisses > 1 ? 's' : ''} ›</small>
              </motion.button>
            )}
            <div className="hero-actions">
              <motion.button whileTap={{ scale: 0.97 }} className="btn glass" onClick={() => startSession({ ...ALL, cap: QUICK }, 0)}>⚡ 2 minutes</motion.button>
              {due.deferred > 0 && (
                <motion.button whileTap={{ scale: 0.97 }} className="btn glass" onClick={() => startSession({ ...ALL, moreReviews: 10 }, 0)}>＋ 10 révisions</motion.button>
              )}
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '12px 0 0', opacity: 0.9 }}>{due.deferred > 0 ? 'Quota du jour atteint ✨' : 'Tout est à jour pour aujourd\'hui ✨'}</p>
            {weak.length > 0 && (
              <motion.button whileTap={{ scale: 0.97 }} className="weak-btn" onClick={() => setWeakOpen(true)}>
                <span>🔥 Mes points faibles</span>
                <small className="tnum">{weak.length} carte{weak.length > 1 ? 's' : ''} · {weakMisses} raté{weakMisses > 1 ? 's' : ''} ›</small>
              </motion.button>
            )}
            <div className="hero-actions">
              {due.deferred > 0 && (
                <motion.button whileTap={{ scale: 0.97 }} className="btn white" onClick={() => startSession({ ...ALL, moreReviews: 10 }, 0)}>Encore 10 révisions</motion.button>
              )}
              <motion.button whileTap={{ scale: 0.97 }} className={'btn ' + (due.deferred > 0 ? 'glass' : 'white')} onClick={() => startSession(ALL, 10)}>
                10 nouvelles cartes
              </motion.button>
            </div>
          </>
        )}
      </motion.div>

      {/* 3 · Mon niveau */}
      <motion.div variants={item} className="card level-card compact">
        <div className="row spread" style={{ alignItems: 'center' }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="lv-num tnum">{lv.level}</div>
            <div>
              <div className="jp" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.15 }}>{title.jp}</div>
              <div className="muted small">Niveau · {title.fr}</div>
            </div>
          </div>
          <div className="muted small tnum" style={{ textAlign: 'right' }}>{xp} XP</div>
        </div>
        <div style={{ marginTop: 10 }}><Bar pct={lv.pct} thin /></div>
        <div className="row spread small muted" style={{ marginTop: 5 }}>
          <span className="tnum">{lv.into}/{lv.span} XP</span>
          <span>Niveau {lv.level + 1}</span>
        </div>
        <div className="est">
          <div>
            <div className="muted small">Japonais estimé</div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {est.milestone.label} <span className="muted" style={{ fontWeight: 600, fontSize: 14 }}>· {est.milestone.cefr}</span>
            </div>
          </div>
          <span className="chip accent tnum">{prog.wordsKnownR} mots</span>
        </div>
      </motion.div>

      {/* 4 · Deux lignes : réviser librement (avec écoute et mes decks dedans) · examens */}
      <motion.div variants={item} className="list">
        <button className="list-row tap" onClick={() => setFreeOpen(true)}>
          <div className="row-ico" style={{ background: 'hsl(265 85% 93%)' }}>🎯</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Réviser librement</div>
            <div className="muted small">Écoute, mes decks, mots, thèmes…</div>
          </div>
          <span className="chev">›</span>
        </button>
        <button className="list-row tap" onClick={() => setExamsOpen(true)}>
          <div className="row-ico" style={{ background: 'hsl(35 95% 90%)' }}>📝</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Examens</div>
            <div className="muted small">{examSub}</div>
          </div>
          <span className="chev">›</span>
        </button>
      </motion.div>

      <FreeStudy open={freeOpen} onClose={() => setFreeOpen(false)} />
      <Weak open={weakOpen} onClose={() => setWeakOpen(false)} />
      <Exams open={examsOpen} onClose={() => setExamsOpen(false)} />
    </motion.div>
  )
}
