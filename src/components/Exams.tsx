import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { estimateLevel } from '../lib/level'
import { computeProgress } from '../lib/state'
import { isKana } from '../lib/romaji'
import {
  EXAM_LEVELS,
  LEVEL_INFO,
  PASS,
  SECTIONS,
  answerText,
  bestByLevel,
  buildExam,
  correctText,
  examHistory,
  gradeExam,
  recommendedLevel,
  retryExam,
  romajiOf,
  splitMark,
  type Answer,
  type Exam,
  type ExamLevel,
  type ExamMode,
  type ExamResult,
  type Help,
  type McqQ,
  type Opt,
  type OrderQ,
  type Page,
  type Question,
  type TypeQ
} from '../lib/exam'
import { Bar, Ring, Sheet, useScrollLock, useVisibleHeight } from './ui'

// ───────────────────────── Aide à la lecture ─────────────────────────
const LS_HELP = 'kioku:examhelp'
const HELP_LABEL: Record<Help, string> = { all: 'Kana + rōmaji', kana: 'Kana', off: 'Sans aide' }
const HELP_ORDER: Help[] = ['all', 'kana', 'off']
function loadHelp(): Help {
  try {
    const v = localStorage.getItem(LS_HELP)
    if (v === 'all' || v === 'kana' || v === 'off') return v
  } catch {
    /* ignore */
  }
  return 'all'
}
function saveHelp(h: Help) {
  try {
    localStorage.setItem(LS_HELP, h)
  } catch {
    /* ignore */
  }
}

/** Texte japonais avec lecture en kana et rōmaji dessous (selon l'aide choisie). `[[mot]]` = mot souligné. */
function Jp({ text, kk, help, big, force, alwaysKana }: { text: string; kk?: string; help: Help; big?: boolean; force?: boolean; alwaysKana?: boolean }) {
  const marked = text.includes('[[')
  // sur une question « lecture du mot souligné », la lecture donnerait la réponse : on la cache (sauf en correction)
  const showK = (help !== 'off' || force || alwaysKana) && !!kk && (!marked || force)
  return (
    <div className="ex-jpblock">
      <div className={'jp ex-jp' + (big ? ' big' : '')}>
        {splitMark(text).map((s, i) => (s.mark ? <u key={i}>{s.t}</u> : <span key={i}>{s.t}</span>))}
      </div>
      {showK && <div className="jp ex-kana">{kk}</div>}
      {showK && (help === 'all' || force || (alwaysKana && help !== 'kana')) && <div className="ex-rom">{romajiOf(kk!)}</div>}
    </div>
  )
}

/** Lecture d'un choix : son kana (si différent) et son rōmaji. */
function optReading(o: Opt): string {
  return o.k || (isKana(o.t) ? o.t : '')
}
function OptText({ o, help, fr, force }: { o: Opt; help: Help; fr?: boolean; force?: boolean }) {
  const rd = fr ? '' : optReading(o)
  const showAny = (help !== 'off' || force) && !!rd
  return (
    <span className="ex-opt-t">
      <span className={fr ? 'ex-fr' : 'jp'}>{o.t}</span>
      {showAny && rd !== o.t && <span className="jp ex-kana">{rd}</span>}
      {showAny && (help === 'all' || force) && <span className="ex-rom">{romajiOf(rd)}</span>}
    </span>
  )
}

const INSTR: Record<string, string> = {
  kread: 'Choisis la bonne lecture du mot souligné.',
  kwrite: 'Écris la lecture du mot souligné (en kana ou en rōmaji).',
  ctx: 'Choisis le mot qui convient dans la phrase.',
  para: 'Choisis la phrase qui a presque le même sens.',
  kmean: 'Choisis le sens du mot en français.',
  write: 'Écris le mot en japonais (kanji, kana ou rōmaji).',
  gmcq: 'Choisis ce qui convient dans la phrase.',
  order: 'Remets les mots dans l\'ordre : touche les morceaux pour remplir les 4 cases. Seule la case ★ est notée.',
  tset: 'Écris le mot qui manque dans chaque trou (en kana ou en rōmaji).',
  rset: 'Lis le texte, puis réponds.'
}
const pageKind = (p: Page): string => (p.qs[0].kind === 'rset' ? 'rset' : p.qs[0].kind)

