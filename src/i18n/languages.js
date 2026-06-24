// The 25 interface languages Rust officially supports on Steam.
// Source: https://store.steampowered.com/app/252490/Rust/
export const LANGUAGES = [
  { code: 'en', native: 'English', flag: '🇬🇧' },
  { code: 'de', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', native: 'Français', flag: '🇫🇷' },
  { code: 'it', native: 'Italiano', flag: '🇮🇹' },
  { code: 'es', native: 'Español (España)', flag: '🇪🇸' },
  { code: 'es-419', native: 'Español (Latinoamérica)', flag: '🇲🇽' },
  { code: 'pt-BR', native: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'pt-PT', native: 'Português (Portugal)', flag: '🇵🇹' },
  { code: 'ru', native: 'Русский', flag: '🇷🇺' },
  { code: 'uk', native: 'Українська', flag: '🇺🇦' },
  { code: 'pl', native: 'Polski', flag: '🇵🇱' },
  { code: 'tr', native: 'Türkçe', flag: '🇹🇷' },
  { code: 'nl', native: 'Nederlands', flag: '🇳🇱' },
  { code: 'cs', native: 'Čeština', flag: '🇨🇿' },
  { code: 'da', native: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', native: 'Suomi', flag: '🇫🇮' },
  { code: 'sv', native: 'Svenska', flag: '🇸🇪' },
  { code: 'nb', native: 'Norsk', flag: '🇳🇴' },
  { code: 'el', native: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'ja', native: '日本語', flag: '🇯🇵' },
  { code: 'ko', native: '한국어', flag: '🇰🇷' },
  { code: 'zh-CN', native: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', native: '繁體中文', flag: '🇹🇼' },
  { code: 'vi', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ar', native: 'العربية', flag: '🇸🇦' },
]

// Right-to-left languages (need dir="rtl").
export const RTL_LANGS = ['ar']

export const DEFAULT_LANG = 'de'
