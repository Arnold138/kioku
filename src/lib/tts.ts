// Voix japonaise : synthèse vocale de l'appareil (gratuite, fonctionne hors ligne sur iPhone).
// Sur iPhone, les voix « améliorées » (Kyoko, Otoya…) se téléchargent dans
// Réglages → Accessibilité → Contenu énoncé → Voix → Japonais.

let voice: SpeechSynthesisVoice | null = null
let wanted = '' // nom de la voix choisie dans les Réglages ('' = automatique)
let defaultRate = 0.85

const hasSynth = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'

/** Voix japonaises disponibles sur l'appareil, les meilleures d'abord (améliorées / premium). */
export function japaneseVoices(): SpeechSynthesisVoice[] {
  if (!hasSynth()) return []
  const score = (v: SpeechSynthesisVoice) => (/premium/i.test(v.name) ? 3 : /enhanced|améliorée/i.test(v.name) ? 2 : v.localService ? 1 : 0)
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'))
    .sort((a, b) => score(b) - score(a))
}

function pickVoice() {
  const list = japaneseVoices()
  voice = (wanted && list.find((v) => v.name === wanted)) || list[0] || null
}

if (hasSynth()) {
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

export const canSpeak = () => hasSynth()

/** Applique les réglages de voix (appelé au démarrage et quand les Réglages changent). */
export function configureVoice(opts: { name?: string; rate?: number }) {
  wanted = opts.name ?? ''
  if (opts.rate) defaultRate = opts.rate
  pickVoice()
}

/** Nettoie un texte avant lecture : on enlève les espaces (kana découpés) mais on garde la ponctuation, qui donne le rythme. */
export const speakable = (text: string) => text.replace(/\s+/g, '')

/**
 * Lit un texte japonais à voix haute (on privilégie les kana pour éviter les erreurs de lecture des kanji).
 * Renvoie une promesse résolue à la fin de la lecture (ou tout de suite si la voix n'est pas disponible).
 */
export function speak(text: string, rate?: number): Promise<void> {
  if (!hasSynth() || !text) return Promise.resolve()
  speechSynthesis.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(speakable(text))
    u.lang = 'ja-JP'
    u.rate = rate ?? defaultRate
    if (voice) u.voice = voice
    // sécurité : certains navigateurs n'envoient jamais « end »
    const guard = setTimeout(resolve, 1500 + text.length * 400)
    const done = () => {
      clearTimeout(guard)
      resolve()
    }
    u.onend = done
    u.onerror = done
    speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (hasSynth()) speechSynthesis.cancel()
}

/** v1.21 : lit un texte en français (traductions du mode voiture et de l'écoute en boucle). */
export function speakFr(text: string, rate = 1): Promise<void> {
  if (!hasSynth() || !text) return Promise.resolve()
  speechSynthesis.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'fr-FR'
    u.rate = rate
    const fr = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('fr'))
    if (fr) u.voice = fr
    const guard = setTimeout(resolve, 1500 + text.length * 120)
    const done = () => { clearTimeout(guard); resolve() }
    u.onend = done
    u.onerror = done
    speechSynthesis.speak(u)
  })
}

/** v1.21 : garde l'écran allumé (mode voiture, écoute en boucle). Sans effet si le téléphone ne le permet pas. */
export async function keepAwake(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const lock = await nav.wakeLock?.request('screen')
    return () => { void lock?.release().catch(() => {}) }
  } catch {
    return () => {}
  }
}

/** v1.21 : sur iPhone, la voix doit d'abord partir d'un tap. On lance une phrase muette au moment du tap. */
export function unlockSpeech() {
  if (!hasSynth()) return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    speechSynthesis.speak(u)
  } catch { /* rien */ }
}
