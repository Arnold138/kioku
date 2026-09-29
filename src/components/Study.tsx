import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { parseCardId, POS_LABEL, type Item } from '../lib/deck'
import { RATING_LABELS, dayNumber, newCard, previewLabels, type Rating } from '../lib/scheduler'
import { dayTotal, streaks, levelFromXp, totalXp } from '../lib/state'
import { dayKey } from '../lib/scheduler'
import { speak, canSpeak } from '../lib/tts'
import { Icon } from './ui'

const RATE_EMOJI: Record<Rating, string> = { 1: '😣', 2: '😕', 3: '🤔', 4: '🙂', 5: '😎' }

function sizeClass(jp: string, sentence: boolean) {
  if (sentence || jp.length > 9) return 'long'
  if (jp.length > 4) return 'mid'
  return ''
}

function Reading({ it, long }: { it: Item; long: boolean }) {
  return (
    <>
      {it.kana && it.kana !== it.jp && <div className={'kana-line jp' + (long ? ' long' : '')}>{it.kana}</div>}
      <div className={'romaji-line' + (long ? ' long' : '')}>{it.romaji}</div>
    </>
  )
}

function Speak({ text }: { text: string }) {
  if (!canSpeak()) return null
  return (
    <button className="icon-btn speak" aria-label="Écouter" onClick={(e) => { e.stopPropagation(); speak(text) }}>
      {Icon.speaker()}
    </button>
  )
}

function Front({ it, dir, reading }: { it: Item; dir: 'r' | 'p'; reading: 'always' | 'tap' | 'never' }) {
  const [shown, setShown] = useState(false)
  const long = it.kind === 'sentence' || it.jp.length > 9
  if (dir === 'p') {
    return (
      <div className="face front">
        <span className="chip kind accent">Dis-le en japonais</span>
        <div className={'meaning' + (it.fr.length > 22 ? ' long' : '')}>{it.fr}</div>
        {it.kind === 'word' && <span className="chip">{POS_LABEL[it.pos] ?? it.pos}</span>}
        <div className="hint">Pense à la réponse, puis retourne la carte</div>
      </div>
    )
  }
  const showReading = reading === 'always' || (reading === 'tap' && shown)
  return (
    <div className="face front">
      <span className="chip kind">{it.kind === 'sentence' ? 'Phrase' : it.lvl}</span>
      <Speak text={it.kana || it.jp} />
      <div className={'word-jp jp ' + sizeClass(it.jp, it.kind === 'sentence')}>{it.jp}</div>
      {showReading ? (
        <Reading it={it} long={long} />
      ) : reading === 'tap' ? (
        <button className="reading-hidden" onClick={(e) => { e.stopPropagation(); setShown(true) }}>Voir la lecture</button>
      ) : null}
      {it.kind === 'sentence' && <div className="hint">Que veut dire cette phrase ?</div>}
    </div>
  )
}

function Back({ it, dir }: { it: Item; dir: 'r' | 'p' }) {
  const long = it.kind === 'sentence' || it.jp.length > 9
  if (dir === 'p') {
    return (
      <div className="face back">
        <Speak text={it.kana || it.jp} />
        <div className={'word-jp jp ' + sizeClass(it.jp, it.kind === 'sentence')}>{it.jp}</div>
        <Reading it={it} long={long} />
        <div className="divider" />
        <div className="hint">{it.fr}</div>
      </div>
    )
  }
  return (
    <div className="face back">
      <Speak text={it.kana || it.jp} />
      <div className="jp" style={{ fontSize: long ? 20 : 30, fontWeight: 700 }}>{it.jp}</div>
      <Reading it={it} long={long} />
      <div className="divider" />
      <div className={'meaning' + (it.fr.length > 24 ? ' long' : '')}>{it.fr}</div>
      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
        {it.kind === 'word' && <span className="chip">{POS_LABEL[it.pos] ?? it.pos}</span>}
        <span className="chip">{it.lvl}</span>
        {it.note && <span className="chip accent">{it.note}</span>}
      </div>
    </div>
  )
}

