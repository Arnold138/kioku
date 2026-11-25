import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Item } from '../lib/deck'
import type { Rating } from '../lib/scheduler'
import { canSpeak, speak } from '../lib/tts'
import { blockPool, gapPuzzle, gapRating, type SentenceBlocks } from '../lib/blocks'
import { toRomaji } from '../lib/romaji'

export interface GapResult { rating: Rating; note: string }

const clean = (s: string) => s.replace(/[、。！？!?]$/, '')
const say = (t: string) => { if (canSpeak()) void speak(t) }
/** v1.20 : le rōmaji en tout petit sous chaque morceau, pour reconnaître un mot dont on ne connaît pas les kanji. */
const Ro0 = ({ kana }: { kana: string }) => <small className="gap-ro">({toRomaji(kana.replace(/\s+/g, ' ').trim())})</small>

/**
 * v1.19 — Phrase à trous par blocs : la traduction, la phrase avec 1 ou 2 blocs manquants, et des blocs à choisir.
 * Rapide : on touche les bons blocs, la carte se retourne toute seule.
 */
export function GapCard({ it, sb, seed, onDone, noRo }: { it: Item; sb: SentenceBlocks; seed: number; onDone: (r: GapResult) => void; noRo?: boolean }) {
  const Ro = noRo ? () => null : Ro0
  const pz = useMemo(() => gapPuzzle(sb, seed, blockPool(it.id)), [sb, seed, it.id])
  const [filled, setFilled] = useState(0)
  const [errs, setErrs] = useState(0)
  const [shake, setShake] = useState<string | null>(null)
  const [used, setUsed] = useState<string[]>([])
  const [bad, setBad] = useState<string[]>([])
  const done = filled === pz.gaps.length

  const pick = (c: (typeof pz.choices)[number]) => {
    if (done || used.includes(c.key)) return
    const want = sb.blocks[pz.gaps[filled]]
    if (c.ok && clean(c.jp) === clean(want.jp)) {
      const n = filled + 1
      setFilled(n)
      setUsed((u) => [...u, c.key])
      if (n === pz.gaps.length) {
        say(it.kana || it.jp)
        const r = gapRating(errs)
        window.setTimeout(() => onDone({ rating: r, note: errs ? `${errs} erreur${errs > 1 ? 's' : ''}` : 'Sans erreur ✓' }), 650)
      }
    } else {
      setErrs((e) => e + 1)
      if (!c.ok) setBad((b) => [...b, c.key]) // un intrus touché ne peut plus être choisi
      setShake(c.key)
      window.setTimeout(() => setShake(null), 420)
    }
  }

  return (
    <div className="face front blk-face gap-face" onClick={(e) => e.stopPropagation()}>
      <div className="blk-body">
        <div className="meaning long">{it.fr}</div>
        <div className={'blk-line' + (done ? ' gap-ok' : '')}>
          {sb.blocks.map((b, i) => {
            const g = pz.gaps.indexOf(i)
            if (g < 0) return <span key={i} className="gap-txt"><span className="jp">{clean(b.jp)}</span><Ro kana={b.sp ?? b.kana} /></span>
            if (g < filled) return <span key={i} className="blk in gap-fill"><span className="jp">{clean(b.jp)}</span><Ro kana={b.sp ?? b.kana} /></span>
            return <span key={i} className={'blk-slot' + (g === filled ? ' next' : '')} aria-label="bloc manquant">？</span>
          })}
        </div>
        <div className="blk-pool">
          {pz.choices.map((c) => (
            <motion.div key={c.key} animate={shake === c.key ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
              <button type="button" className={'blk choice' + (used.includes(c.key) ? ' used' : '') + (bad.includes(c.key) ? ' bad' : '')} disabled={done || used.includes(c.key) || bad.includes(c.key)} onClick={() => pick(c)}>
                <span className="jp">{clean(c.jp)}</span>
                {c.kana && <Ro kana={c.sp ?? c.kana} />}
              </button>
            </motion.div>
          ))}
        </div>
        {!done && <button type="button" className="known-btn" onClick={() => onDone({ rating: gapRating(errs, true), note: 'Pas trouvée cette fois' })}>Je ne sais pas — voir la réponse</button>}
      </div>
    </div>
  )
}
