import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import type { Item } from '../lib/deck'
import { isKnown } from '../lib/scheduler'
import { speak, canSpeak } from '../lib/tts'
import { checkTyped } from '../lib/typing'
import { Sheet } from './ui'

type Mode = 'sens' | 'dictee'
type Src = 'words' | 'sentences'
const ROUND = 10

interface Q {
  item: Item
  choices: string[] // sens uniquement
  answer: string
}

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/** Choisit les mots/phrases du tour : d'abord ceux que tu connais déjà (on t'évalue sur du connu), complétés si besoin. */
function pickQuestions(items: Item[], cards: ReturnType<typeof useStore.getState>['state']['cards'], mode: Mode, src: Src): Q[] {
  const kind = mode === 'dictee' ? 'word' : src === 'words' ? 'word' : 'sentence'
  const pool = items.filter((i) => i.kind === kind && (kind === 'sentence' ? i.jp.length <= 28 : i.kana.length >= 2))
  const seen = pool.filter((i) => {
    const c = cards[`${i.id}:r`]
    return c && c.s !== 'new'
  })
  const known = seen.filter((i) => isKnown(cards[`${i.id}:r`]!))
  const base = shuffle(known.length >= ROUND ? known : seen.length >= ROUND ? seen : pool.filter((i) => i.lvl === 'N5' || seen.includes(i)))
  const chosen = base.slice(0, ROUND)
  return chosen.map((item) => {
    if (mode === 'dictee') return { item, choices: [], answer: item.kana }
    const same = pool.filter((p) => p.id !== item.id && p.fr !== item.fr && (kind === 'sentence' || p.pos === item.pos))
    const wrong = shuffle(same).slice(0, 3).map((p) => p.fr)
    return { item, choices: shuffle([item.fr, ...wrong]), answer: item.fr }
  })
}