export function Study() {
  const { session: s, byId, state, endSession, reveal, rate, markKnown, undo, startSession } = useStore()
  const now = Date.now()
  const today = dayNumber(now)

  const cardKey = s?.current ?? null
  const parsed = cardKey ? parseCardId(cardKey) : null
  const item = parsed ? byId.get(parsed.itemId) : undefined
  const card = cardKey ? state.cards[cardKey] ?? newCard(now) : null
  const labels = useMemo(() => (card ? previewLabels(card, now, today) : null), [cardKey, s?.revealed]) // eslint-disable-line

  // Lecture audio automatique
  useEffect(() => {
    if (!item || !parsed || !state.settings.autoPlay) return
    if (parsed.dir === 'r' && !s?.revealed) speak(item.kana || item.jp)
    if (parsed.dir === 'p' && s?.revealed) speak(item.kana || item.jp)
  }, [cardKey, s?.revealed]) // eslint-disable-line

  // Raccourcis clavier (PC) : espace = retourner, 1-5 = noter, Z = annuler
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const st = useStore.getState().session
      if (!st || st.finished) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!st.revealed) reveal()
      } else if (st.revealed && '12345'.includes(e.key) && e.key.length === 1) rate(Number(e.key) as Rating)
      else if (e.key.toLowerCase() === 'z') undo()
      else if (e.key === 'Escape') endSession()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [reveal, rate, undo, endSession])

  if (!s) return null
  const pct = s.total ? Math.min(1, s.done / s.total) : 1

  // ── Fin de séance
  if (s.finished || !cardKey || !item) {
    const day = dayKey(today)
    const st = streaks(state, now)
    const acc = s.answered ? Math.round(((s.answered - s.forgot) / s.answered) * 100) : 0
    const mins = Math.max(1, Math.round((now - s.start) / 60000))
    const lv = levelFromXp(totalXp(state))
    const met = dayTotal(state, day).n >= state.settings.goal
    return (
      <motion.div className="study" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="study-top">
          <button className="icon-btn" onClick={endSession} aria-label="Fermer">{Icon.close()}</button>
          <div className="study-progress"><i style={{ width: '100%' }} /></div>
        </div>
        <div className="summary">
          {s.answered === 0 ? (
            <>
              <motion.div className="emoji" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>✨</motion.div>
              <h2 style={{ margin: 0, fontSize: 28 }}>Rien à réviser pour l'instant</h2>
              <p className="muted" style={{ maxWidth: 320 }}>Tes révisions sont à jour. Tu peux apprendre quelques cartes de plus, ou revenir plus tard.</p>
              <button className="btn" onClick={() => startSession(s.filter, s.extra + 10)}>Apprendre 10 cartes de plus</button>
            </>
          ) : (
            <>
              <motion.div className="emoji" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>{acc >= 80 ? '🎉' : '💪'}</motion.div>
              <h2 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.02em' }}>Séance terminée</h2>
              <p className="muted" style={{ margin: 0 }}>
                {met ? `Objectif du jour atteint · série de ${st.current} jour${st.current > 1 ? 's' : ''} 🔥` : `Encore ${Math.max(0, state.settings.goal - dayTotal(state, day).n)} cartes pour ton objectif du jour`}
              </p>
              <div className="stat-grid">
                <div className="stat"><b>{s.answered}</b><span>cartes</span></div>
                <div className="stat"><b>{acc}%</b><span>retenues</span></div>
                <div className="stat"><b>+{s.xp}</b><span>XP</span></div>
              </div>
              <p className="muted small" style={{ margin: '6px 0 0' }}>Niveau {lv.level} · {mins} min</p>
              {s.newSeen > 0 && <p className="muted small" style={{ margin: 0 }}>{s.newSeen} nouvelle{s.newSeen > 1 ? 's' : ''} carte{s.newSeen > 1 ? 's' : ''} découverte{s.newSeen > 1 ? 's' : ''}</p>}
              <button className="btn block" style={{ marginTop: 14 }} onClick={endSession}>Terminer</button>
              <button className="btn plain block" onClick={() => startSession(s.filter, s.extra + 10)}>Encore 10 cartes</button>
            </>
          )}
        </div>
      </motion.div>
    )
  }

  const isNew = card!.s === 'new'
  const stageLabel = isNew ? 'Nouvelle' : card!.s === 'review' ? 'Révision' : 'En cours'
  const remaining = s.queue.length + s.learn.length

  return (
    <motion.div className="study" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
      <div className="study-top">
        <button className="icon-btn" onClick={endSession} aria-label="Fermer">{Icon.close()}</button>
        <div className="study-progress"><motion.i animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></div>
        <button className="icon-btn" onClick={undo} disabled={!s.undo} aria-label="Annuler">{Icon.undo()}</button>
      </div>
      <div className="study-meta">
        <span className={'chip ' + (isNew ? 'accent' : '')}>{stageLabel}</span>
        <span className="chip tnum">{remaining + 1} restante{remaining ? 's' : ''}</span>
        {isNew && parsed!.dir === 'r' && !s.revealed && (
          <button className="known-btn" onClick={markKnown}>Je connais déjà</button>
        )}
      </div>

      <div className="stage" onClick={() => !s.revealed && reveal()}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={cardKey}
            className="flip"
            initial={{ x: 60, opacity: 0, rotateY: 0 }}
            animate={{ x: 0, opacity: 1, rotateY: s.revealed ? 180 : 0 }}
            exit={{ x: -70, opacity: 0, transition: { duration: 0.18 } }}
            transition={{ rotateY: { type: 'spring', stiffness: 220, damping: 24 }, x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
          >
            <Front it={item} dir={parsed!.dir} reading={state.settings.reading} />
            <Back it={item} dir={parsed!.dir} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="study-bottom">
        {!s.revealed ? (
          <button className="btn show-btn" onClick={reveal}>Afficher la réponse</button>
        ) : (
          <div className="rate-grid">
            {([1, 2, 3, 4, 5] as Rating[]).map((r) => (
              <button key={r} className={`rate r${r}`} onClick={() => rate(r)}>
                <span className="emo">{RATE_EMOJI[r]}</span>
                {RATING_LABELS[r]}
                <small>{labels?.[r]}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
