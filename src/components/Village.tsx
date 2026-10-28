import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { ALL } from '../lib/queue'
import { dayKey, dayNumber } from '../lib/scheduler'
import { streaks } from '../lib/state'
import { ACHIEVEMENTS, TIERS } from '../lib/achievements'
import { shinyCount } from '../lib/shiny'
import { canSpeak, speak } from '../lib/tts'
import {
  STAGES, STAGE_AT, VILLAGER_PER_DAY, VILLAGER_XP, buildingsFor, cityStatuses, currentCity, knownKanji, signText,
  villageStats, villagerCount, villagerKey, villagerLine, type CityStatus, type VillageStats
} from '../lib/village'
import { Sheet } from './ui'
import { VillageScene } from './VillageScene'
import { earnedDecorations } from '../lib/festivals'
import { FestivalCard } from './Festival'
import { currentSky } from './Home'

const STAGE_COLOR = ['var(--faint)', '#fb923c', '#a5b4fc', '#ffc56b']

/** Avancement des trophées du village (pour la barre). */
function trophyPct(id: string, v: VillageStats, shiny: number): number {
  const map: Record<string, [number, number]> = {
    vBuild5: [v.built, 5], vLantern: [v.lit, 1], vHouses5: [v.houses, 5], vLit3: [v.lit, 3], vLit8: [v.lit, 8],
    vSweep100: [v.swept, 100], vSweep500: [v.swept, 500], vSweep2000: [v.swept, 2000],
    vNara: [v.cities - 1, 1], vKyoto: [v.cities - 1, 2], vOsaka: [v.cities - 1, 3],
    vTalk10: [v.villagers, 10], vTalk50: [v.villagers, 50], sh1: [shiny, 1], sh10: [shiny, 10], sh50: [shiny, 50]
  }
  const [a, b] = map[id] ?? [0, 1]
  return Math.max(0, Math.min(1, a / b))
}

