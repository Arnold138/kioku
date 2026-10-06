import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { AppState } from '../lib/state'
import { computeProgress } from '../lib/state'
import type { Item } from '../lib/deck'
import { estimateLevel, MILESTONES } from '../lib/level'
import { levelReports, themeCoverage } from '../lib/insights'
import { bestByLevel, examHistory, EXAM_LEVELS } from '../lib/exam'
import { aidCounts, AID_KANA_AT, AID_NONE_AT } from '../lib/aid'
import { Bar } from './ui'

const pctTxt = (x: number) => `${Math.round(x * 100)} %`

/** « Où j'en suis » : ce que j'ai atteint, ce qu'il me reste, niveau par niveau. */
export function Roadmap({ state, items }: { state: AppState; items: Item[] }) {
  const prog = useMemo(() => computeProgress(state, items), [state, items])
  const est = estimateLevel(prog.wordsKnownR)
  const estP = estimateLevel(prog.wordsKnownP)
  const reports = useMemo(() => levelReports(state, items), [state, items])
  const themes = useMemo(() => themeCoverage(state, items), [state, items])
  const aid = useMemo(() => aidCounts(state.cards, items), [state.cards, items])
  const best = useMemo(() => bestByLevel(examHistory(state.ach)), [state.ach])
  const toNext = est.next ? Math.max(0, est.next.at - prog.wordsKnownR) : 0
  const strong = themes.filter((t) => t.pct >= 0.5).slice(0, 4)
  const weak = [...themes].filter((t) => t.pct < 0.5).sort((a, b) => a.pct - b.pct).slice(0, 4)

  return (
    <div className="stack" style={{ gap: 14 }}>
      {/* Palier actuel */}
      <div className="card">
        <div className="muted small caps">Mon niveau de japonais</div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{est.milestone.label}</div>
          <div className="muted">{est.milestone.cefr} · {prog.wordsKnownR} mots retenus</div>
          <span className="chip accent" style={{ marginTop: 10 }}>Je sais produire : {estP.milestone.label} · {prog.wordsKnownP} mots</span>
        </div>
        {est.next ? (
          <>
            <div style={{ margin: '16px 0 6px' }}><Bar pct={est.pct} /></div>
            <div className="row spread small">
              <b>Prochain palier : {est.next.label}</b>
              <span className="muted tnum">encore {toNext} mot{toNext > 1 ? 's' : ''}</span>
            </div>
          </>
        ) : (
          <p className="muted small" style={{ margin: '12px 0 0' }}>Tu as atteint tous les paliers du deck. Bravo !</p>
        )}

        {/* Les paliers : atteint / en cours / à venir */}
        <div className="milestones">
          {MILESTONES.slice(1).map((m) => {
            const reached = prog.wordsKnownR >= m.at
            const current = est.next?.id === m.id
            return (
              <div key={m.id} className={'ms' + (reached ? ' done' : current ? ' now' : '')}>
                <span className="ms-dot">{reached ? '✓' : current ? '•' : ''}</span>
                <span className="ms-label">{m.label}</span>
                <span className="muted small tnum">{m.cefr} · {m.at} mots</span>
              </div>
            )
          })}
        </div>
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          Estimation indicative d'après les mots que tu retiens vraiment (intervalle ≥ 3 jours). Le JLPT teste aussi la grammaire, les kanji et l'écoute.
        </p>
      </div>

      {/* Niveau par niveau */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 14 }}>Mots retenus, niveau par niveau</div>
        <div className="stack" style={{ gap: 18 }}>
          {reports.map((r) => (
            <div key={r.lvl}>
              <div className="row spread" style={{ alignItems: 'baseline' }}>
                <b style={{ fontSize: 17 }}>{r.lvl}</b>
                <span className="tnum"><b>{r.known}</b><span className="muted"> / {r.total} · {pctTxt(r.pct)}</span></span>
              </div>
              <div style={{ margin: '6px 0 8px' }}><Bar pct={r.pct} thin /></div>
              <div className="muted small tnum">{r.seen === 0 ? `${r.total} mots à découvrir` : `${r.solid} solides (≥ 21 j) · ${r.seen} vus · ${r.total - r.seen} à découvrir`}</div>
              {r.seen > 0 && (
              <div className="slices">
                {r.byPos.map((p) => (
                  <div key={p.id} className="slice">
                    <span>{p.label}</span>
                    <div className="slice-bar"><i style={{ width: `${Math.round(p.pct * 100)}%` }} /></div>
                    <span className="tnum muted">{pctTxt(p.pct)}</span>
                  </div>
                ))}
              </div>
              )}
              {best[r.lvl as (typeof EXAM_LEVELS)[number]]?.passed && <span className="chip good" style={{ marginTop: 8 }}>✓ Examen {r.lvl} validé</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Thèmes : ce que je sais / ce qui reste */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Par thème</div>
        {strong.length > 0 && (
          <>
            <div className="muted small caps" style={{ marginBottom: 8 }}>Déjà solide</div>
            <div className="slices" style={{ marginTop: 0 }}>
              {strong.map((t) => (
                <div key={t.id} className="slice">
                  <span>{t.emoji} {t.label}</span>
                  <div className="slice-bar good"><i style={{ width: `${Math.round(t.pct * 100)}%` }} /></div>
                  <span className="tnum muted">{pctTxt(t.pct)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="muted small caps" style={{ margin: '14px 0 8px' }}>À renforcer</div>
        <div className="slices" style={{ marginTop: 0 }}>
          {weak.map((t) => (
            <div key={t.id} className="slice">
              <span>{t.emoji} {t.label}</span>
              <div className="slice-bar"><i style={{ width: `${Math.round(t.pct * 100)}%` }} /></div>
              <span className="tnum muted">{pctTxt(t.pct)}</span>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>Astuce : « Réviser librement » te laisse travailler un thème précis.</p>
      </div>

      {/* Lecture sans aide */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Lecture sans béquille</div>
        <p className="muted small" style={{ margin: '0 0 12px' }}>Plus un mot est solide, moins l'app t'aide à le lire.</p>
        <div className="row" style={{ gap: 10 }}>
          <motion.div className="grow aid-tile" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <b className="tnum">{aid.noRomaji}</b>
            <span>mots lus sans rōmaji<br />(≥ {AID_KANA_AT} jours)</span>
          </motion.div>
          <motion.div className="grow aid-tile" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <b className="tnum">{aid.noAid}</b>
            <span>mots lus sans aucune aide<br />(≥ {AID_NONE_AT} jours)</span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
