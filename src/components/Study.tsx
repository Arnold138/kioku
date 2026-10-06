import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { parseCardId, POS_LABEL, type Item } from '../lib/deck'
import { RATING_LABELS, dayNumber, newCard, previewLabels, type Rating } from '../lib/scheduler'
import { dayTotal, streaks, levelFromXp, totalXp, computeProgress } from '../lib/state'
import { estimateLevel } from '../lib/level'
import { countDue } from '../lib/queue'
import { aidLevel, type Aid } from '../lib/aid'
import { contextFor } from '../lib/context'
import { LEECH_AT } from '../lib/insights'
import { dayKey } from '../lib/scheduler'
import { speak, canSpeak } from '../lib/tts'
import { checkTranslation, checkTyped, type TranslationResult, type TypedResult } from '../lib/typing'
import { Icon } from './ui'

const RATE_EMOJI: Record<Rating, string> = { 1: '😣', 2: '😕', 3: '🤔', 4: '🙂', 5: '😎' }

function sizeClass(jp: string, sentence: boolean) {
  if (sentence || jp.length > 9) return 'long'
  if (jp.length > 4) return 'mid'
  return ''
}

function Reading({ it, long, kana = true, romaji = true }: { it: Item; long: boolean; kana?: boolean; romaji?: boolean }) {
  return (
    <>
      {kana && it.kana && it.kana !== it.jp && <div className={'kana-line jp' + (long ? ' long' : '')}>{it.kana}</div>}
      {romaji && <div className={'romaji-line' + (long ? ' long' : '')}>{it.romaji}</div>}
    </>
  )
}

/** Phrases réelles qui utilisent le mot + astuce personnelle. Affiché au verso. */
function Extras({ it, cardKey, ctx, lapses }: { it: Item; cardKey: string; ctx: Item[]; lapses: number }) {
  const memo = useStore((st) => st.state.cards[cardKey]?.m)
  const setMemo = useStore((st) => st.setMemo)
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState('')
  const leech = lapses >= LEECH_AT
  const canMemo = it.kind !== 'sentence'
  return (
    <div className="extras" onClick={(e) => e.stopPropagation()}>
      {leech && <span className="chip warn">🧲 Mot difficile · oublié {lapses} fois</span>}
      {ctx.length > 0 && (
        <div className="ctx">
          <div className="ctx-label">En contexte</div>
          {ctx.map((c) => (
            <div key={c.id} className="ctx-row">
              <div className="jp ctx-jp">{c.jp}</div>
              <div className="ctx-fr">{c.fr}</div>
              <Speak text={c.kana || c.jp} inline />
            </div>
          ))}
        </div>
      )}
      {canMemo &&
        (edit ? (
          <form
            className="memo-form"
            onSubmit={(e) => {
              e.preventDefault()
              setMemo(cardKey, v)
              setEdit(false)
            }}
          >
            <input autoFocus value={v} maxLength={240} onChange={(e) => setV(e.target.value)} placeholder="Une image, un jeu de mots, un indice…" aria-label="Astuce" />
            <button className="btn" type="submit">OK</button>
          </form>
        ) : memo ? (
          <button className="memo" onClick={() => { setV(memo); setEdit(true) }}>💡 {memo}</button>
        ) : (
          <button className={'memo add' + (leech ? ' strong' : '')} onClick={() => { setV(''); setEdit(true) }}>
            {leech ? '＋ Ajouter une astuce pour t\'en souvenir' : '＋ Astuce'}
          </button>
        ))}
    </div>
  )
}

function Speak({ text, inline }: { text: string; inline?: boolean }) {
  if (!canSpeak()) return null
  return (
    <button className={'icon-btn' + (inline ? ' speak-inline' : ' speak')} aria-label="Écouter" onClick={(e) => { e.stopPropagation(); speak(text) }}>
      {Icon.speaker()}
    </button>
  )
}

