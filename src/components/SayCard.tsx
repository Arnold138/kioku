import type { Item } from '../lib/deck'
import type { SentenceBlocks } from '../lib/blocks'
import { toRomaji } from '../lib/romaji'
import { canSpeak, speak } from '../lib/tts'

const clean = (s: string) => s.replace(/[、。！？!?]$/, '')
const hashId = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) }

/** v1.21 — 1 phrase sur 3 (déjà vue au moins une fois) se dit de mémoire au lieu de la phrase à trous. */
export const isSayCard = (id: string, reviews: number): boolean => reviews >= 1 && (reviews + hashId(id)) % 3 === 2

/** Recto : la traduction, et tu dis la phrase à voix haute. */
export function SayFront({ it }: { it: Item }) {
  return (
    <div className="face front say-face">
      <div className={'meaning' + (it.fr.length > 26 ? ' long' : '')}>{it.fr}</div>
      <div className="say-mic" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </div>
      <div className="tap-flip">dis la phrase à voix haute</div>
    </div>
  )
}

/** Verso : la phrase en blocs lumineux (kana et rōmaji dessous) ; un bloc touché se fait entendre. */
export function SayBack({ it, sb, noRo }: { it: Item; sb: SentenceBlocks; noRo?: boolean }) {
  return (
    <div className="face back say-face" onClick={(e) => e.stopPropagation()}>
      <div className="meaning long">{it.fr}</div>
      <div className="say-chips">
        {sb.blocks.map((b, i) => (
          <button key={i} type="button" className="say-chip" onClick={() => canSpeak() && void speak(b.kana)}>
            <span className="jp">{clean(b.jp)}</span>
            {b.kana && b.kana.replace(/\s+/g, '') !== clean(b.jp) && <small className="jp">{b.kana}</small>}
            {!noRo && <em>{toRomaji((b.sp ?? b.kana).replace(/\s+/g, ' ').trim())}</em>}
          </button>
        ))}
      </div>
      <div className="tap-flip">touche un bloc pour l'entendre</div>
    </div>
  )
}