export function Listening({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, state, recordListen } = useStore()
  const [mode, setMode] = useState<Mode>('sens')
  const [src, setSrc] = useState<Src>('words')
  const [qs, setQs] = useState<Q[] | null>(null)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [dictOk, setDictOk] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const [xp, setXp] = useState<number | null>(null)
  const savedRef = useRef(false)

  const reset = () => {
    setQs(null)
    setI(0)
    setPicked(null)
    setDraft('')
    setDictOk(null)
    setScore(0)
    setXp(null)
    savedRef.current = false
  }
  useEffect(() => {
    if (!open) reset()
  }, [open])

  const q = qs?.[i]
  const answered = mode === 'sens' ? picked !== null : dictOk !== null
  const done = !!qs && i >= qs.length

  // lecture automatique à chaque question
  useEffect(() => {
    if (q && !answered) speak(q.item.kana || q.item.jp)
  }, [q?.item.id]) // eslint-disable-line

  useEffect(() => {
    if (done && qs && !savedRef.current) {
      savedRef.current = true
      setXp(recordListen({ mode, ok: score, total: qs.length }))
    }
  }, [done]) // eslint-disable-line

  const start = () => {
    const list = pickQuestions(items, state.cards, mode, src)
    reset()
    setQs(list)
  }

  const next = () => {
    setI((n) => n + 1)
    setPicked(null)
    setDraft('')
    setDictOk(null)
  }
  const choose = (c: string) => {
    if (answered || !q) return
    setPicked(c)
    if (c === q.answer) setScore((s) => s + 1)
  }
  const check = () => {
    if (answered || !q || !draft.trim()) return
    const ok = checkTyped(q.item, draft).ok
    setDictOk(ok)
    if (ok) setScore((s) => s + 1)
  }

  const ready = useMemo(() => canSpeak(), [])

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Écoute 🎧</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Entraîne ton oreille : tu entends, tu comprends. Tu gagnes de l'XP ; ça ne change pas ton planning de révision.</p>
        </div>

        {!ready && <div className="typed-result bad" style={{ alignItems: 'flex-start' }}>La voix japonaise n'est pas disponible sur cet appareil.</div>}

        {!qs && (
          <>
            <div>
              <div className="free-sec">Exercice</div>
              <div className="stack" style={{ gap: 8 }}>
                <button className={'mode-opt' + (mode === 'sens' ? ' on' : '')} onClick={() => setMode('sens')}>
                  <div><div className="t">Écoute → sens</div><div className="d">Tu entends du japonais, tu choisis la bonne traduction</div></div>
                </button>
                <button className={'mode-opt' + (mode === 'dictee' ? ' on' : '')} onClick={() => setMode('dictee')}>
                  <div><div className="t">Dictée</div><div className="d">Tu entends un mot, tu l'écris en rōmaji ou en kana</div></div>
                </button>
              </div>
            </div>
            {mode === 'sens' && (
              <div>
                <div className="free-sec">Ce que j'écoute</div>
                <div className="seg">
                  <button className={src === 'words' ? 'on' : ''} onClick={() => setSrc('words')}>Des mots</button>
                  <button className={src === 'sentences' ? 'on' : ''} onClick={() => setSrc('sentences')}>Des phrases</button>
                </div>
              </div>
            )}
            <button className="btn block" disabled={!ready} style={!ready ? { opacity: 0.45 } : undefined} onClick={start}>Commencer · {ROUND} questions</button>
          </>
        )}

        {qs && !done && q && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="row spread small muted"><span>Question {i + 1} / {qs.length}</span><span className="tnum">{score} juste{score > 1 ? 's' : ''}</span></div>
            <div className="bar thin"><i style={{ width: `${(i / qs.length) * 100}%` }} /></div>
            <div className="listen-box">
              <button className="listen-play" onClick={() => speak(q.item.kana || q.item.jp)} aria-label="Réécouter">▶</button>
              <button className="chip btn-chip" onClick={() => speak(q.item.kana || q.item.jp, 0.55)}>🐢 Plus lent</button>
            </div>

            {mode === 'sens' ? (
              <div className="stack" style={{ gap: 8 }}>
                {q.choices.map((c) => {
                  const good = answered && c === q.answer
                  const bad = answered && c === picked && c !== q.answer
                  return (
                    <button key={c} className={'choice' + (good ? ' good' : '') + (bad ? ' bad' : '')} onClick={() => choose(c)}>{c}</button>
                  )
                })}
              </div>
            ) : (
              <form className="typing-form" onSubmit={(e) => { e.preventDefault(); check() }}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ce que tu entends…" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} disabled={answered} aria-label="Dictée" />
                {!answered && <button className="btn" type="submit" disabled={!draft.trim()}>Vérifier</button>}
              </form>
            )}

            {answered && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="stack" style={{ gap: 10 }}>
                <div className="listen-answer">
                  <div className="jp" style={{ fontSize: 24, fontWeight: 700 }}>{q.item.jp}</div>
                  {q.item.kana !== q.item.jp && <div className="kana-line jp">{q.item.kana}</div>}
                  <div className="romaji-line">{q.item.romaji}</div>
                  <div className="muted" style={{ marginTop: 4 }}>{q.item.fr}</div>
                  {mode === 'dictee' && <div className={'typed-result ' + (dictOk ? 'good' : 'bad')} style={{ marginTop: 8 }}>{dictOk ? '✓ Bien entendu' : '✗ Pas tout à fait'}</div>}
                </div>
                <button className="btn block" onClick={next}>{i + 1 >= qs.length ? 'Voir mon score' : 'Suivant'}</button>
              </motion.div>
            )}
          </div>
        )}

        {qs && done && (
          <div className="summary" style={{ paddingTop: 8 }}>
            <div className="emoji">{score >= 8 ? '🎧' : '👂'}</div>
            <h2 style={{ margin: 0, fontSize: 28 }}>{score} / {qs.length}</h2>
            <p className="muted" style={{ margin: 0 }}>{score >= 8 ? 'Ton oreille progresse bien.' : 'Continue : réécouter, c\'est comme ça qu\'on s\'habitue.'}{xp ? ` · +${xp} XP` : ''}</p>
            <button className="btn block" style={{ marginTop: 10 }} onClick={start}>Rejouer</button>
            <button className="btn plain block" onClick={reset}>Changer d'exercice</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
