import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useStore } from './lib/store'
import { startSync } from './lib/sync'
import { countDue, ALL } from './lib/queue'
import { Icon } from './components/ui'
import { Home } from './components/Home'
import { Library } from './components/Library'
import { Progress } from './components/Progress'
import { Settings } from './components/Settings'
import { Study } from './components/Study'
import { AddCard } from './components/AddCard'
import { autoSnapshot } from './lib/snapshots'

type Tab = 'home' | 'library' | 'progress' | 'settings'
const TABS: Array<{ id: Tab; label: string; icon: (a?: boolean) => JSX.Element }> = [
  { id: 'home', label: 'Aujourd\'hui', icon: Icon.home },
  { id: 'library', label: 'Cartes', icon: Icon.cards },
  { id: 'progress', label: 'Progrès', icon: Icon.chart },
  { id: 'settings', label: 'Réglages', icon: Icon.gear }
]

function applyTheme(theme: 'auto' | 'light' | 'dark') {
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

function Toasts() {
  const { toasts, dismissToast } = useStore()
  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => dismissToast(t.id), 4200))
    return () => timers.forEach(clearTimeout)
  }, [toasts, dismissToast])
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className="toast"
            layout
            initial={{ y: -60, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            onClick={() => dismissToast(t.id)}
          >
            <span className="e">{t.emoji}</span>
            <div><b>{t.title}</b><span>{t.text}</span></div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  const { ready, init, session, state, items, confettiTick } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    init()
    void startSync()
    // copie hebdomadaire de sécurité (après le chargement de la progression)
    const t = setTimeout(() => void autoSnapshot(useStore.getState().state), 4000)
    // v1.6 : défis du jour et trophées déjà gagnés, vérifiés une fois la synchro terminée (jamais pendant)
    const r = setTimeout(() => {
      const st = useStore.getState()
      if (st.sync.status !== 'syncing') st.refreshRewards()
    }, 6000)
    return () => {
      clearTimeout(t)
      clearTimeout(r)
    }
  }, [init])

  useEffect(() => {
    if (!ready) return
    applyTheme(state.settings.theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => applyTheme(useStore.getState().state.settings.theme)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [ready, state.settings.theme])

  useEffect(() => {
    if (!confettiTick) return
    const base = { spread: 70, ticks: 160, gravity: 0.9, colors: ['#5e5ce6', '#9b5cf6', '#ff7ab8', '#ffd60a', '#30d158'] }
    confetti({ ...base, particleCount: 70, origin: { x: 0.5, y: 0.35 } })
    setTimeout(() => confetti({ ...base, particleCount: 40, angle: 60, origin: { x: 0, y: 0.6 } }), 150)
    setTimeout(() => confetti({ ...base, particleCount: 40, angle: 120, origin: { x: 1, y: 0.6 } }), 150)
  }, [confettiTick])

  const dueTotal = useMemo(() => countDue(state, items, ALL, Date.now()).total, [state, items])

  if (!ready) return <div className="app" />

  const openAdd = (id: string | null = null) => {
    setEditId(id)
    setAddOpen(true)
  }

  return (
    <div className="app">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="screen"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'home' && <Home onAdd={() => openAdd()} />}
          {tab === 'library' && <Library onEdit={(id) => openAdd(id)} />}
          {tab === 'progress' && <Progress />}
          {tab === 'settings' && <Settings />}
        </motion.div>
      </AnimatePresence>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.icon(tab === t.id)}
            {t.label}
            {t.id === 'home' && dueTotal > 0 && <span className="dot tnum">{dueTotal > 99 ? '99+' : dueTotal}</span>}
          </button>
        ))}
      </nav>

      <AnimatePresence>{session && <Study key="study" />}</AnimatePresence>
      <AddCard open={addOpen} editId={editId} onClose={() => setAddOpen(false)} />
      <Toasts />
    </div>
  )
}
