// v1.10 — Micro : enregistrement (shadowing) et reconnaissance vocale japonaise (production orale).
// Tout passe par les API du navigateur, sans service payant. Sur iPhone, le micro demande une autorisation
// la première fois, et doit être lancé par un tap (jamais tout seul).

// ───────── Enregistrement ─────────
export const canRecord = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

function pickMime(): string | undefined {
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  return types.find((t) => MediaRecorder.isTypeSupported?.(t))
}

export interface Recording {
  /** arrête l'enregistrement ; renvoie l'adresse du son (à libérer avec URL.revokeObjectURL) */
  stop: () => Promise<string | null>
  cancel: () => void
}

/** Démarre un enregistrement (s'arrête tout seul au bout de `maxMs`). */
export async function startRecording(maxMs = 15_000, onAutoStop?: () => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  const mime = pickMime()
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  const release = () => stream.getTracks().forEach((t) => t.stop()) // éteint le voyant du micro
  let resolveStop: (url: string | null) => void = () => {}
  const stopped = new Promise<string | null>((res) => (resolveStop = res))
  rec.onstop = () => {
    release()
    resolveStop(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || mime || 'audio/mp4' })) : null)
  }
  rec.start()
  const timer = setTimeout(() => {
    if (rec.state === 'recording') {
      rec.stop()
      onAutoStop?.()
    }
  }, maxMs)
  return {
    stop: () => {
      clearTimeout(timer)
      if (rec.state === 'recording') rec.stop()
      return stopped
    },
    cancel: () => {
      clearTimeout(timer)
      chunks.length = 0
      if (rec.state === 'recording') rec.stop()
      else release()
    }
  }
}

/** Joue un son enregistré ; la promesse se termine à la fin de la lecture. */
export function playUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const a = new Audio(url)
    a.onended = () => resolve()
    a.onerror = () => resolve()
    a.play().catch(() => resolve())
  })
}

// ───────── Reconnaissance vocale ─────────
interface RecAlt {
  transcript: string
}
interface RecEvent {
  results: ArrayLike<ArrayLike<RecAlt>>
}
interface RecErr {
  error: string
}
interface SpeechRec {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: RecEvent) => void) | null
  onerror: ((e: RecErr) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecCtor = new () => SpeechRec

function recCtor(): RecCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const canRecognize = () => !!recCtor()

export type RecognizeError = 'unsupported' | 'not-allowed' | 'no-speech' | 'network' | 'aborted' | 'other'

export interface Listening {
  /** propositions du téléphone, la plus probable d'abord */
  result: Promise<string[]>
  stop: () => void
  abort: () => void
}

/** Écoute une réponse en japonais. La promesse échoue avec un `RecognizeError`. */
export function recognizeJa(): Listening {
  const Ctor = recCtor()
  if (!Ctor) return { result: Promise.reject('unsupported' as RecognizeError), stop: () => {}, abort: () => {} }
  const r = new Ctor()
  r.lang = 'ja-JP'
  r.interimResults = false
  r.continuous = false
  r.maxAlternatives = 5
  let settled = false
  const result = new Promise<string[]>((resolve, reject) => {
    const alts: string[] = []
    r.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]
        for (let j = 0; j < res.length; j++) if (res[j]?.transcript) alts.push(res[j].transcript)
      }
    }
    r.onerror = (e) => {
      if (settled) return
      settled = true
      const code: RecognizeError =
        e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'not-allowed' : e.error === 'no-speech' ? 'no-speech' : e.error === 'network' ? 'network' : e.error === 'aborted' ? 'aborted' : 'other'
      reject(code)
    }
    r.onend = () => {
      if (settled) return
      settled = true
      if (alts.length) resolve(alts)
      else reject('no-speech' as RecognizeError)
    }
  })
  try {
    r.start()
  } catch {
    settled = true
    return { result: Promise.reject('other' as RecognizeError), stop: () => {}, abort: () => {} }
  }
  return { result, stop: () => r.stop(), abort: () => r.abort() }
}

export const RECOGNIZE_MSG: Record<RecognizeError, string> = {
  unsupported: 'La reconnaissance vocale n\'est pas disponible ici : dis le mot à voix haute, puis vérifie toi-même.',
  'not-allowed': 'Kioku n\'a pas accès au micro. Autorise-le (Réglages de l\'iPhone → Safari → Micro), ou vérifie toi-même.',
  'no-speech': 'Je n\'ai rien entendu. Réessaie en parlant un peu plus fort, près du téléphone.',
  network: 'La reconnaissance vocale a besoin d\'internet sur cet appareil. Vérifie toi-même pour cette fois.',
  aborted: 'Écoute annulée.',
  other: 'La reconnaissance vocale n\'a pas marché. Réessaie, ou vérifie toi-même.'
}
