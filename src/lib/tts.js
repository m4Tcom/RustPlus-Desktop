// Lightweight text-to-speech via the browser SpeechSynthesis API (renderer-only).

const LOCALE = {
  en: 'en-US', de: 'de-DE', ru: 'ru-RU', ko: 'ko-KR',
  'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
}

export function speak(text, lang = 'en') {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    const u = new SpeechSynthesisUtterance(String(text))
    u.lang = LOCALE[lang] || 'en-US'
    u.rate = 1
    // Prefer a voice matching the locale if one is installed.
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find((v) => v.lang === u.lang) || voices.find((v) => v.lang?.startsWith((u.lang || '').slice(0, 2)))
    if (match) u.voice = match
    window.speechSynthesis.cancel() // avoid overlapping queues
    window.speechSynthesis.speak(u)
  } catch (_) { /* ignore unsupported */ }
}
