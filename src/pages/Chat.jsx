import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'

function formatTime(unixSeconds) {
  if (!unixSeconds) return ''
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { t } = useT()
  const chat = useRustStore((s) => s.chat)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)

  // Autoscroll to bottom when new messages arrive (if already near bottom).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const send = async (e) => {
    e.preventDefault()
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    const res = await window.electron.sendChat(msg)
    if (res?.ok) setText('')
    setSending(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-black/40">
        <MessageSquare className="text-rust-accent" size={20} />
        <h1 className="text-lg font-bold text-gray-100">{t('chat.title')}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {chat.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 text-sm">
            {t('chat.empty')}
          </div>
        ) : (
          chat.map((m, i) => (
            <div key={`${m.time}-${i}`} className="flex gap-2 text-sm">
              <span className="text-gray-600 tabular-nums shrink-0">{formatTime(m.time)}</span>
              <span className="font-medium shrink-0" style={{ color: m.color || '#cd4a22' }}>
                {m.name || t('chat.unknown')}:
              </span>
              <span className="text-gray-200 break-words">{m.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 p-4 border-t border-black/40 bg-rust-card/40">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('chat.placeholder')}
          maxLength={128}
          className="flex-1 px-3 py-2 rounded-lg bg-rust-bg border border-black/40 text-gray-100
                     placeholder-gray-600 focus:outline-none focus:border-rust-accent"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rust-accent hover:bg-[#b8401d]
                     text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={16} /> {t('chat.send')}
        </button>
      </form>
    </div>
  )
}
