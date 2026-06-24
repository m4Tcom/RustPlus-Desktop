import { useEffect, useState } from 'react'
import { SlidersHorizontal, Siren, Power, Image, Plus, Trash2, Eye, EyeOff, AlertCircle, Volume2, Bell, Webhook, Map, Heart } from 'lucide-react'
import HotkeyInput from '../components/HotkeyInput'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'

// ⬇️ Dein Spenden-Link. Revolut.me funktioniert sofort mit deinem Revolut-Konto
// (Revolut-App → Profil → "Revolut.me" / Link teilen). Jede URL geht hier.
const DONATE_URL = 'https://revolut.me/mathis_j1_xrtt'

// Small reusable on/off switch.
function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-rust-accent' : 'bg-gray-600'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[26px]' : 'left-0.5'}`} />
    </button>
  )
}

// Corner picker for a custom overlay (↖ ↗ ↙ ↘).
const CORNERS = [['tl', '↖'], ['tr', '↗'], ['bl', '↙'], ['br', '↘']]
function CornerSelect({ value, onChange, title }) {
  return (
    <select value={value || 'br'} onChange={(e) => onChange(e.target.value)} title={title}
      className="bg-rust-bg border border-black/40 rounded px-1.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-rust-accent">
      {CORNERS.map(([v, sym]) => (<option key={v} value={v}>{sym}</option>))}
    </select>
  )
}

// One labelled toggle row.
function Row({ label, desc, on, onClick }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-100">{label}</div>
        {desc && <div className="text-[12px] text-gray-500">{desc}</div>}
      </div>
      <Toggle on={on} onClick={onClick} />
    </div>
  )
}

export default function Settings() {
  const { t } = useT()
  const setAppSettings = useRustStore((s) => s.setAppSettings)
  const [settings, setSettings] = useState(null)
  const [overlays, setOverlays] = useState([])
  const [hotkeyErr, setHotkeyErr] = useState(null)
  const [webhook, setWebhook] = useState('')

  // Persist a preference and mirror it into the global store (so the live
  // TTS/event watchers pick it up immediately).
  const setPref = async (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }))
    const res = await window.electron.setSettings({ [key]: value })
    if (res?.settings) setAppSettings(res.settings)
  }

  // New-overlay form
  const [pick, setPick] = useState(null) // { path, name }
  const [newLabel, setNewLabel] = useState('')
  const [newHotkey, setNewHotkey] = useState('')
  const [newCorner, setNewCorner] = useState('br')
  const [newSize, setNewSize] = useState(340)

  useEffect(() => {
    window.electron.getSettings().then((s) => { setSettings(s); setWebhook(s?.discordWebhook || ''); setAppSettings(s || {}) })
    window.electron.getOverlays().then(setOverlays)
    return window.electron.onOverlayState(({ id, visible }) =>
      setOverlays((list) => list.map((o) => (o.id === id ? { ...o, visible } : o))),
    )
  }, [])

  const saveStopHotkey = async (accel) => {
    setHotkeyErr(null)
    const res = await window.electron.setStopHotkey(accel)
    if (res?.ok) setSettings((s) => ({ ...s, stopRaidHotkey: accel }))
    else setHotkeyErr(res?.error || 'Fehler')
  }

  const saveMinimapHotkey = async (accel) => {
    const res = await window.electron.setMinimapHotkey(accel)
    if (res?.ok) setSettings((s) => ({ ...s, minimapHotkey: accel }))
  }

  const toggleAutostart = async () => {
    const on = !settings.autostart
    await window.electron.setAutostart(on)
    setSettings((s) => ({ ...s, autostart: on }))
  }

  const choose = async () => {
    const res = await window.electron.pickOverlayImage()
    if (res?.ok) {
      setPick({ path: res.path, name: res.name })
      if (!newLabel) setNewLabel(res.name.replace(/\.[^.]+$/, ''))
    }
  }

  const addOverlay = async () => {
    if (!pick) return
    const list = await window.electron.addOverlay({ label: newLabel || pick.name, src: pick.path, hotkey: newHotkey, corner: newCorner, size: newSize })
    setOverlays(list)
    setPick(null)
    setNewLabel('')
    setNewHotkey('')
    setNewCorner('br')
    setNewSize(340)
  }

  const updateHotkey = async (id, hotkey) => setOverlays(await window.electron.updateOverlay({ id, hotkey }))
  const updateOverlayField = async (id, patch) => setOverlays(await window.electron.updateOverlay({ id, ...patch }))
  const removeOverlay = async (id) => setOverlays(await window.electron.removeOverlay(id))
  const toggleVisible = async (id) => {
    const res = await window.electron.toggleOverlay(id)
    setOverlays((list) => list.map((o) => (o.id === id ? { ...o, visible: res.visible } : o)))
  }

  if (!settings) return <div className="h-full flex items-center justify-center text-gray-500">…</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="text-rust-accent" size={22} />
          <h1 className="text-2xl font-bold text-gray-100">{t('settings.title')}</h1>
        </div>

        {/* Raid-stop hotkey */}
        <section className="bg-rust-card rounded-xl p-5 border border-black/30">
          <div className="flex items-center gap-2 mb-1">
            <Siren size={17} className="text-rust-accent" />
            <h2 className="font-semibold text-gray-100">{t('settings.stopHotkey')}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-3">{t('settings.stopHotkeyDesc')}</p>
          <HotkeyInput value={settings.stopRaidHotkey} onChange={saveStopHotkey} />
          {hotkeyErr && (
            <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
              <AlertCircle size={13} /> {hotkeyErr}
            </div>
          )}
          <p className="text-[11px] text-gray-600 mt-2">{t('settings.mouseNote')}</p>
        </section>

        {/* Autostart */}
        <section className="bg-rust-card rounded-xl p-5 border border-black/30 flex items-center gap-3">
          <Power size={17} className="text-rust-accent shrink-0" />
          <div className="flex-1">
            <h2 className="font-semibold text-gray-100">{t('settings.autostart')}</h2>
            <p className="text-sm text-gray-400">{t('settings.autostartDesc')}</p>
          </div>
          <button
            onClick={toggleAutostart}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${settings.autostart ? 'bg-rust-accent' : 'bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${settings.autostart ? 'left-[26px]' : 'left-0.5'}`} />
          </button>
        </section>

        {/* In-game overlay minimap */}
        <section className="bg-rust-card rounded-xl p-5 border border-black/30">
          <div className="flex items-center gap-2 mb-1">
            <Map size={17} className="text-rust-accent" />
            <h2 className="font-semibold text-gray-100">{t('settings.minimap')}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-3">{t('settings.minimapDesc')}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <HotkeyInput value={settings.minimapHotkey} onChange={saveMinimapHotkey} />
            <button onClick={() => window.electron.toggleMinimap()}
              className="px-3 py-1.5 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-200 hover:bg-white/5">
              {t('settings.minimapToggle')}
            </button>
          </div>
        </section>

        {/* Voice announcements (TTS) */}
        <section className="bg-rust-card rounded-xl p-5 border border-black/30">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 size={17} className="text-rust-accent" />
            <h2 className="font-semibold text-gray-100">{t('settings.tts')}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-2">{t('settings.ttsDesc')}</p>
          <div className="divide-y divide-black/20">
            <Row label={t('settings.ttsAlarm')} on={!!settings.ttsAlarm} onClick={() => setPref('ttsAlarm', !settings.ttsAlarm)} />
            <Row label={t('settings.ttsChat')} on={!!settings.ttsChat} onClick={() => setPref('ttsChat', !settings.ttsChat)} />
          </div>
        </section>

        {/* World / team event notifications */}
        <section className="bg-rust-card rounded-xl p-5 border border-black/30">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={17} className="text-rust-accent" />
            <h2 className="font-semibold text-gray-100">{t('settings.events')}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-2">{t('settings.eventsDesc')}</p>
          <div className="divide-y divide-black/20">
            <Row label={t('marker.cargo')} on={!!settings.eventCargo} onClick={() => setPref('eventCargo', !settings.eventCargo)} />
            <Row label={t('marker.heli')} on={!!settings.eventHeli} onClick={() => setPref('eventHeli', !settings.eventHeli)} />
            <Row label={t('marker.chinook')} on={!!settings.eventChinook} onClick={() => setPref('eventChinook', !settings.eventChinook)} />
            <Row label={t('settings.eventDeath')} on={!!settings.eventDeath} onClick={() => setPref('eventDeath', !settings.eventDeath)} />
            <Row label={t('settings.eventOnline')} on={!!settings.eventOnline} onClick={() => setPref('eventOnline', !settings.eventOnline)} />
            <Row label={t('settings.proximityWarn')} desc={t('settings.proximityWarnDesc')} on={!!settings.proximityWarn} onClick={() => setPref('proximityWarn', !settings.proximityWarn)} />
          </div>
        </section>

        {/* Discord webhook */}
        <section className="bg-rust-card rounded-xl p-5 border border-black/30">
          <div className="flex items-center gap-2 mb-1">
            <Webhook size={17} className="text-rust-accent" />
            <h2 className="font-semibold text-gray-100">{t('settings.discord')}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-3">{t('settings.discordDesc')}</p>
          <input
            type="url"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            onBlur={() => setPref('discordWebhook', webhook.trim())}
            placeholder="https://discord.com/api/webhooks/…"
            className="w-full px-3 py-2 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-rust-accent mb-2"
          />
          <Row label={t('settings.discordAlarms')} on={!!settings.discordAlarms} onClick={() => setPref('discordAlarms', !settings.discordAlarms)} />
          <Row label={t('settings.discordChat')} on={!!settings.discordChat} onClick={() => setPref('discordChat', !settings.discordChat)} />
        </section>

        {/* Custom overlays */}
        <section className="bg-rust-card rounded-xl p-5 border border-black/30">
          <div className="flex items-center gap-2 mb-1">
            <Image size={17} className="text-rust-accent" />
            <h2 className="font-semibold text-gray-100">{t('settings.overlays')}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">{t('settings.overlaysDesc')}</p>

          <div className="space-y-2 mb-4">
            {overlays.length === 0 && <p className="text-sm text-gray-600">{t('settings.noOverlays')}</p>}
            {overlays.map((o) => (
              <div key={o.id} className="flex items-center gap-2 bg-rust-bg rounded-lg px-3 py-2 border border-black/30 flex-wrap">
                <button onClick={() => toggleVisible(o.id)} className={`p-1.5 rounded ${o.visible ? 'text-rust-accent' : 'text-gray-500 hover:text-gray-300'}`} title={o.visible ? t('settings.hide') : t('settings.show')}>
                  {o.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <span className="flex-1 min-w-[80px] text-sm text-gray-100 truncate">{o.label}</span>
                <CornerSelect value={o.corner} onChange={(c) => updateOverlayField(o.id, { corner: c })} title={t('settings.overlayCorner')} />
                <input
                  type="number" min={80} step={20} value={o.size ?? 340}
                  onChange={(e) => updateOverlayField(o.id, { size: Math.max(80, Number(e.target.value) || 340) })}
                  title={t('settings.overlaySize')}
                  className="w-16 bg-rust-bg border border-black/40 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-rust-accent"
                />
                <HotkeyInput value={o.hotkey} onChange={(hk) => updateHotkey(o.id, hk)} />
                <button onClick={() => removeOverlay(o.id)} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-red-400" title={t('settings.remove')}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Add overlay */}
          <div className="border-t border-black/30 pt-4 flex flex-wrap items-center gap-2">
            <button onClick={choose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-200 hover:bg-white/5">
              <Image size={14} /> {pick ? pick.name : t('settings.pickImage')}
            </button>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t('settings.label')}
              className="px-3 py-1.5 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-rust-accent w-32"
            />
            <CornerSelect value={newCorner} onChange={setNewCorner} title={t('settings.overlayCorner')} />
            <input
              type="number" min={80} step={20} value={newSize}
              onChange={(e) => setNewSize(Math.max(80, Number(e.target.value) || 340))}
              title={t('settings.overlaySize')}
              className="w-16 bg-rust-bg border border-black/40 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-rust-accent"
            />
            <HotkeyInput value={newHotkey} onChange={setNewHotkey} />
            <button onClick={addOverlay} disabled={!pick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rust-accent hover:bg-[#b8401d] text-white text-sm disabled:opacity-40">
              <Plus size={14} /> {t('settings.add')}
            </button>
          </div>
        </section>

        {/* Support / donate */}
        <section className="bg-rust-card rounded-xl p-5 border border-black/30 flex items-center gap-3">
          <Heart size={17} className="text-rust-accent shrink-0" />
          <div className="flex-1">
            <h2 className="font-semibold text-gray-100">{t('settings.support')}</h2>
            <p className="text-sm text-gray-400">{t('settings.supportDesc')}</p>
          </div>
          <button
            onClick={() => window.electron.openExternal(DONATE_URL)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rust-accent hover:bg-[#b8401d] text-white text-sm shrink-0"
          >
            <Heart size={14} /> {t('settings.supportButton')}
          </button>
        </section>
      </div>
    </div>
  )
}
