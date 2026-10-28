import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, animate } from 'framer-motion'
import { useStore } from '../lib/store'
import { computeWrapped, periodLabel, prettyDay, type Period } from '../lib/wrapped'
import { cityStatuses, currentCity } from '../lib/village'
import { shinyCount } from '../lib/shiny'

function Count({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const c = animate(0, to, { duration: 1.1, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [to])
  return <>{v.toLocaleString('fr-FR')}{suffix}</>
}

interface Slide {
  bg: string
  kicker: string
  big: ReactNode
  text: ReactNode
}

/** v1.12 — Kioku Wrapped : ton mois ou ton année en quelques écrans. Touche à droite pour avancer, à gauche pour revenir. */
export function WrappedStory({ period, onClose }: { period: Period; onClose: () => void }) {
  const { state, items } = useStore()
  const w = useMemo(() => computeWrapped(state, items, period), [state, items, period])
  const city = currentCity(cityStatuses(state, items))
  const shiny = shinyCount(state.ach)
  const label = periodLabel(period)
  const ce = period.kind === 'year' ? 'cette année' : 'ce mois-ci'

  const slides: Slide[] = [
    { bg: '#2a1f6b', kicker: 'Kioku Wrapped', big: <span className="jp-display">記憶</span>, text: <>Ton <b>{label}</b> en japonais.<br />Touche l'écran pour avancer.</> },
    { bg: '#7c2d12', kicker: 'Régularité', big: <><Count to={w.days} /> jour{w.days > 1 ? 's' : ''}</>, text: <>passés à apprendre {ce}, pour <b>{w.minutes >= 60 ? `${Math.floor(w.minutes / 60)} h ${String(w.minutes % 60).padStart(2, '0')}` : `${w.minutes} min`}</b> de pratique.{w.bestRun > 1 ? <> Ta meilleure série : <b>{w.bestRun} jours d'affilée</b>.</> : null}</> },
    { bg: '#134e4a', kicker: 'Révisions', big: <><Count to={w.cards} /></>, text: <>cartes révisées{w.accuracy !== null ? <>, avec <b>{w.accuracy} %</b> de cartes retenues</> : null}.{w.bestDay ? <> Ton record : <b>{w.bestDay.n} cartes</b> le {prettyDay(w.bestDay.day)}.</> : null}</> },
    { bg: '#1e3a8a', kicker: 'Nouveaux mots', big: <><Count to={w.newWords} /></>, text: <>mots découverts {ce}. Ta ville en ce moment : <b><span className="jp-display">{city.kanji}</span> {city.name}</b>.</> },
    ...(w.comeback
      ? [{ bg: '#831843', kicker: 'Ta plus belle revanche', big: <span className="jp">{w.comeback.jp}</span>, text: <><b>{w.comeback.fr}</b> : raté {w.comeback.misses} fois… et maintenant retenu.</> }]
      : []),
    ...(w.kanji
      ? [{ bg: '#713f12', kicker: period.kind === 'year' ? 'Ton kanji de l\'année' : 'Ton kanji du moment', big: <span className="jp-display wr-kanji">{w.kanji.ch}</span>, text: <>présent dans <b>{w.kanji.words} des mots</b> que tu as retenus.</> }]
      : []),
    { bg: '#3b0764', kicker: 'Récompenses', big: <><Count to={w.trophies.length} /> trophée{w.trophies.length > 1 ? 's' : ''}</>, text: <>{w.trophies.slice(0, 4).map((t) => t.emoji).join(' ')} {w.trophies.length ? 'gagnés' : 'à gagner'} {ce} · <b>{w.xp.toLocaleString('fr-FR')} XP</b>{w.listens + w.orals ? <> · {w.listens + w.orals} exercices d'écoute et d'oral</> : null}{shiny ? <> · {shiny} carte{shiny > 1 ? 's' : ''} shiny</> : null}.</> },
    { bg: '#1d1640', kicker: 'À suivre', big: <>{label}</>, text: <>Merci d'avoir appris avec Kioku. <b>またね！</b> On continue demain.</> }
  ]

  const [i, setI] = useState(0)
  const s = slides[i]
  const next = () => (i + 1 < slides.length ? setI(i + 1) : onClose())
  const prev = () => setI(Math.max(0, i - 1))
  // avance toute seule au bout de 6 secondes (comme une story)
  useEffect(() => {
    const t = setTimeout(() => setI((k) => (k + 1 < slides.length ? k + 1 : k)), 6000)
    return () => clearTimeout(t)
  }, [i, slides.length])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return createPortal(
    <motion.div className="wrapped" style={{ background: s.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="wr-bars">
        {slides.map((_, k) => (
          <i key={k}><b style={{ width: k < i ? '100%' : k === i ? '100%' : '0%', transition: k === i ? 'width 6s linear' : 'none' }} /></i>
        ))}
      </div>
      <button className="wr-x" onClick={onClose} aria-label="Fermer">✕</button>
      <button className="wr-zone left" onClick={prev} aria-label="Précédent" />
      <button className="wr-zone right" onClick={next} aria-label="Suivant" />
      <AnimatePresence mode="wait">
        <motion.div key={i} className="wr-slide" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
          <span className="wr-kicker">{s.kicker}</span>
          <div className="wr-big">{s.big}</div>
          <p className="wr-text">{s.text}</p>
        </motion.div>
      </AnimatePresence>
    </motion.div>,
    document.body
  )
}

/** Carte d'entrée (page Progrès) : ce mois-ci, le mois dernier, cette année. */
export function WrappedCard() {
  const now = new Date()
  const [period, setPeriod] = useState<Period | null>(null)
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const prevM: Period = m === 1 ? { kind: 'month', year: y - 1, month: 12 } : { kind: 'month', year: y, month: m - 1 }
  const opts: Array<[string, Period]> = [
    [periodLabel({ kind: 'month', year: y, month: m }), { kind: 'month', year: y, month: m }],
    [periodLabel(prevM), prevM],
    [`Année ${y}`, { kind: 'year', year: y }]
  ]
  return (
    <>
      <div className="wr-card">
        <span className="wr-card-bg jp-display" aria-hidden="true">記憶</span>
        <span className="caps-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Kioku Wrapped</span>
        <b style={{ fontSize: 20 }}>Ton récap, en quelques écrans</b>
        <div className="wr-opts">
          {opts.map(([l, p]) => (
            <button key={l} onClick={() => setPeriod(p)}>{l}</button>
          ))}
        </div>
      </div>
      <AnimatePresence>{period && <WrappedStory key="wr" period={period} onClose={() => setPeriod(null)} />}</AnimatePresence>
    </>
  )
}
