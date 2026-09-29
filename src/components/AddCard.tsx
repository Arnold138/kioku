import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { hasKanji, isKana, toRomaji } from '../lib/romaji'
import { Sheet } from './ui'

/** Ajout rapide : pour noter en quelques secondes un mot croisé dans une vidéo. */
export function AddCard({ open, editId, onClose }: { open: boolean; editId: string | null; onClose: () => void }) {
  const { addCustom, editCustom, state } = useStore()
  const [jp, setJp] = useState('')
  const [kana, setKana] = useState('')
  const [fr, setFr] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    const c = editId ? state.custom[editId] : null
    setJp(c?.jp ?? '')
    setKana(c?.kana ?? '')
    setFr(c?.fr ?? '')
    setNote(c?.note ?? '')
    setSaved(false)
  }, [open, editId]) // eslint-disable-line

  const reading = kana.trim() || (isKana(jp) ? jp : '')
  const needKana = jp.trim() && hasKanji(jp) && !kana.trim()
  const valid = jp.trim() && fr.trim()

  const save = (again: boolean) => {
    if (!valid) return
    const data = { jp: jp.trim(), kana: reading || jp.trim(), fr: fr.trim(), note: note.trim() || undefined }
    if (editId) {
      editCustom(editId, data)
      onClose()
      return
    }
    addCustom(data)
    if (again) {
      setJp('')
      setKana('')
      setFr('')
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } else onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="stack">
        <div>
          <h2 style={{ margin: 0, fontSize: 24 }}>{editId ? 'Modifier la carte' : 'Ajout rapide'}</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Un mot ou une phrase entendu en vidéo. La carte rejoint « Mes cartes ».</p>
        </div>
        <div className="field">
          <label>Japonais</label>
          <input className="jp" value={jp} onChange={(e) => setJp(e.target.value)} placeholder="例：猫 / ねこ / 面白いね" autoFocus lang="ja" />
        </div>
        <div className="field">
          <label>Lecture en hiragana {isKana(jp) && <span className="muted">(déjà en kana)</span>}</label>
          <input className="jp" value={kana} onChange={(e) => setKana(e.target.value)} placeholder="ねこ" lang="ja" />
          {reading && <div className="romaji-line" style={{ fontSize: 15 }}>→ {toRomaji(reading)}</div>}
          {needKana && <div className="small" style={{ color: 'var(--orange)' }}>Ajoute la lecture pour voir le rōmaji et écouter la prononciation.</div>}
        </div>
        <div className="field">
          <label>Traduction française</label>
          <input value={fr} onChange={(e) => setFr(e.target.value)} placeholder="chat" />
        </div>
        <div className="field">
          <label>Note (facultatif)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. vu dans la vidéo de …" />
        </div>
        <div className="row">
          {!editId && <button className="btn plain grow" style={{ fontSize: 15, padding: '15px 8px', whiteSpace: 'nowrap' }} disabled={!valid} onClick={() => save(true)}>{saved ? 'Ajoutée ✓' : 'Ajouter et continuer'}</button>}
          <button className="btn grow" disabled={!valid} onClick={() => save(false)}>{editId ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </div>
    </Sheet>
  )
}