function Front({ it, dir, reading, typing, aid }: { it: Item; dir: 'r' | 'p'; reading: 'always' | 'tap' | 'never'; typing: boolean; aid: Aid }) {
  const [shown, setShown] = useState(false)
  const long = it.kind === 'sentence' || it.jp.length > 9
  if (dir === 'p') {
    return (
      <div className="face front">
        <span className="chip kind accent">Dis-le en japonais</span>
        <div className={'meaning' + (it.fr.length > 22 ? ' long' : '')}>{it.fr}</div>
        {it.kind === 'word' && <span className="chip">{POS_LABEL[it.pos] ?? it.pos}</span>}
        <div className="hint">{typing ? 'Écris la réponse en rōmaji ou en kana' : 'Pense à la réponse, puis retourne la carte'}</div>
      </div>
    )
  }
  // Aide à la lecture : tout / sans rōmaji / sans rien (selon la solidité de la carte), un tap affiche tout.
  const mode: Aid = shown ? 'full' : reading === 'always' ? aid : reading === 'tap' ? 'none' : 'none'
  const fadedHelp = reading === 'always' && aid !== 'full'
  return (
    <div className="face front">
      <span className="chip kind">{it.kind === 'sentence' ? 'Phrase' : it.lvl}</span>
      <Speak text={it.kana || it.jp} />
      <div className={'word-jp jp ' + sizeClass(it.jp, it.kind === 'sentence')}>{it.jp}</div>
      {mode === 'full' ? (
        <Reading it={it} long={long} />
      ) : mode === 'kana' ? (
        <>
          <Reading it={it} long={long} romaji={false} />
          <button className="reading-hidden" onClick={(e) => { e.stopPropagation(); setShown(true) }}>Voir le rōmaji</button>
        </>
      ) : reading === 'tap' || fadedHelp ? (
        <button className="reading-hidden" onClick={(e) => { e.stopPropagation(); setShown(true) }}>Voir la lecture</button>
      ) : null}
      {it.kind === 'sentence' && <div className="hint">Que veut dire cette phrase ?</div>}
    </div>
  )
}

function Back({ it, dir, typed, tr, extras }: { it: Item; dir: 'r' | 'p'; typed: TypedResult | null; tr: TranslationResult | null; extras: JSX.Element }) {
  const long = it.kind === 'sentence' || it.jp.length > 9
  if (dir === 'p') {
    return (
      <div className="face back">
        <Speak text={it.kana || it.jp} />
        {typed && typed.script !== 'vide' && (
          <div className={'typed-result ' + (typed.ok ? 'good' : 'bad')}>
            {typed.ok ? '✓ Bonne réponse' : '✗ Pas tout à fait'}
            {!typed.ok && <span>Tu as écrit : <b className="jp">{typed.input}</b></span>}
          </div>
        )}
        <div className={'word-jp jp ' + sizeClass(it.jp, it.kind === 'sentence')}>{it.jp}</div>
        <Reading it={it} long={long} />
        <div className="divider" />
        <div className="hint">{it.fr}</div>
        {extras}
      </div>
    )
  }
  return (
    <div className="face back">
      <Speak text={it.kana || it.jp} />
      <div className="jp" style={{ fontSize: long ? 20 : 30, fontWeight: 700 }}>{it.jp}</div>
      <Reading it={it} long={long} />
      <div className="divider" />
      {tr && tr.verdict !== 'vide' && (
        <div className={'typed-result tr ' + tr.verdict}>
          <b>{tr.verdict === 'ok' ? '✓ Très proche' : tr.verdict === 'close' ? '≈ En partie' : '✗ Assez loin'}</b>
          <span>Ta traduction : <i>{tr.input}</i></span>
          {tr.missing.length > 0 && tr.verdict !== 'ok' && <span>Mots à retrouver : {tr.missing.join(' · ')}</span>}
        </div>
      )}
      <div className={'meaning' + (it.fr.length > 24 ? ' long' : '')}>{it.fr}</div>
      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
        {it.kind === 'word' && <span className="chip">{POS_LABEL[it.pos] ?? it.pos}</span>}
        <span className="chip">{it.lvl}</span>
        {it.note && <span className="chip accent">{it.note}</span>}
      </div>
      {extras}
    </div>
  )
}

