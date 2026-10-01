import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { DECKS } from '../lib/deck'
import { countDue, ALL } from '../lib/queue'
import { computeProgress, dayTotal, levelFromXp, levelTitle, streaks, totalXp } from '../lib/state'
import { dayKey, dayNumber } from '../lib/scheduler'
import { estimateLevel } from '../lib/level'
import { Bar, Icon, Ring } from './ui'
import { FreeStudy } from './FreeStudy'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 26 } } }

export function Home({ onAdd }: { onAdd: () => void }) {
  const { state, items, startSession, updateSettings } = useStore()
  const [freeOpen, setFreeOpen] = useState(false)
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
  const goalPct = dt.n / state.settings.goal
  const hour = new Date(now).getHours()
  const greet = hour < 5 ? 'こんばんは' : hour < 11 ? 'おはよう' : hour < 18 ? 'こんにちは' : 'こんばんは'
  const warm = state.settings.preSentences

  return (
    <motion.div className="stack" variants={container} initial="hidden" animate="show">
      {/* 1 · Mon niveau, tout en haut */}
      <motion.div variants={item} className="card level-card">
        <div className="row spread">
          <div className="jp muted" style={{ fontSize: 15, fontWeight: 600 }}>{greet} 👋</div>
          <div className="pill" title="Série de jours"><span style={{ fontSize: 18 }}>🔥</span><span className="tnum">{st.current}</span></div>
        </div>
        <div className="row spread" style={{ alignItems: 'flex-end', marginTop: 10 }}>
          <div>
            <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Mon niveau</div>
            <div className="lv-num tnum" style={{ marginTop: 4 }}>{lv.level}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="jp" style={{ fontSize: 22, fontWeight: 800 }}>{title.jp}</div>
            <div className="muted small">{title.fr} · {xp} XP</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Bar pct={lv.pct} /></div>
        <div className="row spread small muted" style={{ marginTop: 6 }}>
          <span className="tnum">{lv.into}/{lv.span} XP</span>
          <span>Niveau {lv.level + 1}</span>
        </div>

        <div className="jlpt">
          <div className="row spread">
            <div>
              <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Japonais estimé</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>
                {est.milestone.label} <span className="muted" style={{ fontWeight: 600, fontSize: 15 }}>· {est.milestone.cefr}</span>
              </div>
            </div>
            <div className="chip accent tnum">{prog.wordsKnownR} mots</div>
          </div>
          <div style={{ margin: '10px 0 6px' }}><Bar pct={est.pct} thin /></div>
          <div className="muted small">
            {est.next ? `Prochain palier : ${est.next.label} (${est.next.at} mots retenus)` : 'Palier maximal du deck atteint'} · Production : {prog.wordsKnownP} mots
          </div>
        </div>
      </motion.div>

      {/* 2 · À étudier */}
      <motion.div variants={item} className="hero">
        <div className="label">À étudier</div>
        <div className="row spread" style={{ alignItems: 'flex-end', marginTop: 6 }}>
          <div className="big tnum">{due.total}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="chip">✨ {due.fresh} nouv.</span>
            <span className="chip">🔁 {due.review + due.learning} à revoir</span>
          </div>
        </div>
        {due.total > 0 ? (
          <motion.button whileTap={{ scale: 0.97 }} className="btn white block" style={{ marginTop: 18 }} onClick={() => startSession(ALL, 0, { warm })}>
            Commencer
          </motion.button>
        ) : (
          <>
            <p style={{ margin: '14px 0 0', opacity: 0.9 }}>Tout est à jour pour aujourd'hui ✨</p>
            <motion.button whileTap={{ scale: 0.97 }} className="btn white block" style={{ marginTop: 14 }} onClick={() => startSession(ALL, 10)}>
              10 cartes de plus
            </motion.button>
          </>
        )}
        {due.total > 0 && (
          <div className="warm">
            <span>📝 Phrases avant la séance</span>
            {([0, 1, 2] as const).map((n) => (
              <button key={n} className={'chip btn-chip' + (warm === n ? ' active' : '')} onClick={() => updateSettings({ preSentences: n })}>
                {n === 0 ? 'Aucune' : n}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* 3 · Objectif du jour */}
      <motion.div variants={item} className="card">
        <div className="row" style={{ gap: 18 }}>
          <Ring pct={goalPct} size={92} stroke={11}>
            <b className="tnum" style={{ fontSize: 22, lineHeight: 1 }}>{Math.min(dt.n, 999)}</b>
            <span className="muted small tnum">/ {state.settings.goal}</span>
          </Ring>
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 17 }}>Objectif du jour</div>
            <div className="muted small">
              {dt.n >= state.settings.goal ? 'Atteint ! Ta série est sauvée 🔥' : `${state.settings.goal - dt.n} cartes pour garder ta série`}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4 · Réviser librement */}
      <motion.div variants={item}>
        <motion.button whileTap={{ scale: 0.98 }} className="list-row tap card" style={{ gap: 14 }} onClick={() => setFreeOpen(true)}>
          <div className="tile" style={{ background: 'hsl(265 85% 93%)' }}>🎯</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Réviser librement</div>
            <div className="muted small">Verbes, noms, adjectifs, météo… à n'importe quel niveau</div>
          </div>
          <span className="muted" style={{ fontSize: 22 }}>›</span>
        </motion.button>
      </motion.div>

      {/* 5 · Mes decks */}
      <motion.div variants={item}>
        <div className="section-title" style={{ marginTop: 10 }}>Mes decks</div>
        <div className="list">
          {DECKS.map((d) => {
            const f = { deck: d.id, pos: 'all' as const }
            const c = countDue(state, items, f, now)
            const deckItems = items.filter((i) => i.deck === d.id)
            const known = deckItems.filter((i) => {
              const r = state.cards[`${i.id}:r`]
              return r && r.s === 'review' && r.i >= 3
            }).length
            if (d.id === 'perso' && deckItems.length === 0) return null
            return (
              <motion.button whileTap={{ scale: 0.99 }} key={d.id} className="list-row tap" onClick={() => startSession(f)}>
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
      </motion.div>

      <motion.div variants={item}>
        <button className="btn ghost block" onClick={onAdd}>
          <span style={{ width: 20, height: 20, display: 'inline-flex' }}>{Icon.plus()}</span>
          Ajout rapide (mot vu en vidéo)
        </button>
      </motion.div>

      <FreeStudy open={freeOpen} onClose={() => setFreeOpen(false)} />
    </motion.div>
  )
}
