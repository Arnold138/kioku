import { useMemo } from 'react'
import { useStore } from '../lib/store'
import { CITIES, SOLID, levelProgress } from '../lib/village'

/** v1.11 — La route du JLPT : N5 → N4 → N3 → N2, ville après ville (N1 en bonus). */
export function JlptRoute() {
  const { state, items } = useStore()
  const levels = useMemo(() => levelProgress(state, items), [state, items])
  const curIdx = Math.max(0, levels.findIndex((l) => !l.solid))
  const cur = levels[curIdx]
  const next = CITIES[curIdx + 1]
  const missing = Math.max(0, Math.ceil(cur.total * SOLID) - cur.known)
  const doneSegs = levels.slice(0, 4).filter((l) => l.solid).length

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="glass-card route-head">
        <div className="route-ring">
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
            <circle cx="46" cy="46" r="38" fill="none" stroke="rgba(255,207,92,0.18)" strokeWidth="9" />
            <circle cx="46" cy="46" r="38" fill="none" stroke="#ffcf5c" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${238.8 * Math.min(1, cur.pct)} 238.8`} transform="rotate(-90 46 46)" />
          </svg>
          <div><b>{cur.lvl}</b><small className="tnum">{Math.round(cur.pct * 100)} %</small></div>
        </div>
        <div className="grow">
          <span className="caps-label">Ta route du JLPT</span>
          <div style={{ fontWeight: 800, fontSize: 19, marginTop: 2 }}>
            {curIdx === 0 ? 'Cap sur le N5' : `${levels[curIdx - 1].lvl} solide · en route vers le ${cur.lvl}`}
          </div>
          {cur.total > 0 ? (
            <div className="muted small" style={{ marginTop: 4, lineHeight: 1.4 }}>
              Encore <b>{missing} mot{missing > 1 ? 's' : ''} {cur.lvl}</b>{next ? <> pour ouvrir <span className="jp-display">{next.kanji}</span> {next.name}</> : ''}.
            </div>
          ) : (
            <div className="muted small" style={{ marginTop: 4 }}>Les mots du {cur.lvl} arriveront dans une prochaine mise à jour.</div>
          )}
        </div>
      </div>

      <div className="route-v">
        <div className="route-v-line" aria-hidden="true" />
        <div className="route-v-fill" aria-hidden="true" style={{ height: `${Math.min(4, doneSegs + (cur.total ? Math.min(1, cur.pct / SOLID) : 0)) * 25}%` }} />
        {CITIES.map((c, i) => {
          const l = levels[i]
          const state2 = l.solid ? 'done' : i === curIdx ? 'now' : c.lvl === 'N2' ? 'goal' : c.lvl === 'N1' ? 'bonus' : 'later'
          return (
            <div key={c.id} className={'route-v-step ' + state2}>
              <div className="route-v-node">{c.lvl}</div>
              <div className="route-v-card">
                <div className="row spread" style={{ alignItems: 'baseline', gap: 8 }}>
                  <b><span className="jp-display">{c.kanji}</span> {c.name}</b>
                  <span className="small route-v-cefr">{c.cefr}</span>
                </div>
                <div className="q-bar"><i style={{ width: `${Math.round(l.pct * 100)}%` }} /></div>
                <div className="row spread small" style={{ gap: 8 }}>
                  <span className="muted tnum">{l.total ? `${l.known} / ${l.total} mots` : c.lvl === 'N2' ? 'Liste N2 à venir' : 'Pour le plaisir'}</span>
                  <b>{l.solid ? 'Solide' : i === curIdx ? 'En cours' : c.lvl === 'N2' ? 'Objectif' : c.lvl === 'N1' ? 'Bonus' : 'À venir'}</b>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
