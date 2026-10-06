import { create } from 'zustand'
import {
  type AppState,
  type DayStat,
  DEFAULT_SETTINGS,
  computeProgress,
  dayTotal,
  emptyState,
  levelFromXp,
  mergeStates,
  sanitize,
  streaks,
  totalReviews,
  totalXp,
  type Settings
} from './state'
import { type CardState, type Rating, answer, answerPractice, dayKey, dayNumber, newCard } from './scheduler'
import { isNaturalId } from './natural'
import { type CustomCard, type Item, buildCatalog, parseCardId } from './deck'
import { ALL, type Filter, buildPractice, buildQueue, interleave, pickWarmup } from './queue'
import { ACHIEVEMENTS, buildStats, newlyUnlocked, type Achievement } from './achievements'
import { examKey, examStats, type ExamMode, type ExamLevel } from './exam'

const LS_KEY = 'kioku:v1' // ⚠️ ne jamais changer : c'est la clé de ta sauvegarde locale
const LS_DEVICE = 'kioku:device'
const LS_VER = 'kioku:appver'
const LS_BACKUP = 'kioku:backup:avant-v1.1'
const LS_BACKUP2 = 'kioku:backup:avant-v1.2'
const LS_BACKUP3 = 'kioku:backup:avant-v1.3'
export const APP_VERSION = '1.4'
const LS_BACKUP4 = 'kioku:backup:avant-v1.4'

export const XP_BY_RATING: Record<Rating, number> = { 1: 2, 2: 5, 3: 8, 4: 10, 5: 12 }
export const XP_NEW = 5
export const XP_SESSION = 20
export const XP_GOAL = 30

// ───────── Persistance locale ─────────
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* stockage indisponible : l'app fonctionne quand même en mémoire */
  }
}

function deviceId(): string {
  let id = safeGet(LS_DEVICE)
  if (!id) {
    id = Math.random().toString(36).slice(2, 8)
    safeSet(LS_DEVICE, id)
  }
  return id
}

/** Filet de sécurité : à la première ouverture après une mise à jour, on garde une copie de la sauvegarde locale. */
function snapshotBeforeUpdate() {
  if (safeGet(LS_VER) === APP_VERSION) return
  const raw = safeGet(LS_KEY)
  if (raw && !safeGet(LS_BACKUP)) safeSet(LS_BACKUP, raw)
  // v1.2 : une 2e copie, prise au premier lancement de la 1.2 (la première reste intacte)
  if (raw && safeGet(LS_VER) && !safeGet(LS_BACKUP2)) safeSet(LS_BACKUP2, raw)
  // v1.3 : une 3e copie, prise au premier lancement de la 1.3 (les deux premières restent intactes)
  if (raw && safeGet(LS_VER) && !safeGet(LS_BACKUP3)) safeSet(LS_BACKUP3, raw)
  // v1.4 : une 4e copie (les trois premières restent intactes)
  if (raw && safeGet(LS_VER) && !safeGet(LS_BACKUP4)) safeSet(LS_BACKUP4, raw)
  safeSet(LS_VER, APP_VERSION)
}
export const getBackup = (): string | null => safeGet(LS_BACKUP4) ?? safeGet(LS_BACKUP3) ?? safeGet(LS_BACKUP2) ?? safeGet(LS_BACKUP)

