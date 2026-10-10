import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore, getBackup } from '../lib/store'
import { Segmented, Stepper, Toggle } from './ui'
import { fetchRemoteSnapshot, getStoredConfig, hasEnvConfig, listRemoteSnapshots, reconnect, saveConfig, signIn, signOut, signUp, syncNow, type RemoteSnap } from '../lib/sync'
import { getLocal, listLocal, saveLocal, type SnapMeta } from '../lib/snapshots'

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="list-row">
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{title}</div>
        {sub && <div className="muted small">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function SyncCard() {
  const sync = useStore((s) => s.sync)
  const cfg = getStoredConfig()
  const envCfg = hasEnvConfig()
  const [url, setUrl] = useState(cfg?.url ?? '')
  const [key, setKey] = useState(cfg?.key ?? '')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [editCfg, setEditCfg] = useState(!cfg)
  const signedIn = sync.status !== 'off' && !!sync.email

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true)
    setMsg(null)
    const err = await fn()
    setBusy(false)
    if (err) setMsg({ t: 'err', text: err })
    else setMsg({ t: 'ok', text: 'Connecté et synchronisé ✓' })
  }

  if (signedIn) {
    const label = { idle: 'En attente', syncing: 'Synchronisation…', ok: 'Synchronisé', error: 'Erreur', off: '' }[sync.status]
    return (
      <div className="list">
        <Row title={sync.email ?? ''} sub={sync.status === 'error' ? sync.message : sync.last ? `${label} · ${new Date(sync.last).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : label}>
          <span style={{ fontSize: 22 }}>{sync.status === 'ok' ? '✅' : sync.status === 'error' ? '⚠️' : '🔄'}</span>
        </Row>
        <div className="list-row" style={{ gap: 10 }}>
          <button className="btn plain grow" onClick={() => void syncNow()}>Synchroniser</button>
          <button className="btn danger grow" onClick={() => void signOut()}>Se déconnecter</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p className="muted small" style={{ margin: 0 }}>
        Crée un compte gratuit pour retrouver ta progression sur ton téléphone et ton PC. L'app fonctionne aussi sans compte (données locales).
      </p>
      {!envCfg && editCfg && (
        <>
          <div className="field"><label>URL du projet Supabase</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoCapitalize="off" /></div>
          <div className="field"><label>Clé « anon public »</label><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" autoCapitalize="off" /></div>
          <button className="btn ghost" disabled={!url.trim() || !key.trim()} onClick={() => { saveConfig({ url: url.trim(), key: key.trim() }); setEditCfg(false); void reconnect() }}>Enregistrer la configuration</button>
        </>
      )}
      {(envCfg || !editCfg) && (
        <>
          <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="off" autoComplete="email" /></div>
          <div className="field"><label>Mot de passe</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
          <div className="row">
            <button className="btn grow" disabled={busy || !email || pw.length < 6} onClick={() => run(() => signIn(email.trim(), pw))}>Connexion</button>
            <button className="btn plain grow" disabled={busy || !email || pw.length < 6} onClick={() => run(() => signUp(email.trim(), pw))}>Créer un compte</button>
          </div>
          {!envCfg && <button className="known-btn" onClick={() => setEditCfg(true)}>Modifier la configuration Supabase</button>}
        </>
      )}
      {msg && <div className={msg.t === 'err' ? 'err' : 'ok'}>{msg.text}</div>}
    </div>
  )
}

const KIND_LABEL: Record<SnapMeta['kind'], string> = { auto: 'Automatique', manuel: 'Manuelle', 'avant-restauration': 'Avant une restauration' }
const fmtDate = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Historique : points de restauration locaux (toujours) + copies hebdomadaires du cloud (si la table existe). */
function Snapshots() {
  const { state, restoreSnapshot } = useStore()
  const [local, setLocal] = useState<SnapMeta[]>([])
  const [remote, setRemote] = useState<RemoteSnap[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const sync = useStore((st) => st.sync)

  const refresh = useCallback(async () => {
    setLocal(await listLocal())
    setRemote(await listRemoteSnapshots())
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh, sync.status])

  const create = async () => {
    setBusy(true)
    const ok = await saveLocal(state, 'manuel')
    setNote(ok ? 'Point de restauration créé ✓' : 'Impossible de créer le point (stockage indisponible).')
    await refresh()
    setBusy(false)
  }
  const doRestore = async (json: string | null, label: string) => {
    if (!json) return setNote('Copie introuvable.')
    if (!confirm(`Revenir à la copie du ${label} ? Tes cartes reprendront l'état de cette copie. Un point « avant restauration » est créé juste avant, pour pouvoir annuler.`)) return
    setBusy(true)
    await saveLocal(state, 'avant-restauration')
    const ok = restoreSnapshot(json)
    setNote(ok ? `Restauré : ${label} ✓` : 'Copie illisible, rien n\'a été modifié.')
    await refresh()
    setBusy(false)
  }

  return (
    <div className="list">
      <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
        <div style={{ fontWeight: 600 }}>Points de restauration</div>
        <div className="muted small">Une copie automatique par semaine, gardée sur cet appareil. Tu peux en créer une avant un gros changement.</div>
      </div>
      {local.map((sn) => (
        <div key={sn.id} className="list-row" style={{ gap: 10 }}>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{fmtDate(sn.t)}</div>
            <div className="muted small tnum">{KIND_LABEL[sn.kind]} · {sn.cards} cartes vues · {sn.reviews} révisions</div>
          </div>
          <button className="btn plain" disabled={busy} style={{ padding: '8px 14px', fontSize: 14 }} onClick={async () => doRestore((await getLocal(sn.id))?.data ?? null, fmtDate(sn.t))}>Restaurer</button>
        </div>
      ))}
      {remote && remote.length > 0 && (
        <>
          <div className="list-row"><div className="muted small caps">Dans ton compte cloud</div></div>
          {remote.map((r) => (
            <div key={r.taken_on} className="list-row" style={{ gap: 10 }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>Semaine du {new Date(r.taken_on).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div className="muted small tnum">{r.cards} cartes vues</div>
              </div>
              <button className="btn plain" disabled={busy} style={{ padding: '8px 14px', fontSize: 14 }} onClick={async () => doRestore(await fetchRemoteSnapshot(r.taken_on), r.taken_on)}>Restaurer</button>
            </div>
          ))}
        </>
      )}
      <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <button className="btn ghost" disabled={busy} onClick={() => void create()}>＋ Créer un point de restauration</button>
        {sync.email && remote === null && (
          <div className="muted small">Pour garder aussi l'historique dans ton compte cloud, exécute une fois le fichier <b>supabase/snapshots.sql</b> dans Supabase (facultatif).</div>
        )}
        {note && <div className="ok small">{note}</div>}
      </div>
    </div>
  )
}

export function Settings() {
  const { state, updateSettings, exportJson, importJson, resetAll } = useStore()
  const s = state.settings
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kioku-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const doBackup = () => {
    const raw = getBackup()
    if (!raw) return
    const blob = new Blob([raw], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'kioku-copie-avant-mise-a-jour.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const hasBackup = !!getBackup()
  const doImport = async (f: File | undefined) => {
    if (!f) return
    const ok = importJson(await f.text())
    setNote(ok ? 'Sauvegarde importée et fusionnée ✓' : 'Fichier invalide.')
  }

  return (
    <div className="stack">
      <div>
        <h1 className="large-title">Réglages</h1>
        <p className="subtitle">Ajuste Kioku à ton rythme.</p>
      </div>

      <div>
        <div className="section-title" style={{ marginTop: 0 }}>Objectifs</div>
        <div className="list">
          <Row title="Nouvelles cartes / jour" sub="Mots et phrases découverts chaque jour"><Stepper value={s.newPerDay} min={0} max={60} step={5} onChange={(v) => updateSettings({ newPerDay: v })} /></Row>
          <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Révisions max / jour</div>
              <div className="muted small">Les cartes en trop sont reportées au lendemain : les plus difficiles passent en premier</div>
            </div>
            <Segmented value={String(s.reviewsPerDay)} onChange={(v) => updateSettings({ reviewsPerDay: Number(v) })} options={[['10', '10'], ['20', '20'], ['30', '30'], ['50', '50'], ['100', '100'], ['0', 'Illimité']]} />
          </div>
          <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Cartes par manche</div>
              <div className="muted small">La séance est coupée en petites manches : les ratés reviennent dans la manche, puis une pause pour continuer ou arrêter</div>
            </div>
            <Segmented value={String(s.chunk ?? 10)} onChange={(v) => updateSettings({ chunk: Number(v) })} options={[['5', '5'], ['10', '10'], ['15', '15'], ['20', '20'], ['0', 'Tout']]} />
          </div>
          <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Phrases naturelles / jour</div>
              <div className="muted small">Des phrases de tes vidéos (japonais parlé) glissées dans « À étudier », avec des mots que tu connais déjà</div>
            </div>
            <Segmented value={String(s.naturalPerDay ?? 2)} onChange={(v) => updateSettings({ naturalPerDay: Number(v) })} options={[['0', 'Aucune'], ['1', '1'], ['2', '2'], ['3', '3'], ['5', '5']]} />
          </div>
          <Row title="Objectif quotidien" sub="Cartes à réviser pour garder ta série"><Stepper value={s.goal} min={5} max={200} step={5} onChange={(v) => updateSettings({ goal: v })} /></Row>
          <Row title="Cartes de production" sub="Dire le mot en japonais (FR → JP), débloqué quand tu le reconnais"><Toggle on={s.production} onChange={(v) => updateSettings({ production: v })} /></Row>
          {s.production && <Row title="Production / jour"><Stepper value={s.prodPerDay} min={0} max={40} step={2} onChange={(v) => updateSettings({ prodPerDay: v })} /></Row>}
          <Row title="Écrire les réponses" sub="Sur les cartes de production, tape le mot en rōmaji ou en kana au lieu de le penser"><Toggle on={s.typing} onChange={(v) => updateSettings({ typing: v })} /></Row>
          <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Phrases à traduire avant la séance</div>
              <div className="muted small">Une ou deux phrases à décortiquer quand tu appuies sur « Commencer »</div>
            </div>
            <Segmented value={String(s.preSentences)} onChange={(v) => updateSettings({ preSentences: Number(v) as 0 | 1 | 2 })} options={[['0', 'Aucune'], ['1', '1 phrase'], ['2', '2 phrases']]} />
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Affichage</div>
        <div className="list">
          <Row title="Retirer l'aide peu à peu" sub="Sur les cartes solides, le rōmaji (≥ 21 j) puis le kana (≥ 60 j) disparaissent ; un tap les affiche"><Toggle on={s.fade} onChange={(v) => updateSettings({ fade: v })} /></Row>
          <Row title="Gestes sur la carte" sub="Glisse la carte retournée : à droite « Bien », à gauche « Oublié »"><Toggle on={s.swipe} onChange={(v) => updateSettings({ swipe: v })} /></Row>
          <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Lecture sur le recto</div>
              <div className="muted small">Kana + rōmaji sous le kanji</div>
            </div>
            <Segmented value={s.reading} onChange={(v) => updateSettings({ reading: v })} options={[['always', 'Toujours'], ['tap', 'Au toucher'], ['never', 'Jamais']]} />
          </div>
          <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Thème</div>
            <Segmented value={s.theme} onChange={(v) => updateSettings({ theme: v })} options={[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']]} />
          </div>
          <Row title="Prononciation automatique" sub="Voix japonaise de ton appareil"><Toggle on={s.autoPlay} onChange={(v) => updateSettings({ autoPlay: v })} /></Row>
        </div>
      </div>

      <div>
        <div className="section-title">Synchronisation</div>
        <SyncCard />
      </div>

      <div>
        <div className="section-title">Historique des sauvegardes</div>
        <Snapshots />
      </div>

      <div>
        <div className="section-title">Données</div>
        <div className="list">
          <button className="list-row tap" onClick={doExport}><span className="grow" style={{ fontWeight: 600 }}>Exporter une sauvegarde (.json)</span></button>
          {hasBackup && <button className="list-row tap" onClick={doBackup}><span className="grow"><div style={{ fontWeight: 600 }}>Télécharger la copie de sécurité</div><div className="muted small">Faite automatiquement avant la dernière mise à jour</div></span></button>}
          <button className="list-row tap" onClick={() => fileRef.current?.click()}><span className="grow" style={{ fontWeight: 600 }}>Importer une sauvegarde</span></button>
          <button className="list-row tap" onClick={() => { if (confirm('Tout effacer sur cet appareil ? (Ta sauvegarde cloud reste, elle se resynchronisera.)')) resetAll() }}><span className="grow" style={{ fontWeight: 600, color: 'var(--red)' }}>Réinitialiser cet appareil</span></button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
        {note && <p className="ok" style={{ margin: '8px 6px' }}>{note}</p>}
      </div>

      <p className="muted small" style={{ textAlign: 'center', margin: '14px 20px 0', lineHeight: 1.5 }}>
        Kioku 記憶 · Vocabulaire : listes JLPT ouvertes (jamsinclair/open-anki-jlpt-decks) et fréquences JMdict (© EDRDG, CC BY-SA 4.0). Traductions françaises rédigées pour cette app.
      </p>
    </div>
  )
}
