import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { leeches, LEECH_AT } from '../lib/insights'
import { ALL } from '../lib/queue'
import { speak, canSpeak } from '../lib/tts'
import { Sheet } from './ui'

/** Mots oubliés souvent : on peut y ajouter une astuce et les travailler à part (sans toucher au planning). */
export function Leeches({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, items, setMemo, startSession } = useStore()
  const list = useMemo(() => (open ? leeches(state, items) : []), [open, state, items])
  const [editing, setEditing] = useState<string | null>(null)
  const [v, setV] = useState('')

  const work = () => {
    onClose()
    startSession({ ...ALL, scope: 'practice', ids: list.map((l) => l.item.id) }, 0)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      footer={
        list.length > 0 ? (
          <button className="btn block" onClick={work}>Les travailler · {list.length} mot{list.length > 1 ? 's' : ''}</button>
        ) : undefined
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Mots difficiles 🧲</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Les mots oubliés au moins {LEECH_AT} fois. Une petite astuce (une image, un jeu de mots) aide beaucoup. « Les travailler » ne change pas ton planning.
          </p>
        </div>

        {list.length === 0 ? (
          <div className="card flat" style={{ textAlign: 'center', padding: 26 }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <b>Aucun mot difficile</b>
            <p className="muted small" style={{ margin: '4px 0 0' }}>Aucun mot n'a été oublié {LEECH_AT} fois ou plus. Continue comme ça !</p>
          </div>
        ) : (
          <div className="list">
            {list.map(({ item, lapses }) => {
              const key = `${item.id}:r`
              const memo = state.cards[key]?.m
              const isEdit = editing === item.id
              return (
                <div key={item.id} className="leech-row">
                  <div className="row spread" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="jp" style={{ fontSize: 22, fontWeight: 700 }}>{item.jp}</div>
                      {item.kana !== item.jp && <div className="kana-line jp" style={{ fontSize: 15 }}>{item.kana}</div>}
                      <div className="romaji-line" style={{ fontSize: 14 }}>{item.romaji}</div>
                      <div style={{ marginTop: 2 }}>{item.fr}</div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="chip warn tnum">×{lapses}</span>
                      {canSpeak() && <button className="icon-btn" onClick={() => speak(item.kana || item.jp)} aria-label="Écouter">🔊</button>}
                    </div>
                  </div>
                  {isEdit ? (
                    <form className="memo-form" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); setMemo(key, v); setEditing(null) }}>
                      <input autoFocus value={v} maxLength={240} onChange={(e) => setV(e.target.value)} placeholder="Une image, un jeu de mots, un indice…" aria-label="Astuce" />
                      <button className="btn" type="submit">OK</button>
                    </form>
                  ) : memo ? (
                    <button className="memo" style={{ marginTop: 8 }} onClick={() => { setV(memo); setEditing(item.id) }}>💡 {memo}</button>
                  ) : (
                    <button className="memo add strong" style={{ marginTop: 8 }} onClick={() => { setV(''); setEditing(item.id) }}>＋ Ajouter une astuce</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Sheet>
  )
}
