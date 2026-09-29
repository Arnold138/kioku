import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { DECKS, matchesSearch, POS_LABEL, type Item } from '../lib/deck'
import { POS_GROUPS, passes, type PosGroup } from '../lib/queue'
import { isKnown, isMature, type CardState } from '../lib/scheduler'
import { speak, canSpeak } from '../lib/tts'
import { Icon, Sheet } from './ui'

const PAGE = 60

function status(c: CardState | undefined): 'new' | 'learning' | 'known' | 'mature' {
  if (!c || c.s === 'new') return 'new'
  if (isMature(c)) return 'mature'
  if (isKnown(c)) return 'known'
  return 'learning'
}
const STATUS_LABEL = { new: 'Nouvelle', learning: 'En apprentissage', known: 'Retenue', mature: 'Solide (> 21 jours)' }

export function Library({ onEdit }: { onEdit: (id: string) => void }) {
  const { items, state } = useStore()
  const [q, setQ] = useState('')
  const [deck, setDeck] = useState('all')
  const [pos, setPos] = useState<PosGroup>('all')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<Item | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const list = useMemo(
    () =>
      items
        .filter((i) => passes(i, { deck, pos }) && matchesSearch(i, q))
        .sort((a, b) => a.order - b.order),
    [items, deck, pos, q]
  )

  useEffect(() => setLimit(PAGE), [q, deck, pos])
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list.length])

  return (
    <div className="stack">
      <div>
        <h1 className="large-title">Bibliothèque</h1>
        <p className="subtitle">{items.length} cartes · touche un mot pour le détail</p>
      </div>
      <div className="search">
        {Icon.search()}
        <input placeholder="Rechercher (kanji, kana, romaji, français)" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="off" autoCorrect="off" />
      </div>
      <div>
        <div className="chips">
          <button className={'chip btn-chip' + (deck === 'all' ? ' active' : '')} onClick={() => setDeck('all')}>Tout</button>
          {DECKS.map((d) => (
            <button key={d.id} className={'chip btn-chip' + (deck === d.id ? ' active' : '')} onClick={() => setDeck(d.id)}>{d.emoji} {d.name}</button>
          ))}
        </div>
        <div className="chips">
          {POS_GROUPS.map((g) => (
            <button key={g.id} className={'chip btn-chip' + (pos === g.id ? ' active' : '')} onClick={() => setPos(g.id)}>{g.label}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">Aucun résultat. Essaie un autre mot, ou ajoute-le avec « Ajout rapide ».</div>
      ) : (
        <div className="list">
          {list.slice(0, limit).map((it) => {
            const st = status(state.cards[`${it.id}:r`])
            return (
              <button key={it.id} className="list-row word-row tap" onClick={() => setOpen(it)}>
                <span className={'status-dot ' + st} />
                <span className={'jpw jp' + (it.jp.length > 5 ? ' long' : '')}>{it.jp}</span>
                <span className="grow">
                  <div className="fr">{it.fr}</div>
                  <div className="rd">{it.kana !== it.jp ? it.kana + ' · ' : ''}{it.romaji}</div>
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div ref={sentinel} style={{ height: 1 }} />

      <WordSheet item={open} onClose={() => setOpen(null)} onEdit={onEdit} />
    </div>
  )
}

function WordSheet({ item, onClose, onEdit }: { item: Item | null; onClose: () => void; onEdit: (id: string) => void }) {
  const { state, deleteCustom } = useStore()
  const [last, setLast] = useState<Item | null>(null)
  useEffect(() => {
    if (item) setLast(item)
  }, [item])
  const it = item ?? last
  const r = it ? state.cards[`${it.id}:r`] : undefined
  const p = it ? state.cards[`${it.id}:p`] : undefined
  const reset = () => {
    if (!it) return
    const cards = { ...useStore.getState().state.cards }
    delete cards[`${it.id}:r`]
    delete cards[`${it.id}:p`]
    useStore.setState((s) => ({ state: { ...s.state, cards } }))
    onClose()
  }
  return (
    <Sheet open={!!item} onClose={onClose}>
      {it && (
        <div className="stack">
          <div style={{ textAlign: 'center' }}>
            <div className="jp" style={{ fontSize: it.jp.length > 8 ? 30 : 54, fontWeight: 700, lineHeight: 1.2 }}>{it.jp}</div>
            {it.kana !== it.jp && <div className="kana-line jp" style={{ marginTop: 6 }}>{it.kana}</div>}
            <div className="romaji-line">{it.romaji}</div>
            {canSpeak() && (
              <button className="icon-btn" style={{ margin: '10px auto 0' }} onClick={() => speak(it.kana || it.jp)} aria-label="Écouter">{Icon.speaker()}</button>
            )}
          </div>
          <div className="card flat" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{it.fr}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {it.kind === 'word' && <span className="chip">{POS_LABEL[it.pos] ?? it.pos}</span>}
              <span className="chip">{it.lvl}</span>
              {it.note && <span className="chip accent">{it.note}</span>}
              {it.alt?.length ? <span className="chip jp">aussi : {it.alt.join('、')}</span> : null}
            </div>
          </div>
          <div className="list">
            <div className="list-row"><span className="grow">Reconnaissance (JP → FR)</span><b>{STATUS_LABEL[status(r)]}</b></div>
            {r && r.s !== 'new' && <div className="list-row"><span className="grow muted">Réponses · oublis · facilité</span><span className="tnum">{r.r} · {r.l} · {r.e.toFixed(2)}</span></div>}
            {it.kind !== 'sentence' && <div className="list-row"><span className="grow">Production (FR → JP)</span><b>{STATUS_LABEL[status(p)]}</b></div>}
          </div>
          <div className="row">
            {it.kind === 'custom' && (
              <>
                <button className="btn plain grow" onClick={() => { onClose(); onEdit(it.id) }}>Modifier</button>
                <button className="btn danger grow" onClick={() => { deleteCustom(it.id); onClose() }}>Supprimer</button>
              </>
            )}
            {it.kind !== 'custom' && r && r.s !== 'new' && <button className="btn plain block" onClick={reset}>Remettre à zéro</button>}
          </div>
        </div>
      )}
    </Sheet>
  )
}
