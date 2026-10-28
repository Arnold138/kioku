import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, XP_SESSION } from '../lib/store'
import { countDue, ALL } from '../lib/queue'
import { computeProgress, dayTotal, levelFromXp, levelTitle, streaks, totalXp } from '../lib/state'
import { dayKey, dayNumber } from '../lib/scheduler'
import { estimateLevel } from '../lib/level'
import { bestByLevel, examHistory, recommendedLevel } from '../lib/exam'
import { challengeProgress, ALL_CHALLENGES_BONUS } from '../lib/rewards'
import { buildingsFor, cityStatuses, currentCity, dirtiest, levelProgress, skyFor, type Sky } from '../lib/village'
import { Exams } from './Exams'
import { Challenges } from './Rewards'
import { VillageScene } from './VillageScene'
import { VillageSheet } from './Village'

const QUICK = 10 // séance « 2 minutes » : 10 cartes
const STREAK_STEPS = [3, 7, 14, 30, 50, 100, 200, 365, 500, 1000]
const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 26 } } }

export function currentSky(setting: string | undefined, now = Date.now()): Sky {
  return setting === 'nuit' || setting === 'aube' || setting === 'jour' ? setting : skyFor(new Date(now).getHours())
}

/** Un anneau de progression (Objectif, Défis, Série). */
function RingStat({ pct, color, children, label, sub }: { pct: number; color: string; children: ReactNode; label: string; sub: string }) {
  const r = 32
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, pct))
  return (
    <div className="ring-stat">
      <div className="ring-box">
        <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden="true">
          <circle cx="39" cy="39" r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth="8" />
          <motion.circle
            cx="39" cy="39" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" transform="rotate(-90 39 39)"
            strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ type: 'spring', stiffness: 60, damping: 18 }}
          />
        </svg>
        <div className="ring-in">{children}</div>
      </div>
      <b>{label}</b>
      <span>{sub}</span>
    </div>
  )
}

