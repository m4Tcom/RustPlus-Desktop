import { useCallback, useEffect, useRef, useState } from 'react'
import { Shield, Send, Crown, Pencil, Check, X, Loader2 } from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'

function formatTime(unixSeconds) {
  if (!unixSeconds) return ''
  return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Clan() {
  const { t } = useT()
  const clan = useRustStore((s) => s.clan)
  const setClan = useRustStore((s) => s.setClan)
  const clanChat = useRustStore((s) => s.clanChat)
  const setClanChat = useRustStore((s) => s.setClanChat)
  const team = useRustStore((s) => s.team)
  const connected = useRustStore((s) => s.status === 'connected')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [editingMotd, setEditingMotd] = useState(false)
  const [motdDraft, setMotdDraft] = useState('')
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)

  // Resolve a steamId to a readable name via team data if possible.
  const nameFor = useCallback(
    (steamId) => team?.members?.find((m) => m.steamId === steamId)?.name || `…${String(steamId).slice(-4)}`,
    [team],
  )

  const refresh = useCallback(async () => {
    const res = await window.electron.getClanInfo()
    if (res?.ok) {
      setClan(res.data)
      setError(res.data ? null : 'no-clan')
    } else {
      setError(res?.error || 'error')
    }
    const chatRes = await window.electron.getClanChat()
    if (chatRes?.ok) setClanChat(chatRes.data)
    setLoading(false)
  }, [setClan, setClanChat])

  useEffect(() => {
    if (!connected) return
    refresh()
    const id = setInterval(refresh, 6000)
    return () => clearInterval(id)
  }, [connected, refresh])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [clanChat])

  const send = async (e) => {
    e.preventDefault()
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    const res = await window.electron.sendClanMessage(msg)
    if (res?.ok) {
      setText('')
      if (res.data) setClanChat(res.data)
    }
    setSending(false)
  }

  const saveMotd = async () => {
    await window.electron.setClanMotd(motdDraft)
    setEditingMotd(false)
    refresh()
  }

  const roleName = (roleId) => clan?.roles?.find((r) => r.roleId === roleId)?.name

  if (loading && !clan) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('clan.loading')}
      </div>
    )
  }

  if (!clan) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-600">
        <Shield size={48} className="mb-3 opacity-40" />
        <p className="text-sm">{error === 'no-clan' ? t('clan.none') : t('clan.error')}</p>
      </div>
    )
  }

  const sortedMembers = [...(clan.members || [])].sort(
    (a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0),
  )

  return (
    <div className="h-full flex">
      {/* Info + members */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-rust-accent" size={22} />
            <h1 className="text-2xl font-bold text-gray-100">{clan.name}</h1>
            <span className="text-sm text-gray-500">
              · {clan.members?.length || 0}{clan.maxMemberCount ? `/${clan.maxMemberCount}` : ''} {t('clan.members')}
            </span>
          </div>

          {/* MOTD */}
          <div className="bg-rust-card rounded-xl p-4 border border-black/30 mb-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">{t('clan.motd')}</span>
              {!editingMotd && (
                <button
                  onClick={() => { setMotdDraft(clan.motd || ''); setEditingMotd(true) }}
                  className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300"
                  title={t('clan.editMotd')}
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
            {editingMotd ? (
              <div className="flex gap-2">
                <input
                  value={motdDraft}
                  onChange={(e) => setMotdDraft(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-100 focus:outline-none focus:border-rust-accent"
                  autoFocus
                />
                <button onClick={saveMotd} className="p-2 rounded-lg bg-rust-accent text-white"><Check size={15} /></button>
                <button onClick={() => setEditingMotd(false)} className="p-2 rounded-lg bg-rust-card border border-black/30 text-gray-400"><X size={15} /></button>
              </div>
            ) : (
              <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">
                {clan.motd || <span className="text-gray-600">{t('clan.noMotd')}</span>}
              </p>
            )}
          </div>

          {/* Members */}
          <h2 className="text-sm font-semibold text-gray-400 mb-2">{t('clan.members')}</h2>
          <div className="space-y-1.5">
            {sortedMembers.map((m) => (
              <div key={m.steamId} className="flex items-center gap-3 bg-rust-card rounded-lg px-4 py-2.5 border border-black/30">
                <span className={`w-2 h-2 rounded-full shrink-0 ${m.online ? 'bg-green-500' : 'bg-gray-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-100 text-sm font-medium truncate">{nameFor(m.steamId)}</span>
                    {m.steamId === clan.creator && <Crown size={13} className="text-yellow-500 shrink-0" />}
                  </div>
                  {m.notes && <div className="text-[11px] text-gray-500 truncate">{m.notes}</div>}
                </div>
                {roleName(m.roleId) && (
                  <span className="text-[11px] text-gray-400 bg-black/30 px-2 py-0.5 rounded">{roleName(m.roleId)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clan chat */}
      <div className="w-80 shrink-0 border-l border-black/40 flex flex-col">
        <div className="px-4 py-3 border-b border-black/40 text-sm font-semibold text-gray-300">{t('clan.chat')}</div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {clanChat.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm">{t('clan.chatEmpty')}</div>
          ) : (
            clanChat.map((m, i) => (
              <div key={`${m.time}-${i}`} className="text-sm">
                <div className="flex gap-2 items-baseline">
                  <span className="font-medium text-rust-accent truncate">{m.name || nameFor(m.steamId)}</span>
                  <span className="text-gray-600 text-[11px] tabular-nums shrink-0">{formatTime(m.time)}</span>
                </div>
                <div className="text-gray-200 break-words">{m.message}</div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 p-3 border-t border-black/40 bg-rust-card/40">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('clan.placeholder')}
            maxLength={128}
            className="flex-1 px-3 py-2 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-rust-accent"
          />
          <button type="submit" disabled={!text.trim() || sending} className="px-3 py-2 rounded-lg bg-rust-accent hover:bg-[#b8401d] text-white disabled:opacity-50">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
