let voice: SpeechSynthesisVoice | null = null

function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return
  const voices = speechSynthesis.getVoices()
  voice = voices.find((v) => v.lang === 'ja-JP') ?? voices.find((v) => v.lang.startsWith('ja')) ?? null
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

export const canSpeak = () => typeof speechSynthesis !== 'undefined'

/** Lit un texte japonais à voix haute (on privilégie les kana pour éviter les erreurs de lecture des kanji). */
export function speak(text: string) {
  if (!canSpeak() || !text) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/[\s。、！？]/g, (m) => (/\s/.test(m) ? '' : m)))
  u.lang = 'ja-JP'
  u.rate = 0.85
  if (voice) u.voice = voice
  speechSynthesis.speak(u)
}
