import { useCallback, useEffect, useRef, useState } from 'react'
import { ToggleLeft, ToggleRight, Bell, Box, Trash2, RefreshCw, Loader2, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { itemName } from '../lib/items'
import { useT } from '../i18n'

const TYPE_KEY = { 1: 'device.typeSwitch', 2: 'device.typeAlarm', 3: 'device.typeStorage' }

export default function Devices() {
  const { t, lang } = useT()
  const devices = useRustStore((s) => s.devices)
  const setDevices = useRustStore((s) => s.setDevices)

  const [infos, setInfos] = useState({}) // { entityId: { value, type, capacity, ... } | { error } }
  const [busy, setBusy] = useState({}) // { entityId: bool }
  const [expanded, setExpanded] = useState({}) // { entityId: bool } – storage contents
  const [autos, setAutos] = useState([]) // device automations
  const devicesRef = useRef(devices)
  devicesRef.current = devices

  useEffect(() => { window.electron.getAutomations().then((a) => setAutos(a || [])) }, [])

  const autoFor = (eid) => autos.find((a) => Number(a.entityId) === Number(eid))
  const setAutoMode = async (d, mode) => {
    const ex = autoFor(d.entityId)
    if (mode === 'off') { if (ex) setAutos(await window.electron.removeAutomation(ex.id)); return }
    if (ex) setAutos(await window.electron.updateAutomation({ id: ex.id, mode, enabled: true }))
    else setAutos(await window.electron.addAutomation({ entityId: Number(d.entityId), name: d.name, mode }))
  }
  const setAutoInterval = async (d, v) => {
    const ex = autoFor(d.entityId)
    if (ex) setAutos(await window.electron.updateAutomation({ id: ex.id, intervalMin: Math.max(1, Number(v) || 5) }))
  }

  const refreshAll = useCallback(async () => {
    const list = devicesRef.current
    const results = await Promise.all(
      list.map(async (d) => {
        const res = await window.electron.getEntityInfo(d.entityId)
        return [d.entityId, res?.ok ? res.data : { error: res?.error || 'Fehler' }]
      }),
    )
    setInfos((prev) => ({ ...prev, ...Object.fromEntries(results) }))
  }, [])

  // Fetch on mount + when device list changes, then poll every 10s.
  useEffect(() => {
    refreshAll()
    const id = setInterval(refreshAll, 10000)
    return () => clearInterval(id)
  }, [refreshAll, devices.length])

  const toggle = async (d, next) => {
    setBusy((b) => ({ ...b, [d.entityId]: true }))
    const res = await window.electron.setEntityValue(d.entityId, next)
    if (res?.ok) {
      setInfos((prev) => ({ ...prev, [d.entityId]: { ...prev[d.entityId], value: next } }))
    }
    setBusy((b) => ({ ...b, [d.entityId]: false }))
  }

  const remove = async (entityId) => {
    const updated = await window.electron.removeDevice(entityId)
    setDevices(updated)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <ToggleRight className="text-rust-accent" size={22} />
          <h1 className="text-2xl font-bold text-gray-100">{t('devices.title')}</h1>
          <button onClick={refreshAll} className="ml-2 p-1.5 rounded hover:bg-white/10 text-gray-400" title={t('devices.refresh')}>
            <RefreshCw size={15} />
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-6">{t('devices.count', { count: devices.length })}</p>

        {devices.length === 0 ? (
          <div className="text-gray-500 bg-rust-card rounded-xl p-8 text-center border border-black/30 leading-relaxed">
            {t('devices.empty')}
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => {
              const info = infos[d.entityId]
              const isSwitch = d.type === 1
              const isAlarm = d.type === 2
              const isStorage = d.type === 3
              const Icon = isAlarm ? Bell : isStorage ? Box : info?.value ? ToggleRight : ToggleLeft
              const items = info?.items || []
              const isOpen = expanded[d.entityId]
              const canExpand = isStorage && info && !info.error && items.length > 0

              return (
                <div key={d.entityId} className="bg-rust-card rounded-lg border border-black/30 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Icon size={22} className={isSwitch && info?.value ? 'text-rust-accent' : 'text-gray-400'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-100 font-medium truncate">{d.name}</div>
                    <div className="text-xs text-gray-500">
                      {t(TYPE_KEY[d.type] || 'device.generic')} · #{d.entityId}
                      {info?.error && <span className="text-red-400"> · {info.error}</span>}
                    </div>
                  </div>

                  {/* State / control */}
                  {isSwitch && (
                    <button
                      onClick={() => toggle(d, !info?.value)}
                      disabled={busy[d.entityId] || !info || info.error}
                      className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-40
                        ${info?.value ? 'bg-rust-accent' : 'bg-gray-600'}`}
                      title={info?.value ? t('devices.off') : t('devices.on')}
                    >
                      {busy[d.entityId] ? (
                        <Loader2 size={14} className="animate-spin absolute inset-0 m-auto text-white" />
                      ) : (
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all
                            ${info?.value ? 'left-[26px]' : 'left-0.5'}`}
                        />
                      )}
                    </button>
                  )}
                  {isAlarm && (
                    <span className={`text-sm ${info?.value ? 'text-red-400' : 'text-gray-500'}`}>
                      {info?.value ? t('devices.triggered') : t('devices.calm')}
                    </span>
                  )}
                  {isStorage && info && !info.error && (
                    <button
                      onClick={() => canExpand && setExpanded((p) => ({ ...p, [d.entityId]: !p[d.entityId] }))}
                      disabled={!canExpand}
                      className="flex items-center gap-1 text-sm text-gray-300 disabled:cursor-default hover:text-gray-100"
                      title={canExpand ? t('devices.contents') : undefined}
                    >
                      {canExpand && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                      {items.length}/{info.capacity ?? '?'}
                    </button>
                  )}

                  <button onClick={() => remove(d.entityId)} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-red-400" title={t('devices.remove')}>
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Automation control (switches only) */}
                {isSwitch && (
                  <div className="px-4 pb-3 pt-1 border-t border-black/30 flex items-center gap-2 flex-wrap">
                    <Clock size={14} className="text-gray-500" />
                    <span className="text-xs text-gray-500">{t('auto.title')}</span>
                    <select
                      value={autoFor(d.entityId)?.mode || 'off'}
                      onChange={(e) => setAutoMode(d, e.target.value)}
                      className="bg-rust-bg border border-black/40 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-rust-accent"
                    >
                      <option value="off">{t('auto.off')}</option>
                      <option value="night">{t('auto.night')}</option>
                      <option value="day">{t('auto.day')}</option>
                      <option value="interval">{t('auto.interval')}</option>
                    </select>
                    {autoFor(d.entityId)?.mode === 'interval' && (
                      <>
                        <input
                          type="number" min={1}
                          value={autoFor(d.entityId)?.intervalMin ?? 5}
                          onChange={(e) => setAutoInterval(d, e.target.value)}
                          className="w-16 bg-rust-bg border border-black/40 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-rust-accent"
                        />
                        <span className="text-xs text-gray-500">{t('auto.minutes')}</span>
                      </>
                    )}
                  </div>
                )}

                {canExpand && isOpen && (
                  <div className="px-4 pb-3 pt-1 border-t border-black/30 grid grid-cols-2 gap-x-4 gap-y-1">
                    {items.map((it, i) => (
                      <div key={i} className="flex justify-between text-xs gap-2">
                        <span className="text-gray-300 truncate">
                          {itemName(it.itemId, lang)}{it.itemIsBlueprint ? ` (${t('devices.blueprint')})` : ''}
                        </span>
                        <span className="text-gray-500 tabular-nums shrink-0">×{it.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
