import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { DECKS, deckInfo } from '../lib/deck'
import { POS_GROUPS, buildPractice, buildQueue, type Filter, type PosGroup, type Scope } from '../lib/queue'
import { THEMES } from '../lib/themes'
import { Sheet } from './ui'

const LS = 'kioku:free'
interface Prefs {
  deck: string
  pos: PosGroup
  theme: string
  scope: Scope
  limit: number // 0 = tout
  write: boolean // écrire la traduction avant de retourner la carte
}
const DEFAULTS: Prefs = { deck: 'all', pos: 'all', theme: '', scope: 'normal', limit: 20, write: false }

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(LS)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    /* ignore */
  }
  return DEFAULTS
}

const LIMITS: Array<[number, string]> = [[10, '10'], [20, '20'], [50, '50'], [0, 'Tout']]

/** « Réviser librement » : on choisit le niveau, le type de mots, le thème et le nombre de cartes. */
export function FreeStudy({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, items, startSession } = useStore()
  const [p, setP] = useState<Prefs>(loadPrefs)
  const set = (patch: Partial<Prefs>) => setP((cur) => ({ ...cur, ...patch }))

  useEffect(() => {
    try {
      localStorage.setItem(LS, JSON.stringify(p))
    } catch {
      /* ignore */
    }
  }, [p])

  const wordsOnly = !deckInfo(p.deck)?.sentences
  const base: Filter = useMemo(
    () => ({ deck: p.deck, pos: wordsOnly ? p.pos : 'all', theme: wordsOnly && p.theme ? p.theme : undefined, free: true }),
    [p.deck, p.pos, p.theme, wordsOnly]
  )

  const counts = useMemo(() => {
    if (!open) return { due: 0, fresh: 0, news: 0, practice: 0 }
    const now = Date.now()
    const q = buildQueue(state, items, { ...base, scope: 'normal' }, now)
    const n = buildQueue(state, items, { ...base, scope: 'new' }, now)
    return {
      due: q.learning.length + q.review.length,
      fresh: q.fresh.length + q.freshProd.length,
      news: n.fresh.length + n.freshProd.length,
      practice: buildPractice(state, items, base).length
    }
  }, [open, state, items, base])

  const cap = (n: number) => (p.limit ? Math.min(p.limit, n) : n)
  const total = p.scope === 'normal' ? cap(counts.due + counts.fresh) : p.scope === 'new' ? cap(counts.news) : cap(counts.practice)

  const modes: Array<{ id: Scope; title: string; desc: string; n: number }> = [
    { id: 'normal', title: 'Réviser + découvrir', desc: `${counts.due} à revoir · ${counts.fresh} nouvelles`, n: cap(counts.due + counts.fresh) },
    { id: 'new', title: 'Découvrir du nouveau', desc: 'Seulement des cartes jamais vues', n: cap(counts.news) },
    { id: 'practice', title: "S'entraîner", desc: 'Cartes déjà vues · XP compté, les ratés sont retenus', n: cap(counts.practice) }
  ]

  const go = () => {
    onClose()
    startSession({ ...base, scope: p.scope, limit: p.limit || undefined }, 0, { typeTr: p.write })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      footer={
        <button className="btn block" disabled={total === 0} style={total === 0 ? { opacity: 0.45 } : undefined} onClick={go}>
          {total === 0 ? 'Aucune carte avec ces choix' : `Commencer · ${total} carte${total > 1 ? 's' : ''}`}
        </button>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Réviser librement</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Choisis ce que tu veux travailler, à n'importe quel niveau. Les limites du jour ne s'appliquent pas ici.</p>
        </div>

        <div>
          <div className="free-sec">Niveau</div>
          <div className="chips wrap">
            <button className={'chip btn-chip' + (p.deck === 'all' ? ' active' : '')} onClick={() => set({ deck: 'all' })}>Tout</button>
            {DECKS.map((d) => (
              <button key={d.id} className={'chip btn-chip' + (p.deck === d.id ? ' active' : '')} onClick={() => set({ deck: d.id })}>{d.emoji} {d.name}</button>
            ))}
          </div>
        </div>

        {wordsOnly && (
          <>
            <div>
              <div className="free-sec">Type de mots</div>
              <div className="chips wrap">
                {POS_GROUPS.map((g) => (
                  <button key={g.id} className={'chip btn-chip' + (p.pos === g.id ? ' active' : '')} onClick={() => set({ pos: g.id })}>{g.label}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="free-sec">Thème</div>
              <div className="chips wrap">
                <button className={'chip btn-chip' + (!p.theme ? ' active' : '')} onClick={() => set({ theme: '' })}>Tous</button>
                {THEMES.map((t) => (
                  <button key={t.id} className={'chip btn-chip' + (p.theme === t.id ? ' active' : '')} onClick={() => set({ theme: t.id })}>{t.emoji} {t.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <div className="free-sec">Ce que je veux faire</div>
          <div className="stack" style={{ gap: 8 }}>
            {modes.map((m) => (
              <button key={m.id} className={'mode-opt' + (p.scope === m.id ? ' on' : '')} onClick={() => set({ scope: m.id })}>
                <div>
                  <div className="t">{m.title}</div>
                  <div className="d">{m.desc}</div>
                </div>
                <span className="n">{m.n}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="free-sec">Façon de répondre</div>
          <div className="seg">
            <button className={p.write ? '' : 'on'} onClick={() => set({ write: false })}>Carte classique</button>
            <button className={p.write ? 'on' : ''} onClick={() => set({ write: true })}>✍️ Écrire la traduction</button>
          </div>
          <p className="muted small" style={{ margin: '8px 2px 0' }}>
            {p.write
              ? 'Tu écris le sens en français, puis la carte se retourne : tu compares avec la traduction et tu te notes comme d\'habitude.'
              : 'Tu réfléchis dans ta tête, tu retournes la carte, puis tu te notes.'}
          </p>
        </div>

        <div>
          <div className="free-sec">Nombre de cartes</div>
          <div className="chips wrap">
            {LIMITS.map(([v, l]) => (
              <button key={v} className={'chip btn-chip' + (p.limit === v ? ' active' : '')} onClick={() => set({ limit: v })}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
