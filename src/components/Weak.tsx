import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { weakCards, weakGroups, type WeakCard, type WeakGroup } from '../lib/insights'
import { RECOVER_AT } from '../lib/scheduler'
import { ALL } from '../lib/queue'
import { speak, canSpeak } from '../lib/tts'
import { Sheet } from './ui'

/** Points faibles : cartes ratées souvent ou récemment, classées par type et par thème. On peut les travailler à part. */
export function Weak({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: string }) {
  const { state, items, setMemo, startSession } = useStore()
  const now = Date.now()
  const list = useMemo(() => (open ? weakCards(state, items, now) : []), [open, state, items]) // eslint-disable-line
  const groups = useMemo(() => weakGroups(list), [list])
  const [sel, setSel] = useState<string>(initial ?? 'all')
  const [editing, setEditing] = useState<string | null>(null)
  const [v, setV] = useState('')

  const all: WeakGroup[] = [...groups.types, ...groups.themes]
  // une sélection qui n'existe plus (catégorie vidée) retombe sur « Tout »
  const picked: WeakCard[] = sel === 'all' ? list : all.find((g) => g.id === sel)?.cards ?? list
  const totalMisses = list.reduce((n, c) => n + c.misses, 0)

  const work = () => {
    onClose()
    startSession({ ...ALL, scope: 'practice', keys: picked.map((c) => c.key) }, 0)
  }

  const chip = (id: string, label: string, n: number) => (
    <button key={id} className={'chip btn-chip' + (sel === id ? ' active' : '')} onClick={() => setSel(id)}>
      {label} <b className="tnum">{n}</b>
    </button>
  )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      footer={picked.length > 0 ? <button className="btn block" onClick={work}>S'entraîner · {picked.length} carte{picked.length > 1 ? 's' : ''}</button> : undefined}
    >
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Mes points faibles 🔥</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Les cartes que tu rates souvent (3 fois ou plus) ou que tu viens de rater. Elles sortent de la liste quand tu les réussis {RECOVER_AT} fois d'affilée.
          </p>
        </div>

        {list.length === 0 ? (
          <div className="card flat" style={{ textAlign: 'center', padding: 26 }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <b>Aucun point faible</b>
            <p className="muted small" style={{ margin: '4px 0 0' }}>Rien à renforcer pour l'instant. Les cartes que tu rates en séance apparaîtront ici.</p>
          </div>
        ) : (
          <>
            <div className="weak-sum">
              <div><b className="tnum">{list.length}</b><span>à renforcer</span></div>
              <div><b className="tnum">{totalMisses}</b><span>ratés au total</span></div>
            </div>

            <div>
              <div className="ctx-label" style={{ marginBottom: 6 }}>Voir</div>
              <div className="chips wrap">{chip('all', 'Tout', list.length)}</div>
              {groups.types.length > 0 && (
                <>
                  <div className="ctx-label" style={{ margin: '10px 0 6px' }}>Par type</div>
                  <div className="chips wrap">{groups.types.map((g) => chip(g.id, `${g.emoji} ${g.label}`, g.cards.length))}</div>
                </>
              )}
              {groups.themes.length > 0 && (
                <>
                  <div className="ctx-label" style={{ margin: '10px 0 6px' }}>Par thème</div>
                  <div className="chips wrap">{groups.themes.map((g) => chip(g.id, `${g.emoji} ${g.label}`, g.cards.length))}</div>
                </>
              )}
            </div>

            <div className="list">
              {picked.map(({ item, misses, streak, key }) => {
                const memo = state.cards[`${item.id}:r`]?.m
                const isEdit = editing === item.id
                const canMemo = item.kind !== 'sentence'
                return (
                  <div key={item.id} className="leech-row">
                    <div className="row spread" style={{ alignItems: 'flex-start' }}>
                      <div className="grow">
                        <div className="jp" style={{ fontSize: item.kind === 'sentence' ? 17 : 22, fontWeight: 700 }}>{item.jp}</div>
                        {item.kana !== item.jp && <div className="kana-line jp" style={{ fontSize: 15 }}>{item.kana}</div>}
                        {item.kind !== 'sentence' && <div className="romaji-line" style={{ fontSize: 14 }}>{item.romaji}</div>}
                        <div style={{ marginTop: 2 }}>{item.fr}</div>
                        <div className="muted small" style={{ marginTop: 3 }}>
                          {key.endsWith(':p') ? 'À dire en japonais' : 'À reconnaître'} · série {Math.min(streak, RECOVER_AT)}/{RECOVER_AT}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <span className={'chip tnum ' + (misses >= 3 ? 'warn' : '')}>raté {misses}×</span>
                        {canSpeak() && <button className="icon-btn" onClick={() => speak(item.kana || item.jp)} aria-label="Écouter">🔊</button>}
                      </div>
                    </div>
                    {canMemo &&
                      (isEdit ? (
                        <form className="memo-form" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); setMemo(`${item.id}:r`, v); setEditing(null) }}>
                          <input autoFocus value={v} maxLength={240} onChange={(e) => setV(e.target.value)} placeholder="Une image, un jeu de mots, un indice…" aria-label="Astuce" />
                          <button className="btn" type="submit">OK</button>
                        </form>
                      ) : memo ? (
                        <button className="memo" style={{ marginTop: 8 }} onClick={() => { setV(memo); setEditing(item.id) }}>💡 {memo}</button>
                      ) : (
                        <button className="memo add strong" style={{ marginTop: 8 }} onClick={() => { setV(''); setEditing(item.id) }}>＋ Ajouter une astuce</button>
                      ))}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
