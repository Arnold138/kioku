import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { ACHIEVEMENTS } from '../lib/achievements'
import { computeProgress, dayTotal, levelFromXp, levelTitle, retentionRate, streaks, totalReviews, totalXp } from '../lib/state'
import { dayKey, dayNumber, misses } from '../lib/scheduler'
import { Roadmap } from './Roadmap'
import { Weak } from './Weak'
import { forecast, weakCards, weakGroups } from '../lib/insights'

export function Progress() {
  const { state, items } = useStore()
  const now = Date.now()
  const today = dayNumber(now)
  const prog = useMemo(() => computeProgress(state, items), [state, items])
  const xp = totalXp(state)
  const lv = levelFromXp(xp)
  const title = levelTitle(lv.level)
  const st = streaks(state, now)
  const ret = retentionRate(state, 30, now)
  const reviews = totalReviews(state)
  const [leechOpen, setLeechOpen] = useState(false)
  const fc = useMemo(() => forecast(state, now, 7), [state]) // eslint-disable-line
  const maxFc = Math.max(10, ...fc.map((d) => d.n))
  const weak = useMemo(() => weakCards(state, items, now), [state, items]) // eslint-disable-line
  const groups = useMemo(() => weakGroups(weak), [weak])
  const totalMisses = useMemo(() => Object.values(state.cards).reduce((n, c) => n + misses(c), 0), [state.cards])
  const topWeak = [...groups.themes, ...groups.types].sort((a, b) => b.cards.length - a.cards.length).slice(0, 4)
  const minutes = Object.keys(state.daily).reduce((a, d) => a + Math.round(dayTotal(state, d).sec / 60), 0)

  // 14 derniers jours
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const dn = today - 13 + i
    return { dn, n: dayTotal(state, dayKey(dn)).n, label: ['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(dn * 86400000 + 43200000).getUTCDay()] }
  })
  const maxN = Math.max(10, ...last14.map((d) => d.n))

  // Heatmap : 16 semaines, colonnes = semaines (lundi en haut)
  const weeks = 16
  const dow = (new Date(today * 86400000 + 43200000).getUTCDay() + 6) % 7 // 0 = lundi
  const start = today - dow - (weeks - 1) * 7
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const dn = start + i
    const n = dn > today ? -1 : dayTotal(state, dayKey(dn)).n
    const g = state.settings.goal
    const level = n < 0 ? -1 : n === 0 ? 0 : n < g * 0.5 ? 1 : n < g ? 2 : n < g * 2 ? 3 : 4
    return { dn, n, level }
  })

  const unlocked = ACHIEVEMENTS.filter((a) => state.ach[a.id])

  return (
    <div className="stack">
      <div>
        <h1 className="large-title">Progrès</h1>
        <p className="subtitle">Ton parcours, ton rythme.</p>
      </div>

      <div className="hero">
        <div className="row spread">
          <div>
            <div className="label">Niveau {lv.level}</div>
            <div className="jp" style={{ fontSize: 30, fontWeight: 800 }}>{title.jp}</div>
            <div style={{ opacity: 0.9 }}>{title.fr}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="big tnum" style={{ fontSize: 40 }}>{xp}</div>
            <div className="label">XP</div>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,.25)', height: 8, borderRadius: 4, marginTop: 16, overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${lv.pct * 100}%` }} transition={{ type: 'spring', stiffness: 70, damping: 16 }} style={{ height: '100%', background: '#fff', borderRadius: 4 }} />
        </div>
        <div className="small" style={{ opacity: 0.85, marginTop: 6 }}>{lv.next - xp} XP avant le niveau {lv.level + 1}</div>
      </div>

      <div className="kpis">
        <div className="kpi"><b>🔥 {st.current}</b><span>jours de suite (record {st.best})</span></div>
        <div className="kpi"><b>{prog.wordsKnownR}</b><span>mots retenus</span></div>
        <div className="kpi"><b>{reviews}</b><span>{reviews > 1 ? "cartes révisées" : "carte révisée"}</span></div>
        <div className="kpi"><b>{minutes}<small style={{ fontSize: 15 }}> min</small></b><span>de pratique au total</span></div>
        <div className="kpi"><b>{totalMisses}</b><span>ratés au total</span></div>
        <div className="kpi"><b>{ret === null ? '—' : Math.round(ret * 100) + '%'}</b><span>de réussite (30 j)</span></div>
      </div>

      <Roadmap state={state} items={items} />

      <div className="card">
        <div className="row spread" style={{ alignItems: 'baseline', marginBottom: 12 }}>
          <b>Révisions à venir</b>
          <span className="muted small tnum">{fc.reduce((a, d) => a + d.n, 0)} sur 7 jours</span>
        </div>
        <div className="fc-bars">
          {fc.map((d, i) => (
            <div key={d.dn} className="fc-col">
              <b className="tnum">{d.n}</b>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (d.n / maxFc) * 60)}px` }}
                transition={{ type: 'spring', stiffness: 90, damping: 16 }}
                style={{ width: '100%', borderRadius: 6, background: i === 0 ? 'linear-gradient(180deg,var(--accent-2),var(--accent))' : 'color-mix(in srgb, var(--accent) 38%, var(--surface-2))' }}
              />
              <small>{d.label}</small>
            </div>
          ))}
        </div>
        {state.settings.reviewsPerDay > 0 && fc[0].n > state.settings.reviewsPerDay && (
          <p className="muted small" style={{ margin: '12px 0 0' }}>
            Aujourd'hui, {fc[0].n} cartes sont dues : ton quota est de {state.settings.reviewsPerDay} par jour, le reste glisse sur les jours suivants (les plus difficiles d'abord).
          </p>
        )}
      </div>

      <button className="card weak-card tap" onClick={() => setLeechOpen(true)} style={{ textAlign: 'left', display: 'block', width: '100%' }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="row-ico" style={{ background: 'hsl(25 95% 90%)' }}>🔥</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Mes points faibles</div>
            <div className="muted small">
              {weak.length ? `${weak.length} carte${weak.length > 1 ? 's' : ''} à renforcer · ${weak.reduce((n, w) => n + w.misses, 0)} ratés` : 'Aucun pour le moment'}
            </div>
          </div>
          <span className="chev">›</span>
        </div>
        {topWeak.length > 0 && (
          <div className="chips wrap" style={{ marginTop: 10 }}>
            {topWeak.map((g) => (
              <span key={g.id} className="chip miss-chip">{g.emoji} {g.label} <b className="tnum">{g.cards.length}</b></span>
            ))}
          </div>
        )}
      </button>
      <Weak open={leechOpen} onClose={() => setLeechOpen(false)} />

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>14 derniers jours</div>
        <div className="row" style={{ alignItems: 'flex-end', gap: 5, height: 110 }}>
          {last14.map((d) => (
            <div key={d.dn} className="grow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(d.n ? 6 : 3, (d.n / maxN) * 84)}px` }}
                transition={{ type: 'spring', stiffness: 90, damping: 16 }}
                style={{ width: '100%', borderRadius: 6, background: d.n >= state.settings.goal ? 'linear-gradient(180deg,var(--accent-2),var(--accent))' : d.n ? 'color-mix(in srgb, var(--accent) 40%, var(--surface-2))' : 'var(--surface-2)' }}
                title={`${d.n} cartes`}
              />
              <span className="muted" style={{ fontSize: 10 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Régularité · 16 semaines</div>
        <div className="heat" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
          {cells.map((c) => (
            <i key={c.dn} className={c.level > 0 ? 'l' + c.level : ''} style={c.level < 0 ? { visibility: 'hidden' } : undefined} title={`${dayKey(c.dn)} · ${c.n} cartes`} />
          ))}
        </div>
      </div>

      <div>
        <div className="section-title" style={{ marginTop: 6 }}>Trophées · {unlocked.length}/{ACHIEVEMENTS.length}</div>
        <div className="trophies">
          {ACHIEVEMENTS.map((a) => {
            const got = state.ach[a.id]
            return (
              <motion.div key={a.id} className={'trophy' + (got ? '' : ' locked')} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="e">{got ? a.emoji : '🔒'}</div>
                <b>{a.name}</b>
                <span>{a.desc}</span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