// ───────────────────────── Questions ─────────────────────────
function McqView({ q, ans, set, help }: { q: McqQ; ans: Answer; set: (a: Answer) => void; help: Help }) {
  return (
    <div className="ex-q">
      {q.q && <Jp text={q.q} kk={q.qk} help={help} big={q.kind !== 'rset'} alwaysKana={q.kind === 'kmean'} />}
      <div className="ex-opts" role="radiogroup">
        {q.opts.map((o, i) => (
          <button key={i} role="radio" aria-checked={ans === i} className={'ex-opt' + (ans === i ? ' on' : '')} onClick={() => set(i)}>
            <span className="ex-num">{i + 1}</span>
            <OptText o={o} help={help} fr={q.fr} />
          </button>
        ))}
      </div>
    </div>
  )
}

function TypeView({ q, ans, set, help, inSet }: { q: TypeQ; ans: Answer; set: (a: Answer) => void; help: Help; inSet: boolean }) {
  return (
    <div className="ex-q">
      {!inSet &&
        (q.fr ? (
          <div className="ex-fr-q">
            {q.q}
            {q.hint && <span className="chip">{q.hint}</span>}
          </div>
        ) : (
          <Jp text={q.q} kk={q.qk} help={help} big />
        ))}
      <div className="ex-type">
        {q.label && <b className="jp">{q.label}</b>}
        <input
          className="ex-input jp"
          value={typeof ans === 'string' ? ans : ''}
          onChange={(e) => set(e.target.value)}
          placeholder={q.fr ? '日本語 / rōmaji' : 'ひらがな / rōmaji'}
          lang="ja"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          aria-label={q.label ?? 'Ta réponse'}
        />
      </div>
    </div>
  )
}

function OrderView({ q, ans, set, help }: { q: OrderQ; ans: Answer; set: (a: Answer) => void; help: Help }) {
  const seq = Array.isArray(ans) ? ans : []
  const full = seq.length >= q.parts.length
  const place = (i: number) => !full && !seq.includes(i) && set([...seq, i])
  const remove = (slot: number) => set(seq.filter((_, k) => k !== slot))
  const around = [q.prek, '（　）', q.postk].filter(Boolean).join(' ')
  return (
    <div className="ex-q">
      <div className="jp ex-sentence">
        {q.pre && <span>{q.pre}</span>}
        {q.parts.map((_, slot) => {
          const idx = seq[slot]
          const filled = idx !== undefined
          return (
            <button key={slot} className={'ex-slot' + (slot === q.star ? ' star' : '') + (filled ? ' fill' : '')} onClick={() => filled && remove(slot)} aria-label={filled ? `Retirer ${q.parts[idx].t}` : slot === q.star ? 'Case étoile' : 'Case vide'}>
              {filled ? q.parts[idx].t : slot === q.star ? '★' : ''}
            </button>
          )
        })}
        {q.post && <span>{q.post}</span>}
      </div>
      {help !== 'off' && (q.prek || q.postk) && (
        <>
          <div className="jp ex-kana">{[q.prek, '＿＿＿＿', q.postk].filter(Boolean).join(' ')}</div>
          {help === 'all' && <div className="ex-rom">{romajiOf(around)}</div>}
        </>
      )}
      <div className="ex-tiles">
        {q.tiles.map((i) => {
          const used = seq.includes(i)
          return (
            <button key={i} className={'ex-tile' + (used ? ' used' : '')} disabled={used} onClick={() => place(i)}>
              <OptText o={q.parts[i]} help={help} />
            </button>
          )
        })}
      </div>
      {seq.length > 0 && (
        <button className="ex-link" onClick={() => set([])}>
          Tout effacer
        </button>
      )}
    </div>
  )
}