export function Study() {
  const { session: s, byId, items, state, endSession, reveal, rate, markKnown, undo, startSession, updateSettings } = useStore()
  const now = Date.now()
  const today = dayNumber(now)

  const [typed, setTyped] = useState<TypedResult | null>(null)
  const [tr, setTr] = useState<TranslationResult | null>(null)
  const [draft, setDraft] = useState('')
  const cardKey = s?.current ?? null
  const parsed = cardKey ? parseCardId(cardKey) : null
  const item = parsed ? byId.get(parsed.itemId) : undefined
  const card = cardKey ? state.cards[cardKey] ?? newCard(now) : null
  const labels = useMemo(() => (card ? previewLabels(card, now, today) : null), [cardKey, s?.revealed]) // eslint-disable-line

  const aid = item ? aidLevel(state.cards[`${item.id}:r`], item, state.settings.fade) : 'full'
  const ctx = useMemo(() => (item && item.kind === 'word' ? contextFor(item, items) : []), [item, items])
  const lapses = card?.l ?? 0

  // Gestes (iPhone) : une fois la carte retournée, glisser à droite = Bien, à gauche = Oublié.
  const [dx, setDx] = useState(0)
  const swipe = useRef<{ x: number; y: number; active: boolean } | null>(null)
  const swipeOn = !!s && state.settings.swipe && s.revealed && !!s.current && !s.finished
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!swipeOn || (e.target as HTMLElement).closest('input,textarea,button,form')) return
    swipe.current = { x: e.clientX, y: e.clientY, active: false }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = swipe.current
    if (!g) return
    const mx = e.clientX - g.x
    const my = e.clientY - g.y
    if (!g.active) {
      if (Math.abs(my) > 14 && Math.abs(my) > Math.abs(mx)) {
        swipe.current = null
        return
      }
      if (Math.abs(mx) > 14 && Math.abs(mx) > Math.abs(my) * 1.4) {
        g.active = true
        e.currentTarget.setPointerCapture(e.pointerId)
      } else return
    }
    setDx(Math.max(-220, Math.min(220, mx)))
  }
  const onUp = () => {
    const g = swipe.current
    swipe.current = null
    const moved = dx
    setDx(0)
    if (!g?.active || !swipeOn) return
    if (moved > 105) rate(4)
    else if (moved < -105) rate(1)
  }

  // la saisie repart de zéro à chaque carte
  useEffect(() => {
    setDraft('')
    if (!useStore.getState().session?.revealed) {
      setTyped(null)
      setTr(null)
    }
  }, [cardKey]) // eslint-disable-line
  useEffect(() => {
    if (!s?.revealed) {
      setTyped(null)
      setTr(null)
    }
  }, [s?.revealed]) // eslint-disable-line

  // Lecture audio automatique
  useEffect(() => {
    if (!item || !parsed || !state.settings.autoPlay) return
    if (parsed.dir === 'r' && !s?.revealed) speak(item.kana || item.jp)
    if (parsed.dir === 'p' && s?.revealed) speak(item.kana || item.jp)
  }, [cardKey, s?.revealed]) // eslint-disable-line

  // Raccourcis clavier (PC) : espace = retourner, 1-5 = noter, Z = annuler
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
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
    const deferred = s.filter.free || s.practice ? 0 : countDue(state, items, s.filter, now).deferred
    const prog = computeProgress(state, items)
    const est = estimateLevel(prog.wordsKnownR)
    const toNext = est.next ? Math.max(0, est.next.at - prog.wordsKnownR) : 0
    return (
      <motion.div className="study" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="study-top">
          <button className="icon-btn" onClick={endSession} aria-label="Fermer">{Icon.close()}</button>
          <div className="study-progress"><i style={{ width: '100%' }} /></div>
        </div>
        <div className="summary">
          {s.practice && s.answered > 0 ? (
            <>
              <motion.div className="emoji" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>🏋️</motion.div>
              <h2 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.02em' }}>Entraînement terminé</h2>
              <p className="muted" style={{ margin: 0, maxWidth: 320 }}>Ton planning de révision n'a pas changé : cette séance était juste pour t'exercer.</p>
              <div className="stat-grid">
                <div className="stat"><b>{s.answered}</b><span>réponses</span></div>
                <div className="stat"><b>{acc}%</b><span>retenues</span></div>
                <div className="stat"><b>{mins}</b><span>min</span></div>
              </div>
              <button className="btn block" style={{ marginTop: 14 }} onClick={endSession}>Terminer</button>
              <button className="btn plain block" onClick={() => startSession(s.filter, s.extra, { typeTr: s.typeTr })}>Recommencer</button>
            </>
          ) : s.answered === 0 ? (
            <>
              <motion.div className="emoji" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>✨</motion.div>
              <h2 style={{ margin: 0, fontSize: 28 }}>{s.practice || s.filter.free ? 'Aucune carte avec ces choix' : 'Rien à réviser pour l\'instant'}</h2>
              <p className="muted" style={{ maxWidth: 320 }}>
                {s.practice
                  ? 'Tu n\'as pas encore vu de cartes dans cette catégorie. Essaie « Nouvelles cartes » pour les découvrir.'
                  : s.filter.free
                    ? 'Il n\'y a rien à revoir ni de nouvelle carte ici. Essaie « S\'entraîner » ou une autre catégorie.'
                    : 'Tes révisions sont à jour. Tu peux apprendre quelques cartes de plus, ou revenir plus tard.'}
              </p>
              {!s.practice && !s.filter.free && <button className="btn" onClick={() => startSession(s.filter, s.extra + 10)}>Apprendre 10 cartes de plus</button>}
              <button className="btn plain" onClick={endSession}>Fermer</button>
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
              <div className="sum-prog">
                <div className="row spread small"><b>Niveau {lv.level}</b><span className="muted tnum">{lv.next - totalXp(state)} XP avant le niveau {lv.level + 1}</span></div>
                <div className="bar thin"><i style={{ width: `${Math.round(lv.pct * 100)}%` }} /></div>
                {est.next && (
                  <div className="row spread small" style={{ marginTop: 10 }}>
                    <b>{est.milestone.label}</b>
                    <span className="muted tnum">encore {toNext} mot{toNext > 1 ? 's' : ''} pour « {est.next.label} »</span>
                  </div>
                )}
                {est.next && <div className="bar thin"><i style={{ width: `${Math.round(est.pct * 100)}%` }} /></div>}
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                {mins} min{s.newSeen > 0 ? ` · ${s.newSeen} nouvelle${s.newSeen > 1 ? 's' : ''} carte${s.newSeen > 1 ? 's' : ''} découverte${s.newSeen > 1 ? 's' : ''}` : ''}
                {deferred > 0 ? ` · ${deferred} révision${deferred > 1 ? 's' : ''} reportée${deferred > 1 ? 's' : ''} à demain` : ''}
              </p>
              <button className="btn block" style={{ marginTop: 10 }} onClick={endSession}>Terminer</button>
              {deferred > 0 && (
                <button className="btn plain block" onClick={() => startSession({ ...s.filter, moreReviews: 10 }, s.extra, { typeTr: s.typeTr })}>Encore 10 révisions</button>
              )}
              <button className="btn plain block" onClick={() => startSession(s.filter, s.extra + 10, { typeTr: s.typeTr })}>{deferred > 0 ? 'Découvrir 10 nouvelles cartes' : 'Encore 10 cartes'}</button>
            </>
          )}
        </div>
      </motion.div>
    )
  }

  const isNew = card!.s === 'new'
  const stageLabel = s.practice ? 'Entraînement' : isNew ? 'Nouvelle' : card!.s === 'review' ? 'Révision' : 'En cours'
  const typingOn = state.settings.typing && parsed!.dir === 'p'
  const trOn = s.typeTr && parsed!.dir === 'r'
  const remaining = s.queue.length + s.learn.length
  // note suggérée par la vérification d'une réponse écrite
  const suggested: Rating | null =
    typed && typed.script !== 'vide' ? (typed.ok ? 4 : 1) : tr && tr.verdict !== 'vide' ? (tr.verdict === 'ok' ? 4 : tr.verdict === 'close' ? 3 : 1) : null

  return (
    <motion.div className="study" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
      <div className="study-top">
        <button className="icon-btn" onClick={endSession} aria-label="Fermer">{Icon.close()}</button>
        <div className="study-progress"><motion.i animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></div>
        <button className="icon-btn" onClick={undo} disabled={!s.undo} aria-label="Annuler">{Icon.undo()}</button>
      </div>
      <div className="study-meta">
        {s.warm.includes(cardKey!) && <span className="chip accent">📝 Échauffement</span>}
        <span className={'chip ' + (isNew || s.practice ? 'accent' : '')}>{stageLabel}</span>
        <span className="chip tnum">{remaining + 1} restante{remaining ? 's' : ''}</span>
        {parsed!.dir === 'p' && !s.revealed && (
          <button className="known-btn" onClick={() => updateSettings({ typing: !state.settings.typing })}>
            {state.settings.typing ? '✋ Je réponds dans ma tête' : '⌨️ Écrire la réponse'}
          </button>
        )}
        {isNew && !s.practice && parsed!.dir === 'r' && !s.revealed && (
          <button className="known-btn" onClick={markKnown}>Je connais déjà</button>
        )}
      </div>

      <div
        className={'stage' + (swipeOn ? ' swipeable' : '')}
        onClick={() => !s.revealed && reveal()}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {swipeOn && (
          <>
            <div className="swipe-tag left" style={{ opacity: Math.min(1, Math.max(0, -dx - 20) / 85) }}>😣 Oublié</div>
            <div className="swipe-tag right" style={{ opacity: Math.min(1, Math.max(0, dx - 20) / 85) }}>Bien 🙂</div>
          </>
        )}
        <div className="swipe-wrap" style={dx ? { transform: `translateX(${dx * 0.6}px) rotate(${dx / 40}deg)`, transition: 'none' } : undefined}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={cardKey}
            className="flip"
            initial={{ x: 60, opacity: 0, rotateY: 0 }}
            animate={{ x: 0, opacity: 1, rotateY: s.revealed ? 180 : 0 }}
            exit={{ x: -70, opacity: 0, transition: { duration: 0.18 } }}
            transition={{ rotateY: { type: 'spring', stiffness: 220, damping: 24 }, x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
          >
            <Front it={item} dir={parsed!.dir} reading={state.settings.reading} typing={typingOn} aid={aid} />
            <Back it={item} dir={parsed!.dir} typed={typed} tr={tr} extras={<Extras it={item} cardKey={`${item.id}:r`} ctx={ctx} lapses={lapses} />} />
          </motion.div>
        </AnimatePresence>
        </div>
      </div>

      <div className="study-bottom">
        {!s.revealed && trOn ? (
          <form
            className="typing-form"
            onSubmit={(e) => {
              e.preventDefault()
              setTr(checkTranslation(item, draft))
              reveal()
            }}
          >
            <textarea
              key={cardKey}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  setTr(checkTranslation(item, draft))
                  reveal()
                }
              }}
              placeholder={item.kind === 'sentence' ? 'Écris la traduction en français…' : 'Écris le sens en français…'}
              rows={item.kind === 'sentence' ? 2 : 1}
              autoCapitalize="sentences"
              autoComplete="off"
              enterKeyHint="go"
              aria-label="Ta traduction"
            />
            <button className="btn" type="submit">Vérifier</button>
            <button className="known-btn" type="button" onClick={() => { setTr(null); reveal() }}>Je ne sais pas — voir la réponse</button>
          </form>
        ) : !s.revealed && typingOn ? (
          <form
            className="typing-form"
            onSubmit={(e) => {
              e.preventDefault()
              setTyped(checkTyped(item, draft))
              reveal()
            }}
          >
            <input
              key={cardKey}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="konnichiwa / こんにちは"
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-label="Ta réponse"
            />
            <button className="btn" type="submit">Vérifier</button>
            <button className="known-btn" type="button" onClick={() => { setTyped(null); reveal() }}>Je ne sais pas — voir la réponse</button>
          </form>
        ) : !s.revealed ? (
          <button className="btn show-btn" onClick={reveal}>Afficher la réponse</button>
        ) : (
          <>
          {swipeOn && s.answered < 2 && !s.practice && <div className="swipe-hint">↔ Glisse la carte : à droite « Bien », à gauche « Oublié »</div>}
          <div className="rate-grid">
            {([1, 2, 3, 4, 5] as Rating[]).map((r) => (
              <button key={r} className={`rate r${r}` + (suggested === r ? ' suggest' : '')} onClick={() => rate(r)}>
                <span className="emo">{RATE_EMOJI[r]}</span>
                {RATING_LABELS[r]}
                <small>{s.practice ? '\u00a0' : labels?.[r]}</small>
              </button>
            ))}
          </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
