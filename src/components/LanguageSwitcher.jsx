import { useEffect, useRef, useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { LANGUAGES } from '../i18n/languages'
import { useT } from '../i18n'

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={t('lang.title')}
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 text-gray-300 text-sm"
      >
        <Globe size={15} />
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 max-h-[70vh] overflow-y-auto bg-rust-card border border-black/50 rounded-lg shadow-2xl z-50 py-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-white/5
                ${l.code === lang ? 'text-rust-accent' : 'text-gray-200'}`}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="flex-1 truncate">{l.native}</span>
              {l.code === lang && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