function PageView({ page, answers, setAnswer, help }: { page: Page; answers: Record<string, Answer>; setAnswer: (id: string, a: Answer) => void; help: Help }) {
  const kind = pageKind(page)
  const isTset = page.qs[0].kind === 'tset'
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="ex-instr">{INSTR[kind] ?? ''}</div>
      {page.ctx && (
        <div className="ex-passage">
          <Jp text={page.ctx} kk={page.ctxk} help={help} />
        </div>
      )}
      {page.qs.map((q) => {
        const set = (a: Answer) => setAnswer(q.id, a)
        const ans = answers[q.id]
        return (
          <div key={q.id}>
            {q.t === 'mcq' && <McqView q={q} ans={ans} set={set} help={help} />}
            {q.t === 'type' && <TypeView q={q} ans={ans} set={set} help={help} inSet={isTset} />}
            {q.t === 'order' && <OrderView q={q} ans={ans} set={set} help={help} />}
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────── Correction ─────────────────────────
function QReview({ row }: { row: { q: Question; ans: Answer; ok: boolean } }) {
  const { q, ans, ok } = row
  const good = q.t === 'mcq' ? q.opts[q.a] : undefined
  return (
    <div className={'ex-rev ' + (ok ? 'good' : 'bad')}>
      <div className="ex-rev-h">
        <span className="ex-mark">{ok ? '✓' : '✗'}</span>
        {q.t === 'order' ? <div className="ex-fr-q">{q.pre}{q.parts.map((_, i) => (i === q.star ? ' ★ ' : ' ＿ '))}{q.post}</div> : q.t === 'type' && q.fr ? <div className="ex-fr-q">{q.q}</div> : q.t === 'type' && q.label && q.kind === 'tset' ? <b className="jp">{q.label}</b> : <Jp text={q.q} kk={q.qk} help="all" force />}
      </div>
      {!ok && (
        <div className="ex-line">
          Ta réponse : <b className="jp">{answerText(q, ans)}</b>
        </div>
      )}
      <div className="ex-line">
        Bonne réponse : <b className="jp">{correctText(q)}</b>
        {good && optReading(good) && optReading(good) !== good.t && <span className="jp ex-kana inline"> {optReading(good)}</span>}
        {good && optReading(good) && <span className="ex-rom inline"> · {romajiOf(optReading(good))}</span>}
      </div>
      <div className="ex-x">{q.x}</div>
    </div>
  )
}

// ───────────────────────── L'examen en plein écran ─────────────────────────
function ExamRunner({ exam, help, onHelp, onExit, onRetry }: { exam: Exam; help: Help; onHelp: (h: Help) => void; onExit: () => void; onRetry: (e: Exam) => void }) {
  const recordExam = useStore((s) => s.recordExam)
  const [pi, setPi] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [result, setResult] = useState<ExamResult | null>(null)
  const [xp, setXp] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [showRev, setShowRev] = useState(false)
  const started = useRef(Date.now())
  const elapsed = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  useVisibleHeight(true)
  useScrollLock(true)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [pi, result])

  const page = exam.pages[pi]
  const last = pi === exam.pages.length - 1
  const setAnswer = (id: string, a: Answer) => setAnswers((cur) => ({ ...cur, [id]: a }))
  const answered = page ? page.qs.some((q) => answers[q.id] !== undefined && answers[q.id] !== '' && !(Array.isArray(answers[q.id]) && !(answers[q.id] as number[]).length)) : false

  const finish = () => {
    if (done.current) return
    done.current = true
    const r = gradeExam(exam, answers)
    elapsed.current = Math.round((Date.now() - started.current) / 1000)
    if (!exam.practice) setXp(recordExam({ lvl: exam.lvl, mode: exam.mode, ok: r.ok, total: r.total }))
    setResult(r)
  }

  const cycleHelp = () => onHelp(HELP_ORDER[(HELP_ORDER.indexOf(help) + 1) % HELP_ORDER.length])

  const node = (
    <div className="ex-run" role="dialog" aria-modal="true" aria-label={`Examen ${exam.lvl}`}>
      {!result ? (
        <>
          <div className="ex-top">
            <button className="ex-x-btn" onClick={() => setLeaving(true)} aria-label="Quitter le test">✕</button>
            <div className="ex-prog"><i style={{ width: `${(pi / exam.pages.length) * 100}%` }} /></div>
            <span className="tnum small muted">{pi + 1}/{exam.pages.length}</span>
          </div>
          <div className="ex-meta">
            <span className="chip accent">{exam.practice ? 'Mes erreurs' : exam.lvl}</span>
            <span className="chip">{SECTIONS[page.sec].fr}</span>
            <button className="chip btn-chip" onClick={cycleHelp} aria-label="Changer l'aide à la lecture">Aide : {HELP_LABEL[help]}</button>
          </div>
          {leaving && (
            <div className="ex-leave">
              <span>Quitter ? Ce test ne sera pas enregistré.</span>
              <button className="btn plain" onClick={() => setLeaving(false)}>Continuer</button>
              <button className="btn danger" onClick={onExit}>Quitter</button>
            </div>
          )}
          <div className="ex-body" ref={bodyRef}>
            <PageView key={page.id} page={page} answers={answers} setAnswer={setAnswer} help={help} />
          </div>
          <div className="ex-foot">
            {pi > 0 && (
              <button className="btn plain" onClick={() => setPi(pi - 1)} aria-label="Question précédente">‹</button>
            )}
            <button className="btn grow" onClick={() => (last ? finish() : setPi(pi + 1))}>
              {last ? 'Terminer le test' : answered ? 'Suivant' : 'Passer'}
            </button>
          </div>
        </>
      ) : (
        <ResultView exam={exam} result={result} xp={xp} secs={elapsed.current} showRev={showRev} onToggle={() => setShowRev((v) => !v)} onExit={onExit} onRetry={() => onRetry(retryExam(exam, result))} bodyRef={bodyRef} />
      )}
    </div>
  )
  return createPortal(node, document.body)
}

function ResultView({ exam, result, xp, secs, showRev, onToggle, onExit, onRetry, bodyRef }: { exam: Exam; result: ExamResult; xp: number; secs: number; showRev: boolean; onToggle: () => void; onExit: () => void; onRetry: () => void; bodyRef: RefObject<HTMLDivElement> }) {
  const pct = Math.round(result.pct * 100)
  const wrong = result.rows.filter((r) => !r.ok).length
  const full = exam.mode === 'full' && !exam.practice
  let head: string
  let sub: string
  if (exam.practice) {
    head = wrong === 0 ? 'Tout est bon cette fois 🎉' : 'Encore quelques erreurs'
    sub = 'Ces réponses ne sont pas enregistrées : c\'est de l\'entraînement.'
  } else if (full) {
    head = result.passed ? `${exam.lvl} validé ! 🎉` : `Pas encore ${exam.lvl}`
    sub = result.passed ? `Tu dépasses les ${PASS * 100} % demandés. Bravo, ce n'est pas rien.` : `Il faut ${PASS * 100} % pour valider. Regarde la correction, puis réessaie : les questions changent à chaque fois.`
  } else {
    head = result.passed ? 'Très bon début 👏' : 'C\'est un point de départ'
    sub = result.passed ? `Tu peux tenter l'examen complet ${exam.lvl} pour le valider.` : 'Le but d\'un test rapide : voir ce qu\'il reste à travailler. Aucune pression.'
  }
  const pages = exam.pages.map((p) => ({ p, rows: result.rows.filter((r) => p.qs.some((q) => q.id === r.q.id)) }))
  const mm = Math.floor(secs / 60)
  return (
    <>
      <div className="ex-top">
        <span style={{ width: 34 }} />
        <div className="grow" style={{ textAlign: 'center', fontWeight: 700 }}>Résultat · {exam.practice ? 'mes erreurs' : `${exam.lvl} ${exam.mode === 'full' ? 'complet' : 'rapide'}`}</div>
        <button className="ex-x-btn" onClick={onExit} aria-label="Fermer">✕</button>
      </div>
      <div className="ex-body" ref={bodyRef}>
        <div className="stack" style={{ gap: 16 }}>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="card ex-score">
            <Ring pct={result.pct} size={132} stroke={14}>
              <b className="tnum" style={{ fontSize: 30, lineHeight: 1 }}>{pct} %</b>
              <span className="muted small tnum">{result.ok} / {result.total}</span>
            </Ring>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', textAlign: 'center' }}>{head}</div>
            <div className="muted small" style={{ textAlign: 'center', maxWidth: 360 }}>{sub}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {!exam.practice && <span className="chip accent">+{xp} XP</span>}
              <span className="chip">⏱ {mm > 0 ? `${mm} min` : `${secs} s`}</span>
            </div>
          </motion.div>

          <div className="card">
            <div className="free-sec" style={{ marginTop: 0 }}>Par partie</div>
            <div className="stack" style={{ gap: 12 }}>
              {(Object.keys(SECTIONS) as Array<keyof typeof SECTIONS>).map((s) => {
                const r = result.sections[s]
                if (!r.total) return null
                return (
                  <div key={s}>
                    <div className="row spread small" style={{ marginBottom: 5 }}>
                      <span><b>{SECTIONS[s].fr}</b> <span className="muted jp">{SECTIONS[s].jp}</span></span>
                      <span className="tnum muted">{r.ok}/{r.total}</span>
                    </div>
                    <Bar pct={r.ok / r.total} thin />
                  </div>
                )
              })}
            </div>
            {full && <p className="muted small" style={{ margin: '14px 0 0' }}>Seuil de l'app : 70 %. Au vrai JLPT, le score est calculé partie par partie (avec l'écoute) : prends ça comme une boussole, pas comme un diplôme.</p>}
          </div>

          <div className="stack" style={{ gap: 10 }}>
            <button className="btn ghost block" onClick={onToggle}>{showRev ? 'Masquer la correction' : 'Voir la correction détaillée'}</button>
            {wrong > 0 && <button className="btn plain block" onClick={onRetry}>Refaire mes {wrong} erreur{wrong > 1 ? 's' : ''}</button>}
          </div>

          {showRev && (
            <div className="stack" style={{ gap: 12 }}>
              {pages.map(({ p, rows }) => (
                <div key={p.id} className="stack" style={{ gap: 8 }}>
                  {p.ctx && (
                    <div className="ex-passage">
                      <Jp text={p.ctx} kk={p.ctxk} help="all" force />
                    </div>
                  )}
                  {rows.map((r) => (
                    <QReview key={r.q.id} row={r} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="ex-foot">
        <button className="btn grow" onClick={onExit}>Terminer</button>
      </div>
    </>
  )
}

// ───────────────────────── La feuille « Examens » ─────────────────────────
const MODES: Array<{ id: ExamMode; title: string; desc: string }> = [
  { id: 'mini', title: 'Test rapide', desc: '≈ 12 questions · 5 min · pour te situer, sans pression' },
  { id: 'full', title: 'Examen complet', desc: '≈ 30 questions · 20 min · 70 % pour valider le niveau' }
]

export function Exams({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, items } = useStore()
  const [sel, setSel] = useState<ExamLevel | null>(null)
  const [mode, setMode] = useState<ExamMode>('mini')
  const [help, setHelpState] = useState<Help>(loadHelp)
  const [run, setRun] = useState<{ exam: Exam; key: number } | null>(null)
  const setHelp = (h: Help) => {
    setHelpState(h)
    saveHelp(h)
  }

  const history = useMemo(() => examHistory(state.ach), [state.ach])
  const best = useMemo(() => bestByLevel(history), [history])
  const est = useMemo(() => estimateLevel(computeProgress(state, items).wordsKnownR), [state, items])
  const rec = recommendedLevel(est.milestone.id, best)
  const lvl = sel ?? rec

  const start = () => setRun({ exam: buildExam(lvl, mode, items), key: Date.now() })

  const footer: ReactNode = (
    <button className="btn block" onClick={start}>
      Commencer · {lvl} {mode === 'full' ? 'complet' : 'rapide'}
    </button>
  )

  return (
    <>
      <Sheet open={open && !run} onClose={onClose} footer={footer}>
        <div className="stack" style={{ gap: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>Examens</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Des tests dans le style du JLPT : choix multiples, textes à trous, mots à écrire, phrases à remettre dans l'ordre, lecture. Tous les niveaux sont ouverts.
            </p>
          </div>

          <div>
            <div className="free-sec">Niveau</div>
            <p className="muted small" style={{ margin: '-2px 2px 10px' }}>Les niveaux au-dessus du conseillé sont plus durs, mais tu peux les tenter quand tu veux.</p>
            <div className="stack" style={{ gap: 8 }}>
              {EXAM_LEVELS.map((l) => {
                const b = best[l]
                return (
                  <button key={l} className={'mode-opt ex-level' + (lvl === l ? ' on' : '')} onClick={() => setSel(l)}>
                    <b className="ex-lv jp">{l}</b>
                    <div className="grow">
                      <div className="t">
                        {LEVEL_INFO[l].title}
                        {l === rec && <span className="chip accent" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}>Conseillé</span>}
                      </div>
                      <div className="d">{LEVEL_INFO[l].sub}</div>
                    </div>
                    <span className="ex-best tnum">
                      {b.passed ? '✓ validé' : b.full !== null ? `${Math.round(b.full * 100)} %` : b.mini !== null ? `rapide ${Math.round(b.mini * 100)} %` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="free-sec">Format</div>
            <div className="stack" style={{ gap: 8 }}>
              {MODES.map((m) => (
                <button key={m.id} className={'mode-opt' + (mode === m.id ? ' on' : '')} onClick={() => setMode(m.id)}>
                  <div>
                    <div className="t">{m.title}</div>
                    <div className="d">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="free-sec">Aide à la lecture</div>
            <div className="seg">
              {HELP_ORDER.map((h) => (
                <button key={h} className={help === h ? 'on' : ''} onClick={() => setHelp(h)}>{HELP_LABEL[h]}</button>
              ))}
            </div>
            <p className="muted small" style={{ margin: '8px 2px 0' }}>
              {help === 'all' ? 'Chaque texte japonais est suivi de sa lecture en kana et en rōmaji.' : help === 'kana' ? 'Seulement la lecture en kana sous les textes.' : 'Comme au vrai examen : aucune aide.'} Tu peux la changer pendant le test.
            </p>
          </div>

          {history.length > 0 && (
            <div>
              <div className="free-sec">Mes derniers tests</div>
              <div className="list">
                {history.slice(0, 5).map((r) => (
                  <div key={r.t} className="list-row" style={{ padding: '11px 14px' }}>
                    <b className="jp" style={{ width: 34 }}>{r.lvl}</b>
                    <div className="grow small muted">
                      {r.mode === 'full' ? 'Examen complet' : 'Test rapide'} · {new Date(r.t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                    <b className="tnum">{Math.round((r.ok / r.total) * 100)} %</b>
                    <span className="muted tnum small">{r.ok}/{r.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sheet>
      {run && (
        <ExamRunner
          key={run.key}
          exam={run.exam}
          help={help}
          onHelp={setHelp}
          onExit={() => setRun(null)}
          onRetry={(e) => setRun({ exam: e, key: Date.now() })}
        />
      )}
    </>
  )
}