export function loadState(): AppState {
  const raw = safeGet(LS_KEY)
  if (!raw) return emptyState()
  try {
    return sanitize(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

// ───────── Types de session ─────────
export interface Toast {
  id: number
  kind: 'ach' | 'goal' | 'level' | 'info'
  title: string
  text: string
  emoji: string
}

interface UndoInfo {
  cardKey: string
  prevCard: CardState | undefined
  prevDay: DayStat | undefined
  xp: number
  wasNew: boolean
  forgot: boolean
  shownAt: number
  practice?: boolean // séance d'entraînement (les cartes non dues ne bougent pas, sauf si on les rate)
  requeued?: boolean // la carte a été remise en fin de file
  newMissed?: boolean // ce raté a ajouté la carte à la liste des ratés de la séance
  newSeen?: boolean // ce mot a été ajouté à la liste des mots vus
}

export interface Session {
  filter: Filter
  extra: number
  queue: string[]
  learn: Array<{ id: string; due: number }>
  current: string | null
  revealed: boolean
  total: number
  done: number
  answered: number
  forgot: number
  xp: number
  start: number
  shownAt: number
  undo: UndoInfo | null
  finished: boolean
  newSeen: number
  /** entraînement : une réussite ne repousse pas la date de révision ; un raté, lui, compte comme une vraie révision. L'XP compte toujours. */
  practice: boolean
  /** cartes ratées pendant cette séance (elles rejoignent tes points faibles) */
  missed: string[]
  /** mots (ids) vus pendant la séance — servent à choisir les phrases naturelles de fin de séance */
  seen: string[]
  /** cartes « échauffement » (phrases à traduire en début de séance) */
  warm: string[]
  /** réponses écrites : on tape la traduction française avant de retourner la carte */
  typeTr: boolean
}

interface Store {
  ready: boolean
  state: AppState
  items: Item[]
  byId: Map<string, Item>
  device: string
  session: Session | null
  toasts: Toast[]
  confettiTick: number
  sync: { status: 'off' | 'idle' | 'syncing' | 'ok' | 'error'; email?: string; last?: number; message?: string }

  init: () => void
  setSync: (s: Store['sync']) => void
  applyRemote: (remote: AppState) => void
  updateSettings: (patch: Partial<Settings>) => void
  setMemo: (cardKey: string, text: string) => void
  addCustom: (c: { jp: string; kana: string; fr: string; note?: string }) => string
  editCustom: (id: string, c: { jp: string; kana: string; fr: string; note?: string }) => void
  deleteCustom: (id: string) => void
  startSession: (f?: Filter, extra?: number, opts?: { warm?: number; typeTr?: boolean }) => void
  reveal: () => void
  rate: (r: Rating) => void
  markKnown: () => void
  undo: () => void
  endSession: () => void
  recordExam: (r: { lvl: ExamLevel; mode: ExamMode; ok: number; total: number }) => number
  recordListen: (r: { mode: 'sens' | 'dictee'; ok: number; total: number }) => number
  /** Note une phrase naturelle de fin de séance : « Compris » ou « À revoir » (entre dans le planning comme une vraie carte, + XP). */
  rateSentence: (itemId: string, ok: boolean) => void
  /** Revient à l'état d'un point de restauration (les cartes de la copie deviennent les plus récentes, donc elles gagnent à la synchro). */
  restoreSnapshot: (json: string) => boolean
  exportJson: () => string
  importJson: (json: string) => boolean
  resetAll: () => void
  dismissToast: (id: number) => void
}

let toastId = 1

export const useStore = create<Store>((set, get) => {
  const initial = { ...buildCatalog({}) }
  const today = () => dayKey(dayNumber(Date.now()))

  /** Écrit un nouvel état (et reconstruit le catalogue si les cartes perso ont changé). */
  const commit = (patch: Partial<AppState>) => {
    const prev = get().state
    const next: AppState = { ...prev, ...patch }
    const cat = patch.custom && patch.custom !== prev.custom ? buildCatalog(next.custom) : null
    set({ state: next, ...(cat ? { items: cat.items, byId: cat.byId } : {}) })
  }

  const addToDay = (state: AppState, dev: string, day: string, delta: Partial<DayStat>): AppState['daily'] => {
    const cur = state.daily[day]?.[dev] ?? { n: 0, nw: 0, np: 0, ok: 0, xp: 0, sec: 0, rv: 0, nv: 0 }
    const upd: DayStat = {
      n: cur.n + (delta.n ?? 0),
      nw: cur.nw + (delta.nw ?? 0),
      np: cur.np + (delta.np ?? 0),
      ok: cur.ok + (delta.ok ?? 0),
      xp: cur.xp + (delta.xp ?? 0),
      sec: cur.sec + (delta.sec ?? 0),
      rv: (cur.rv ?? 0) + (delta.rv ?? 0),
      nv: (cur.nv ?? 0) + (delta.nv ?? 0)
    }
    return { ...state.daily, [day]: { ...(state.daily[day] ?? {}), [dev]: upd } }
  }

  const pushToast = (t: Omit<Toast, 'id'>) => set((s) => ({ toasts: [...s.toasts, { ...t, id: toastId++ }].slice(-4) }))

  /** Vérifie et débloque les trophées ; renvoie l'XP bonus éventuel. */
  const checkAchievements = (perfect = false): void => {
    const { state, items, device } = get()
    const now = Date.now()
    const level = levelFromXp(totalXp(state)).level
    const st = streaks(state, now)
    const prog = computeProgress(state, items)
    const stats = buildStats(
      {
        reviews: totalReviews(state),
        level,
        xp: totalXp(state),
        streak: st.current,
        bestStreak: st.best,
        perfectSessions: perfect ? 1 : 0,
        hour: new Date(now).getHours(),
        ...examStats(state.ach)
      },
      prog
    )
    const unlocked: Achievement[] = newlyUnlocked(state, stats)
    if (!unlocked.length) return
    const ach = { ...state.ach }
    unlocked.forEach((a) => (ach[a.id] = now))
    const bonus = unlocked.length * 15
    const daily = addToDay({ ...state, ach }, device, today(), { xp: bonus })
    commit({ ach, daily })
    unlocked.forEach((a) => pushToast({ kind: 'ach', title: 'Trophée débloqué', text: `${a.name} — ${a.desc}`, emoji: a.emoji }))
    set((s) => ({ confettiTick: s.confettiTick + 1 }))
  }

  const pickNext = (s: Session, now: number): Session => {
    const dueIdx = s.learn.findIndex((l) => l.due <= now)
    let id: string | null = null
    let learn = s.learn
    let queue = s.queue
    if (dueIdx >= 0) {
      id = s.learn[dueIdx].id
      learn = s.learn.filter((_, i) => i !== dueIdx)
    } else if (s.queue.length) {
      id = s.queue[0]
      queue = s.queue.slice(1)
    } else if (s.learn.length) {
      // « learn ahead » : plus rien d'autre à montrer, on reprend la carte en attente
      const sorted = [...s.learn].sort((a, b) => a.due - b.due)
      id = sorted[0].id
      learn = sorted.slice(1)
    }
    if (!id) return { ...s, current: null, finished: true }
    return { ...s, queue, learn, current: id, revealed: false, shownAt: now }
  }

  const finishSession = () => {
    const { session, state, device } = get()
    if (!session) return
    const perfect = session.answered >= 10 && session.forgot === 0
    if (session.answered >= 5) {
      const before = levelFromXp(totalXp(state)).level
      const daily = addToDay(state, device, today(), { xp: XP_SESSION })
      commit({ daily })
      set({ session: { ...session, xp: session.xp + XP_SESSION, finished: true } })
      const after = levelFromXp(totalXp(get().state)).level
      if (after > before) {
        pushToast({ kind: 'level', title: `Niveau ${after} !`, text: 'Bravo, ta progression continue.', emoji: '🎉' })
      }
    }
    checkAchievements(perfect)
    if (session.answered >= 5) set((s) => ({ confettiTick: s.confettiTick + 1 }))
  }

  return {
    ready: false,
    state: emptyState(),
    items: initial.items,
    byId: initial.byId,
    device: 'dev',
    session: null,
    toasts: [],
    confettiTick: 0,
    sync: { status: 'off' },

    init: () => {
      snapshotBeforeUpdate()
      const st = loadState()
      const cat = buildCatalog(st.custom)
      set({ state: st, items: cat.items, byId: cat.byId, device: deviceId(), ready: true })
    },

    setSync: (s) => set({ sync: s }),

    applyRemote: (remote) => {
      const merged = mergeStates(get().state, remote)
      const cat = buildCatalog(merged.custom)
      set({ state: merged, items: cat.items, byId: cat.byId })
    },

    updateSettings: (patch) => commit({ settings: { ...get().state.settings, ...patch, _t: Date.now() } }),

    /** Astuce personnelle sur une carte déjà vue : voyage avec la carte (même format de sauvegarde). */
    setMemo: (cardKey, text) => {
      const st = get().state
      const c = st.cards[cardKey]
      if (!c) return
      const m = text.trim().slice(0, 240)
      if ((c.m ?? '') === m) return
      const next: CardState = { ...c, t: Date.now() }
      if (m) next.m = m
      else delete next.m
      commit({ cards: { ...st.cards, [cardKey]: next } })
    },

    addCustom: (c) => {
      const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
      const card: CustomCard = { id, jp: c.jp.trim(), kana: c.kana.trim(), fr: c.fr.trim(), note: c.note?.trim(), t: Date.now() }
      commit({ custom: { ...get().state.custom, [id]: card } })
      checkAchievements()
      return id
    },

    editCustom: (id, c) => {
      const cur = get().state.custom[id]
      if (!cur) return
      commit({ custom: { ...get().state.custom, [id]: { ...cur, ...c, t: Date.now() } } })
    },

    deleteCustom: (id) => {
      const cur = get().state.custom[id]
      if (!cur) return
      commit({ custom: { ...get().state.custom, [id]: { ...cur, del: true, t: Date.now() } } })
    },

    startSession: (f = ALL, extra = 0, opts) => {
      const { state, items } = get()
      const now = Date.now()
      const practice = (f.scope ?? 'normal') === 'practice'
      let queue: string[]
      let warm: string[] = []
      if (practice) {
        queue = buildPractice(state, items, f, extra)
      } else {
        const q = buildQueue(state, items, f, now, extra)
        // phrases d'échauffement : en tête de séance, retirées du reste de la file pour ne pas les voir deux fois
        if (opts?.warm && !f.free) {
          warm = pickWarmup(state, items, opts.warm, now)
          const w = new Set(warm)
          q.learning = q.learning.filter((k) => !w.has(k))
          q.review = q.review.filter((k) => !w.has(k))
          q.fresh = q.fresh.filter((k) => !w.has(k))
          q.freshNat = q.freshNat.filter((k) => !w.has(k))
        }
        queue = [...warm, ...interleave(q)]
        if (f.free && f.limit != null) queue = queue.slice(0, f.limit + extra)
        if (f.cap != null) queue = queue.slice(0, f.cap)
      }
      const s: Session = {
        filter: f,
        extra,
        queue,
        learn: [],
        current: null,
        revealed: false,
        total: queue.length,
        done: 0,
        answered: 0,
        forgot: 0,
        xp: 0,
        start: now,
        shownAt: now,
        undo: null,
        finished: false,
        newSeen: 0,
        practice,
        warm,
        typeTr: !!opts?.typeTr,
        missed: [],
        seen: []
      }
      set({ session: pickNext(s, now) })
    },

    reveal: () => {
      const s = get().session
      if (s && !s.revealed) set({ session: { ...s, revealed: true } })
    },

    rate: (r) => {
      const { session: s, state, device } = get()
      if (!s || !s.current) return
      const now = Date.now()
      const dn = dayNumber(now)
      const day = dayKey(dn)
      const key = s.current

      const prevCard = state.cards[key]
      const card = prevCard ?? newCard(now)
      const wasNew = card.s === 'new' && !s.practice // en entraînement, une carte jamais vue n'est pas « découverte »
      const { dir, itemId } = parseCardId(key)
      const natural = isNaturalId(itemId)
      // entraînement : un raté compte comme une vraie révision, une réussite ne repousse pas la date de révision
      const out = s.practice ? answerPractice(card, r, now, dn) : answer(card, r, now, dn)

      const beforeLevel = levelFromXp(totalXp(state)).level
      const goalBefore = dayTotal(state, day).n >= state.settings.goal
      const xp = XP_BY_RATING[r] + (wasNew ? XP_NEW : 0)
      const sec = Math.min(60, Math.round((now - s.shownAt) / 1000))
      const prevDay = state.daily[day]?.[device]
      const daily = addToDay(state, device, day, {
        n: 1,
        ok: r >= 2 ? 1 : 0,
        nw: wasNew && dir === 'r' && !natural ? 1 : 0,
        np: wasNew && dir === 'p' ? 1 : 0,
        nv: wasNew && natural ? 1 : 0, // phrases naturelles : comptées à part (elles ne prennent pas la place des mots du jour)
        rv: card.s === 'review' && !s.practice ? 1 : 0, // compte pour le quota de révisions du jour
        xp,
        sec
      })
      commit({ cards: card.s === 'new' && s.practice ? state.cards : { ...state.cards, [key]: out.card }, daily })

      // file de la séance
      let learn = s.learn
      let queue = s.queue
      let doneInc = 0
      let requeued = false
      if (s.practice) {
        requeued = r <= 2 // Oublié / Difficile : la carte revient en fin de séance
        if (requeued) queue = [...s.queue, key]
        else doneInc = 1
      } else if (out.nextMinutes !== undefined) learn = [...s.learn, { id: key, due: now + out.nextMinutes * 60_000 }]
      else doneInc = 1
      const newMissed = r === 1 && !s.missed.includes(key)
      const newSeen = itemId.startsWith('w') && !s.seen.includes(itemId)
      let ns: Session = {
        ...s,
        learn,
        queue,
        done: s.done + doneInc,
        answered: s.answered + 1,
        forgot: s.forgot + (r === 1 ? 1 : 0),
        xp: s.xp + xp,
        newSeen: s.newSeen + (wasNew ? 1 : 0),
        missed: newMissed ? [...s.missed, key] : s.missed,
        seen: newSeen ? [...s.seen, itemId] : s.seen,
        undo: { cardKey: key, prevCard, prevDay, xp, wasNew, forgot: r === 1, shownAt: s.shownAt, practice: s.practice, requeued, newMissed, newSeen }
      }
      ns = pickNext(ns, now)
      set({ session: ns })

      // objectif quotidien atteint ?
      const after = get().state
      const goalNow = dayTotal(after, day).n >= after.settings.goal
      if (!goalBefore && goalNow && !after.ach[`g:${day}`]) {
        const daily2 = addToDay({ ...after }, device, day, { xp: XP_GOAL })
        commit({ daily: daily2, ach: { ...after.ach, [`g:${day}`]: now } })
        set((st) => (st.session ? { session: { ...st.session, xp: st.session.xp + XP_GOAL } } : {}))
        const st = streaks(get().state, now)
        pushToast({
          kind: 'goal',
          title: 'Objectif du jour atteint !',
          text: st.current > 1 ? `Série de ${st.current} jours 🔥` : 'Ta série démarre 🔥',
          emoji: '🎯'
        })
        set((x) => ({ confettiTick: x.confettiTick + 1 }))
      }
      const afterLevel = levelFromXp(totalXp(get().state)).level
      if (afterLevel > beforeLevel) {
        pushToast({ kind: 'level', title: `Niveau ${afterLevel} !`, text: levelLabel(afterLevel), emoji: '🎉' })
        set((x) => ({ confettiTick: x.confettiTick + 1 }))
      }
      checkAchievements()
      if (get().session?.finished) finishSession()
    },

    markKnown: () => {
      const { session: s, state } = get()
      if (!s || !s.current || s.practice) return
      const now = Date.now()
      const dn = dayNumber(now)
      const c = { ...newCard(now), s: 'review' as const, i: 14, d: dn + 14, r: 1 }
      commit({ cards: { ...state.cards, [s.current]: c } })
      let ns: Session = { ...s, done: s.done + 1, undo: null }
      ns = pickNext(ns, now)
      set({ session: ns })
      if (ns.finished) finishSession()
    },

    undo: () => {
      const { session: s, state, device } = get()
      if (!s || !s.undo) return
      const u = s.undo
      const now = Date.now()
      const day = dayKey(dayNumber(now))
      const cards = { ...state.cards }
      if (u.prevCard) cards[u.cardKey] = u.prevCard
      else delete cards[u.cardKey]
      const daily = { ...state.daily }
      if (u.prevDay) daily[day] = { ...(daily[day] ?? {}), [device]: u.prevDay }
      else if (daily[day]) {
        const d = { ...daily[day] }
        delete d[device]
        daily[day] = d
      }
      commit({ cards, daily })
      const missed = u.newMissed ? s.missed.filter((k) => k !== u.cardKey) : s.missed
      const seen = u.newSeen ? s.seen.filter((k) => k !== parseCardId(u.cardKey).itemId) : s.seen
      if (u.practice) {
        // entraînement : on remet la carte à l'écran (et on retire sa copie de fin de file si elle y a été remise)
        let queue = s.current ? [s.current, ...s.queue] : s.queue
        if (u.requeued) {
          const idx = queue.lastIndexOf(u.cardKey)
          if (idx >= 0) queue = queue.filter((_, i) => i !== idx)
        }
        set({
          session: {
            ...s,
            queue,
            current: u.cardKey,
            revealed: false,
            finished: false,
            answered: Math.max(0, s.answered - 1),
            forgot: Math.max(0, s.forgot - (u.forgot ? 1 : 0)),
            xp: Math.max(0, s.xp - u.xp),
            newSeen: Math.max(0, s.newSeen - (u.wasNew ? 1 : 0)),
            done: Math.max(0, s.done - (u.requeued ? 0 : 1)),
            missed,
            seen,
            undo: null,
            shownAt: now
          }
        })
        return
      }
      // remet la carte actuelle en tête de file et la carte annulée à l'écran
      const queue = s.current ? [s.current, ...s.queue] : s.queue
      const learn = s.learn.filter((l) => l.id !== u.cardKey)
      set({
        session: {
          ...s,
          queue,
          learn,
          current: u.cardKey,
          revealed: false,
          finished: false,
          answered: Math.max(0, s.answered - 1),
          forgot: Math.max(0, s.forgot - (u.forgot ? 1 : 0)),
          xp: Math.max(0, s.xp - u.xp),
          newSeen: Math.max(0, s.newSeen - (u.wasNew ? 1 : 0)),
          done: Math.max(0, s.done - (s.learn.some((l) => l.id === u.cardKey) ? 0 : 1)),
          missed,
          seen,
          undo: null,
          shownAt: now
        }
      })
    },

    endSession: () => set({ session: null }),

    /** Enregistre un examen terminé (clé « x:… » dans `ach`) + XP bonus + trophées. Renvoie l'XP gagné. */
    recordExam: (r) => {
      const { state, device } = get()
      const now = Date.now()
      const pct = r.total ? r.ok / r.total : 0
      const xp = Math.round(15 + 35 * pct)
      const before = levelFromXp(totalXp(state)).level
      const ach = { ...state.ach, [examKey({ ...r, t: now })]: now }
      commit({ ach, daily: addToDay({ ...state, ach }, device, today(), { xp }) })
      const after = levelFromXp(totalXp(get().state)).level
      if (after > before) pushToast({ kind: 'level', title: `Niveau ${after} !`, text: levelLabel(after), emoji: '🎉' })
      if (pct >= 0.7) set((x) => ({ confettiTick: x.confettiTick + 1 }))
      checkAchievements()
      return xp
    },

    /** Exercice d'écoute terminé : XP bonus (aucun effet sur le planning des cartes) + historique dans `ach` (clé « l:… »). */
    recordListen: (r) => {
      const { state, device } = get()
      const now = Date.now()
      const pct = r.total ? r.ok / r.total : 0
      const xp = Math.round(6 + 14 * pct)
      const before = levelFromXp(totalXp(state)).level
      const ach = { ...state.ach, [`l:${r.mode === 'sens' ? 's' : 'd'}:${r.ok}:${r.total}:${now}`]: now }
      commit({ ach, daily: addToDay({ ...state, ach }, device, today(), { xp }) })
      const after = levelFromXp(totalXp(get().state)).level
      if (after > before) pushToast({ kind: 'level', title: `Niveau ${after} !`, text: levelLabel(after), emoji: '🎉' })
      if (pct >= 0.8) set((x) => ({ confettiTick: x.confettiTick + 1 }))
      return xp
    },

    rateSentence: (itemId, ok) => {
      const { state, device } = get()
      const now = Date.now()
      const dn = dayNumber(now)
      const key = `${itemId}:r`
      const card = state.cards[key] ?? newCard(now)
      const wasNew = card.s === 'new'
      const r: Rating = ok ? 4 : 1
      const out = answer(card, r, now, dn)
      const xp = XP_BY_RATING[r] + (wasNew ? XP_NEW : 0)
      const before = levelFromXp(totalXp(state)).level
      const daily = addToDay(state, device, today(), { n: 1, ok: ok ? 1 : 0, nv: wasNew ? 1 : 0, xp })
      commit({ cards: { ...state.cards, [key]: out.card }, daily })
      const after = levelFromXp(totalXp(get().state)).level
      if (after > before) pushToast({ kind: 'level', title: `Niveau ${after} !`, text: levelLabel(after), emoji: '🎉' })
      checkAchievements()
    },

    restoreSnapshot: (json) => {
      try {
        const snap = sanitize(JSON.parse(json))
        const cur = get().state
        const now = Date.now()
        const cards: Record<string, CardState> = {}
        for (const key of new Set([...Object.keys(cur.cards), ...Object.keys(snap.cards)])) {
          const old = snap.cards[key]
          // une carte apprise après la copie redevient « nouvelle » ; les autres reprennent l'état de la copie
          cards[key] = old ? { ...old, t: now } : { ...newCard(now), t: now }
        }
        const custom: AppState['custom'] = {}
        for (const id of new Set([...Object.keys(cur.custom), ...Object.keys(snap.custom)])) {
          const old = snap.custom[id]
          custom[id] = old ? { ...old, t: now } : { ...cur.custom[id], del: true, t: now }
        }
        const ach = { ...cur.ach, ...snap.ach }
        commit({ cards, custom, ach })
        return true
      } catch {
        return false
      }
    },

    exportJson: () => JSON.stringify(get().state),

    importJson: (json) => {
      try {
        const incoming = sanitize(JSON.parse(json))
        const merged = mergeStates(get().state, incoming)
        const cat = buildCatalog(merged.custom)
        set({ state: merged, items: cat.items, byId: cat.byId })
        return true
      } catch {
        return false
      }
    },

    resetAll: () => {
      const fresh = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, _t: Date.now() } }
      const cat = buildCatalog({})
      set({ state: fresh, items: cat.items, byId: cat.byId, session: null })
    },

    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }
})

export function levelLabel(level: number): string {
  return level >= 30 ? 'Maître des mots' : level >= 12 ? 'Voyageur confirmé' : 'Tu avances bien'
}

// Sauvegarde locale automatique (anti-rebond)
let saveTimer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((s, prev) => {
  if (!s.ready || s.state === prev.state) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => safeSet(LS_KEY, JSON.stringify(useStore.getState().state)), 300)
})

// Sécurité : sauvegarde immédiate quand l'app passe en arrière-plan
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const s = useStore.getState()
      if (s.ready) safeSet(LS_KEY, JSON.stringify(s.state))
    }
  })
}

export { ACHIEVEMENTS }
