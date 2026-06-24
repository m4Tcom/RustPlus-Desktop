import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { TRANSLATIONS } from './translations'
import { RTL_LANGS, DEFAULT_LANG } from './languages'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG)

  // Load persisted language (electron-store) on mount.
  useEffect(() => {
    window.electron?.getLanguage?.().then((l) => {
      if (l && TRANSLATIONS[l]) setLangState(l)
    })
  }, [])

  // Apply <html lang/dir> for accessibility + RTL (Arabic).
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr'
  }, [lang])

  const setLang = useCallback((l) => {
    setLangState(l)
    window.electron?.setLanguage?.(l)
  }, [])

  // t('key', { var: value }) -> string, falling back to English then the key.
  const t = useCallback(
    (key, vars) => {
      const table = TRANSLATIONS[lang] || {}
      let str = table[key] ?? TRANSLATIONS.en[key] ?? key
      if (vars) {
        for (const k of Object.keys(vars)) str = str.replaceAll(`{${k}}`, vars[k])
      }
      return str
    },
    [lang],
  )

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within I18nProvider')
  return ctx
}
