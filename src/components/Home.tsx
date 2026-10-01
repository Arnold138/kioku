import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { DECKS } from '../lib/deck'
import { countDue, ALL } from '../lib/queue'
import { computeProgress, dayTotal, levelFromXp, levelTitle, streaks, totalXp } from '../lib/state'
import { dayKey, dayNumber } from '../lib/scheduler'
import { estimateLevel } from '../lib/level'
import { bestByLevel, examHistory, recommendedLevel } from '../lib/exam'
import { Bar, Icon } from './ui'
import { FreeStudy } from './FreeStudy'
import { DecksSheet } from './Decks'
import { Exams } from './Exams'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 26 } } }

export function Home({ onAdd }: { onAdd: () => void }) {
  const { state, items, startSession } = useStore()
  const [freeOpen, setFreeOpen] = useState(false)
  const [decksOpen, setDecksOpen] = useState(false)
  const [examsOpen, setExamsOpen] = useState(false)
  const now = Date.now()
  const day = dayKey(dayNumber(now))
  const due = useMemo(() => countDue(state, items, ALL, now), [state, items]) // eslint-disable-line
  const prog = useMemo(() => computeProgress(state, items), [state, items])
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

  const decksShown = DECKS.filter((d) => d.id !== 'perso' || items.some((i) => i.deck === 'perso'))
  const decksDue = useMemo(
    () =>
      decksShown.reduce((n, d) => {
        const c = countDue(state, items, { deck: d.id, pos: 'all' }, now)
        return n + c.review + c.learning
      }, 0),
    [state, items] // eslint-disable-line
  )

  return (
    <motion.div className="stack" variants={container} initial="hidden" animate="show">
      {/* 1 · Objectif du jour : tout en haut, tout petit */}
      <motion.div variants={item} className="goal-strip" aria-label="Objectif du jour">
        <div className="gs-row">
          <span>Objectif du jour · {goalDone ? <span className="gs-done">atteint ✓</span> : <b className="tnum">{dt.n} / {goal}</b>}</span>
          <span title="Série de jours" className="tnum">🔥 <b>{st.current}</b></span>
        </div>
        <Bar pct={dt.n / goal} thin />
      </motion.div>

      {/* 2 · Mon niveau */}
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

      {/* 3 · À étudier */}
      <motion.div variants={item} className="hero compact">
        <div className="label">À étudier</div>
        <div className="row spread" style={{ alignItems: 'flex-end', marginTop: 4 }}>
          <div className="big tnum">{due.total}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="chip">✨ {due.fresh} nouv.</span>
            <span className="chip">🔁 {due.review + due.learning} à revoir</span>
          </div>
        </div>
        {due.total > 0 ? (
          <motion.button whileTap={{ scale: 0.97 }} className="btn white block" style={{ marginTop: 16 }} onClick={() => startSession(ALL, 0, { warm })}>
            Commencer
          </motion.button>
        ) : (
          <>
            <p style={{ margin: '12px 0 0', opacity: 0.9 }}>Tout est à jour pour aujourd'hui ✨</p>
            <motion.button whileTap={{ scale: 0.97 }} className="btn white block" style={{ marginTop: 12 }} onClick={() => startSession(ALL, 10)}>
              10 cartes de plus
            </motion.button>
          </>
        )}
      </motion.div>

      {/* 4 · Trois lignes, une flèche : réviser librement · examens · mes decks */}
      <motion.div variants={item} className="list">
        <button className="list-row tap" onClick={() => setFreeOpen(true)}>
          <div className="row-ico" style={{ background: 'hsl(265 85% 93%)' }}>🎯</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Réviser librement</div>
            <div className="muted small">Mots, thèmes, phrases des vidéos…</div>
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
        <button className="list-row tap" onClick={() => setDecksOpen(true)}>
          <div className="row-ico" style={{ background: 'hsl(175 70% 90%)' }}>📚</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Mes decks</div>
            <div className="muted small">{decksShown.length} decks{decksDue ? ` · ${decksDue} à revoir` : ''}</div>
          </div>
          <span className="chev">›</span>
        </button>
      </motion.div>

      <motion.div variants={item}>
        <button className="btn ghost block" style={{ padding: '12px 18px', fontSize: 15 }} onClick={onAdd}>
          <span style={{ width: 18, height: 18, display: 'inline-flex' }}>{Icon.plus()}</span>
          Ajout rapide (mot vu en vidéo)
        </button>
      </motion.div>

      <FreeStudy open={freeOpen} onClose={() => setFreeOpen(false)} />
      <Exams open={examsOpen} onClose={() => setExamsOpen(false)} />
      <DecksSheet open={decksOpen} onClose={() => setDecksOpen(false)} />
    </motion.div>
  )
}
