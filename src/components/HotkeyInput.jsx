import { useEffect, useState } from 'react'
import { Keyboard, X } from 'lucide-react'
import { useT } from '../i18n'

// DOM MouseEvent.button -> our hotkey name. 0=left / 2=right are left alone so
// normal clicking keeps working; only middle / back / forward are bindable.
const MOUSE_NAME = { 1: 'MouseMiddle', 3: 'Mouse4', 4: 'Mouse5' }

// Convert a KeyboardEvent into an Electron accelerator key name (the part after
// the modifiers). Returns null for modifier-only presses so we keep waiting.
function codeToKey(e) {
  const c = e.code
  if (/^Key[A-Z]$/.test(c)) return c.slice(3)
  if (/^Digit[0-9]$/.test(c)) return c.slice(5)
  if (/^Numpad[0-9]$/.test(c)) return 'num' + c.slice(6)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(c)) return c
  const map = {
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Space: 'Space', Enter: 'Return', Backspace: 'Backspace', Delete: 'Delete',
    Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    Tab: 'Tab', Minus: '-', Equal: '=', Backquote: '`', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  }
  return map[c] || null
}

export default function HotkeyInput({ value, onChange }) {
  const { t } = useT()
  const [recording, setRecording] = useState(false)

  const onKeyDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.code === 'Escape') {
      setRecording(false)
      return
    }
    const key = codeToKey(e)
    if (!key) return // still holding only modifiers
    const parts = []
    if (e.ctrlKey) parts.push('Control')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    if (e.metaKey) parts.push('Super')
    parts.push(key)
    setRecording(false)
    onChange(parts.join('+'))
  }

  // While recording, also capture mouse buttons (middle / back / forward).
  useEffect(() => {
    if (!recording) return
    const onDown = (e) => {
      const name = MOUSE_NAME[e.button]
      if (!name) return // left / right -> let the click behave normally
      e.preventDefault()
      e.stopPropagation()
      setRecording(false)
      onChange(name)
    }
    // Capture phase so we intercept before the focus/blur teardown.
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('auxclick', onDown, true)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('auxclick', onDown, true)
    }
  }, [recording, onChange])

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={recording ? onKeyDown : undefined}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm min-w-[180px] font-mono transition-colors
          ${recording ? 'border-rust-accent bg-rust-accent/10 text-rust-accent animate-pulse'
            : 'border-black/40 bg-rust-bg text-gray-200 hover:bg-white/5'}`}
      >
        <Keyboard size={14} className="shrink-0" />
        <span className="truncate">
          {recording ? t('settings.recording') : value ? value.replace(/\+/g, ' + ') : t('settings.notSet')}
        </span>
      </button>
      {value && !recording && (
        <button onClick={() => onChange('')} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-red-400" title={t('settings.clearKey')}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