const Check = ({ color }: { color: string }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

/** Tama, le chat du village. */
const Tama = () => (
  <div className="tama" aria-hidden="true">
    <svg width="34" height="34" viewBox="0 0 40 40">
      <path d="M9 14 L11 4 L17 11 Z M31 14 L29 4 L23 11 Z" fill="#2b2250" />
      <ellipse cx="20" cy="22" rx="12" ry="11" fill="#2b2250" />
      <circle cx="15.5" cy="21" r="1.8" fill="#ffcf5c" />
      <circle cx="24.5" cy="21" r="1.8" fill="#ffcf5c" />
      <path d="M18 26 Q20 28 22 26" stroke="#ffcf5c" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  </div>
)

export function Home({ onOpenProgress }: { onOpenProgress?: () => void }) {
  const { state, items, startSession } = useStore()
  const [examsOpen, setExamsOpen] = useState(false)
  const [villageOpen, setVillageOpen] = useState(false)
  const [questsOpen, setQuestsOpen] = useState(false)
  const now = Date.now()
  const day = dayKey(dayNumber(now))
  const due = useMemo(() => countDue(state, items, ALL, now), [state, items]) // eslint-disable-line
  const prog = useMemo(() => computeProgress(state, items), [state, items])
  const cities = useMemo(() => cityStatuses(state, items), [state, items])
  const city = currentCity(cities)
  const buildings = useMemo(() => buildingsFor(state, items, city.lvl, now), [state, items, city.lvl]) // eslint-disable-line
  const levels = useMemo(() => levelProgress(state, items), [state, items])
  const dt = dayTotal(state, day)
  const xp = totalXp(state)
  const lv = levelFromXp(xp)
  const title = levelTitle(lv.level)
  const st = streaks(state, now)
  const est = estimateLevel(prog.wordsKnownR)
  const goal = state.settings.goal
  const goalDone = dt.n >= goal
  const warm = state.settings.preSentences
  const sky = currentSky(state.settings.sky, now)
  const quests = challengeProgress(state, day)
  const questsDone = quests.filter((q) => q.done).length
  const nextStep = STREAK_STEPS.find((n) => n > st.current) ?? st.current + 100
  const prevStep = [...STREAK_STEPS].reverse().find((n) => n <= st.current) ?? 0

  const best = useMemo(() => bestByLevel(examHistory(state.ach)), [state.ach])
  const rec = recommendedLevel(est.milestone.id, best)
  const passed = (Object.keys(best) as Array<keyof typeof best>).filter((l) => best[l].passed)
  const examSub = passed.length ? `Validé : ${passed.join(' · ')} · conseillé : ${rec}` : `Test de niveau · conseillé : ${rec}`

  // Village : bâtiments en travaux, feuilles
  const working = buildings.filter((b) => b.stage < 3).length
  const leaves = buildings.reduce((n, b) => n + b.leaves, 0)
  const dirty = dirtiest(buildings)

  // Route du JLPT (N5 → N2)
  const route = levels.slice(0, 4)
  const curIdx = Math.max(0, route.findIndex((l) => !l.solid))
  const cur = route[curIdx]

  // Mission du jour
  const mins = Math.max(1, Math.round((due.total * 25) / 60))
  const reviewN = due.review + due.learning
  const estXp = due.total * 10 + (due.total >= 5 ? XP_SESSION : 0)
  const streakUp = !st.todayDone && due.total >= goal - dt.n
  const msg =
    due.total > 0
      ? dirty
        ? <>Les feuilles recouvrent <b className="jp">{dirty.sign}</b> ! Revois tes <b>{due.total} cartes</b> pour les balayer, ça te prendra environ {mins} minute{mins > 1 ? 's' : ''}.</>
        : <><b>{due.total} cartes</b> t'attendent aujourd'hui. Environ {mins} minute{mins > 1 ? 's' : ''}, et le village grandit.</>
      : due.deferred > 0
        ? <>Le quota du jour est atteint et le village est tout propre ✨ Tu peux encore balayer <b>10 révisions</b>.</>
        : <>Tout est propre aujourd'hui ✨ Tu veux découvrir <b>10 nouveaux mots</b> pour agrandir le village ?</>

  return (
    <motion.div className="home2" variants={container} initial="hidden" animate="show">
      {/* 1 · Le village vivant */}
      <motion.div variants={item} className="village-banner">
        <VillageScene city={city} buildings={buildings} sky={sky} streak={st.current} height={300} />
        <div className="vb-top">
          <div className="vb-brand"><span className="jp-display">記憶</span><span>Kioku</span></div>
          <div className="glass-chip" title="Série de jours">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.4-4.6.3 1.6 1.2 2.6 2.1 2.6 0-3 .5-5.6.5-8z" /></svg>
            <span className="tnum">{st.current} jour{st.current > 1 ? 's' : ''}</span>
          </div>
        </div>
      </motion.div>

      <div className="home2-body">
          <button className="vb-pill" onClick={() => setVillageOpen(true)}>
            <span className="grow">
              <b>{city.name} <span className="jp-display muted">{city.kanji}</span></b>
              <small>{working} bâtiment{working > 1 ? 's' : ''} en travaux · {leaves} feuille{leaves > 1 ? 's' : ''} à balayer</small>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        {/* 2 · Niveau + route du JLPT */}
        <motion.div variants={item} className="glass-card lvl2">
          <div className="row" style={{ gap: 14 }}>
            <div className="lvl2-ring">
              <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
                <circle cx="34" cy="34" r="28" fill="none" stroke="var(--ring-track)" strokeWidth="6" />
                <motion.circle cx="34" cy="34" r="28" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" transform="rotate(-90 34 34)"
                  strokeDasharray={175.9} initial={{ strokeDashoffset: 175.9 }} animate={{ strokeDashoffset: 175.9 * (1 - lv.pct) }} transition={{ type: 'spring', stiffness: 60, damping: 18 }} />
              </svg>
              <b className="tnum">{lv.level}</b>
            </div>
            <div className="grow">
              <div className="jp-display" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>{title.jp}</div>
              <div className="muted" style={{ fontSize: 14 }}>{title.fr} · niveau {lv.level}</div>
              <div className="muted small tnum">{(lv.next - xp).toLocaleString('fr-FR')} XP avant le niveau {lv.level + 1}</div>
            </div>
          </div>
          <div className="sep" />
          <button className="route-mini" onClick={onOpenProgress}>
            <div className="row spread" style={{ alignItems: 'baseline' }}>
              <span className="caps-label">Route du JLPT</span>
              <span className="route-now tnum">{cur.lvl} à {Math.round(cur.pct * 100)} % · {prog.wordsKnownR} mots ›</span>
            </div>
            <div className="route-dots">
              <div className="route-line" />
              <div className="route-fill" style={{ width: `${(Math.min(3, curIdx + Math.min(1, cur.pct / 0.8)) / 3) * 75}%` }} />
              {route.map((l, i) => (
                <div key={l.lvl} className="route-step">
                  <span className={'route-dot' + (l.solid ? ' done' : i === curIdx ? ' now' : '')}>{l.lvl}</span>
                  <small>{l.solid ? 'solide' : l.total === 0 ? 'objectif' : `${Math.round(l.pct * 100)} %`}</small>
                </div>
              ))}
            </div>
          </button>
        </motion.div>

        {/* 3 · Mission du jour (À étudier) */}
        <motion.div variants={item} className="mission">
          <span className="mission-bg jp-display" aria-hidden="true">任務</span>
          <div className="row spread" style={{ position: 'relative' }}>
            <span className="mission-tag">Mission du jour</span>
            <span className="jp-display" style={{ color: '#ffe39a', fontWeight: 700, fontSize: 15 }}>今日の任務</span>
          </div>
          <div className="mission-talk">
            <Tama />
            <div className="grow">
              <div className="mission-who">Tama, le chat du village</div>
              <div className="mission-bubble">{msg}</div>
            </div>
          </div>
          {due.total > 0 && (
            <div className="mission-rewards">
              <div className="mr gold"><b className="tnum">+{estXp}</b><span>XP</span></div>
              <div className="mr leaf"><b className="tnum">{reviewN}</b><span>feuille{reviewN > 1 ? 's' : ''} balayée{reviewN > 1 ? 's' : ''}</span></div>
              {streakUp ? (
                <div className="mr fire"><b className="tnum">{st.current + 1} j</b><span>de série</span></div>
              ) : (
                <div className="mr new"><b className="tnum">{due.fresh}</b><span>nouveau{due.fresh > 1 ? 'x' : ''} mot{due.fresh > 1 ? 's' : ''}</span></div>
              )}
            </div>
          )}
          {due.total > 0 ? (
            <>
              <motion.button whileTap={{ scale: 0.97 }} className="mission-go" onClick={() => startSession(ALL, 0, { warm })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /></svg>
                Accepter la mission
              </motion.button>
              <div className="mission-more">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => startSession({ ...ALL, cap: QUICK }, 0)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffe08a" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" /></svg>
                  2 minutes
                </motion.button>
                {due.deferred > 0 && <motion.button whileTap={{ scale: 0.97 }} onClick={() => startSession({ ...ALL, moreReviews: 10 }, 0)}>+10 révisions</motion.button>}
              </div>
            </>
          ) : (
            <div className="mission-more">
              {due.deferred > 0 && <motion.button whileTap={{ scale: 0.97 }} className="solid" onClick={() => startSession({ ...ALL, moreReviews: 10 }, 0)}>Encore 10 révisions</motion.button>}
              <motion.button whileTap={{ scale: 0.97 }} className={due.deferred > 0 ? '' : 'solid'} onClick={() => startSession(ALL, 10)}>10 nouvelles cartes</motion.button>
            </div>
          )}
        </motion.div>

        {/* 4 · Aujourd'hui : trois anneaux */}
        <motion.div variants={item} className="glass-card">
          <button className="today-head" onClick={() => setQuestsOpen((o) => !o)} aria-expanded={questsOpen}>
            <b>Aujourd'hui</b>
            <span className="muted small">{questsOpen ? 'Masquer les défis' : `+${ALL_CHALLENGES_BONUS} XP si 3 défis sur 3 ›`}</span>
          </button>
          <button className="rings" onClick={() => setQuestsOpen((o) => !o)} aria-label="Voir les défis du jour">
            <RingStat pct={dt.n / goal} color="#34d399" label="Objectif" sub={`${dt.n} / ${goal} cartes`}>
              {goalDone ? <Check color="#34d399" /> : <b className="tnum">{Math.round((dt.n / goal) * 100)}%</b>}
            </RingStat>
            <RingStat pct={questsDone / 3} color="#60a5fa" label="Défis" sub={questsDone === 3 ? 'journée parfaite' : `encore ${3 - questsDone}`}>
              {questsDone === 3 ? <Check color="#60a5fa" /> : <b className="tnum">{questsDone}/3</b>}
            </RingStat>
            <RingStat pct={(st.current - prevStep) / Math.max(1, nextStep - prevStep)} color="#fb923c" label="Série" sub={`${nextStep - st.current} j avant ${nextStep}`}>
              <b className="tnum">{st.current}</b>
            </RingStat>
          </button>
          <AnimatePresence initial={false}>
            {questsOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ marginTop: 12 }}><Challenges compact /></div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 5 · Examens */}
        <motion.button variants={item} className="glass-card row-card" onClick={() => setExamsOpen(true)}>
          <div className="row-ico2" style={{ background: 'rgba(251,191,36,0.18)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5b82e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h8l1 3H7l1-3z" /><rect x="5" y="6" width="14" height="15" rx="2" /><path d="M9 12h6M9 16h4" /></svg>
          </div>
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 16 }}>Examens</div>
            <div className="muted small">{examSub}</div>
          </div>
          <span className="chev">›</span>
        </motion.button>
      </div>

      <VillageSheet open={villageOpen} onClose={() => setVillageOpen(false)} />
      <Exams open={examsOpen} onClose={() => setExamsOpen(false)} />
    </motion.div>
  )
}