function Villager() {
  const { state, items, understandVillager } = useStore()
  const now = Date.now()
  const day = dayKey(dayNumber(now))
  const [skip, setSkip] = useState<string[]>([])
  const line = useMemo(() => villagerLine(state, items, now, skip), [items, skip]) // eslint-disable-line
  const [shown, setShown] = useState(false)
  const [gain, setGain] = useState<number | null>(null)
  useEffect(() => {
    setShown(false)
    setGain(null)
  }, [line?.id])
  if (!line) return null
  const done = !!state.ach[villagerKey(day, line.id)]
  const left = Math.max(0, VILLAGER_PER_DAY - villagerCount(state.ach, day))
  return (
    <div className="villager">
      <div className="row spread" style={{ alignItems: 'baseline' }}>
        <span className="caps-label">Un habitant te parle</span>
        <span className="muted small">{line.speaker}</span>
      </div>
      <button className="villager-bubble" onClick={() => { setShown(true); if (canSpeak()) void speak(line.kana || line.jp) }}>
        <span className="jp" style={{ fontSize: 19, fontWeight: 700 }}>{line.jp}</span>
        {!shown && <small>Touche pour écouter et traduire</small>}
      </button>
      {shown && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="stack" style={{ gap: 8 }}>
          <div className="kana-line jp" style={{ fontSize: 14 }}>{line.kana.replace(/\s+/g, ' ')}</div>
          <div style={{ fontWeight: 600 }}>{line.fr}</div>
          <div className="muted small">Avec ton mot récent : <b className="jp">{line.word}</b></div>
          {done || gain !== null ? (
            <div className="row spread">
              <span className="ok small">✓ Compris{gain ? ` · +${gain} XP` : ''}</span>
              <button className="btn plain" style={{ padding: '8px 14px', fontSize: 14 }} onClick={() => setSkip((s) => [...s, line.id])}>Un autre habitant</button>
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn plain grow" style={{ padding: '11px 12px', fontSize: 15 }} onClick={() => setSkip((s) => [...s, line.id])}>Pas compris</button>
              <button className="btn grow" style={{ padding: '11px 12px', fontSize: 15 }} onClick={() => setGain(understandVillager(line.id))}>
                Compris ✓{left > 0 ? ` +${VILLAGER_XP} XP` : ''}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export function VillageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, items, startSession } = useStore()
  const now = Date.now()
  const cities = useMemo(() => cityStatuses(state, items), [state, items])
  const [pick, setPick] = useState<string | null>(null)
  const city: CityStatus = cities.find((c) => c.id === pick && c.unlocked && !c.noWords) ?? currentCity(cities)
  const buildings = useMemo(() => buildingsFor(state, items, city.lvl, now), [state, items, city.lvl]) // eslint-disable-line
  const kanji = useMemo(() => knownKanji(state, items), [state, items])
  const stats = useMemo(() => villageStats(state, items, now), [state, items]) // eslint-disable-line
  const shiny = shinyCount(state.ach)
  const st = streaks(state, now)
  const sky = currentSky(state.settings.sky, now)
  const leaves = buildings.reduce((n, b) => n + b.leaves, 0)
  const built = buildings.filter((b) => b.stage >= 1).length
  const signs = buildings.map((b) => ({ id: b.id, ...signText(b.sign, kanji) }))
  const hiddenSigns = signs.filter((s) => s.hidden > 0).length
  const trophies = ACHIEVEMENTS.filter((a) => a.family === 'village')
  const got = trophies.filter((a) => state.ach[a.id]).length

  useEffect(() => {
    if (!open) setPick(null)
  }, [open])

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="stack village-page" style={{ gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}><span className="jp-display">村</span> Ton village</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Il grandit avec chaque mot retenu. Une ville par niveau du JLPT.</p>
        </div>

        <div className="village-big">
          <VillageScene city={city} buildings={buildings} sky={sky} streak={st.current} height={300} decor={earnedDecorations(state.ach)} labels />
        </div>

        {/* villes */}
        <div className="cities" role="tablist" aria-label="Tes villes">
          {cities.map((c) => {
            const active = c.id === city.id
            const can = c.unlocked && !c.noWords
            return (
              <button key={c.id} role="tab" aria-selected={active} disabled={!can} className={'city' + (active ? ' on' : '') + (can ? '' : ' locked')} onClick={() => setPick(c.id)}>
                <span className="jp-display city-k">{c.kanji}</span>
                <b>{c.name}</b>
                <span className="city-lvl">{c.lvl}</span>
                <small>
                  {c.noWords ? (c.lvl === 'N2' ? 'Ton objectif' : 'Le défi ultime') : c.unlocked ? (c.built ? 'Niveau solide ✓' : `${Math.round(c.progress.pct * 100)} % des mots`) : `S'ouvre au ${cities[cities.indexOf(c) - 1].lvl} solide`}
                </small>
              </button>
            )
          })}
        </div>

        <FestivalCard full onStart={onClose} />

        <Villager />

        <div className="v-tiles">
          <div className="v-tile"><b className="tnum">{built}</b><span>bâtiment{built > 1 ? 's' : ''}</span></div>
          <div className="v-tile"><b className="tnum">{city.progress.known}</b><span>mots {city.lvl} retenus</span></div>
          <div className="v-tile leaf"><b className="tnum">{leaves}</b><span>feuille{leaves > 1 ? 's' : ''} à balayer</span></div>
        </div>

        {/* quartiers */}
        <div className="glass-card" style={{ padding: '8px 16px 14px' }}>
          <div className="row spread" style={{ alignItems: 'baseline', padding: '10px 0 6px' }}>
            <b style={{ fontSize: 17 }}>Quartiers</b>
            <span className="muted small">un bâtiment par thème</span>
          </div>
          {buildings.map((b) => {
            const next: number | null = b.stage < 3 ? STAGE_AT[b.stage as 0 | 1 | 2] : null
            return (
              <div key={b.id} className="quarter">
                <div className="q-ico jp-display">{b.icon}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row spread" style={{ gap: 8, fontSize: 14 }}>
                    <span style={{ fontWeight: 700, minWidth: 0 }}>{b.label} <span className="muted" style={{ fontWeight: 500 }}>· {STAGES[b.stage]}</span></span>
                    <b className="tnum">{Math.round(b.pct * 100)} %</b>
                  </div>
                  <div className="q-bar"><i style={{ width: `${Math.round(b.pct * 100)}%`, background: STAGE_COLOR[b.stage] }} /></div>
                  <div className="row spread small" style={{ gap: 8 }}>
                    <span className={b.leaves ? 'leaf-txt' : 'muted'}>{b.leaves ? `${b.leaves} feuille${b.leaves > 1 ? 's' : ''} à balayer` : 'Aucune feuille'}</span>
                    {next !== null && <span className="muted tnum">{Math.max(1, Math.ceil(next * b.total) - b.known)} mot{Math.ceil(next * b.total) - b.known > 1 ? 's' : ''} pour « {STAGES[b.stage + 1]} »</span>}
                  </div>
                </div>
              </div>
            )
          })}
          {leaves > 0 && (
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => { onClose(); startSession({ ...ALL, deck: city.lvl }, 0) }}>
              Balayer les {leaves} feuille{leaves > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* monuments */}
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>Monuments</div>
          <div className="monuments">
            {cities.map((c) => (
              <div key={c.id} className={'monu' + (c.built ? ' built' : c.unlocked && !c.noWords ? ' wip' : ' later')}>
                <span className="jp-display">{c.monument.kanji}</span>
                <b>{c.lvl}</b>
                <small>{c.built ? 'Construit' : c.unlocked && !c.noWords ? `En travaux · ${Math.round(c.monumentPct * 100)} %` : 'À venir'}</small>
              </div>
            ))}
          </div>
        </div>

        {/* enseignes */}
        <div className="glass-card">
          <b style={{ fontSize: 17 }}>Enseignes du village</b>
          <p className="muted small" style={{ margin: '2px 0 12px' }}>Elles s'écrivent avec tes kanji. Un kanji inconnu reste un « ？ » jusqu'à ce que tu retiennes un mot qui l'utilise.</p>
          <div className="signs">
            {signs.map((s) => (
              <span key={s.id} className={'sign jp-display' + (s.hidden ? ' unk' : '')}>{s.text}</span>
            ))}
          </div>
          <p className="muted small" style={{ margin: '10px 0 0' }}>{hiddenSigns ? `${hiddenSigns} enseigne${hiddenSigns > 1 ? 's' : ''} à déchiffrer` : 'Tu sais lire toutes les enseignes ✓'}</p>
        </div>

        {/* trophées du village */}
        <div>
          <div className="row spread" style={{ alignItems: 'baseline', padding: '0 4px 10px' }}>
            <b style={{ fontSize: 17 }}>Trophées du village</b>
            <span className="muted small tnum">{got} sur {trophies.length}</span>
          </div>
          <div className="v-trophies">
            {trophies.map((a) => {
              const has = !!state.ach[a.id]
              const pct = has ? 1 : trophyPct(a.id, stats, shiny)
              return (
                <div key={a.id} className={'v-trophy ' + a.tier + (has ? ' got' : '')}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="v-medal">{a.emoji}</span>
                    <span className="v-tier">{TIERS[a.tier].label}</span>
                  </div>
                  <b>{a.name}</b>
                  <span className="muted small">{a.desc}</span>
                  <div className="q-bar"><i style={{ width: `${Math.round(pct * 100)}%` }} /></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
