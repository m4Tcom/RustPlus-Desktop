import { useEffect, useState } from 'react'
import { Plug, Loader2, AlertCircle, CheckCircle2, Info, Gamepad2, Server, Trash2 } from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'

const FIELDS = [
  { key: 'ip', label: 'setup.fieldIp', ph: 'setup.phIp' },
  { key: 'port', label: 'setup.fieldPort', ph: 'setup.phPort' },
  { key: 'steamId', label: 'setup.fieldSteamId', ph: 'setup.phSteamId' },
  { key: 'playerToken', label: 'setup.fieldToken', ph: 'setup.phToken' },
]

// Pairing stage -> translation key
const STAGE_KEY = {
  'registering-fcm': 'pair.regFcm',
  'fetching-expo': 'pair.fetchExpo',
  'awaiting-steam': 'pair.awaitSteam',
  'registering-rustplus': 'pair.regRust',
  listening: 'pair.listening',
}

export default function Setup() {
  const { t } = useT()
  const status = useRustStore((s) => s.status)
  const statusDetail = useRustStore((s) => s.statusDetail)

  const [form, setForm] = useState({ ip: '', port: '', steamId: '', playerToken: '' })
  const [localError, setLocalError] = useState(null)
  const [pairStage, setPairStage] = useState(null)
  const [pairError, setPairError] = useState(null)
  const [profiles, setProfiles] = useState([])

  useEffect(() => {
    let active = true
    window.electron?.getSavedConfig().then((cfg) => {
      if (active && cfg) setForm((f) => ({ ...f, ...cfg }))
    })
    window.electron?.getProfiles().then((p) => active && setProfiles(p || []))
    const unsub = window.electron?.onProfilesUpdate((p) => setProfiles(p || []))
    return () => {
      active = false
      unsub?.()
    }
  }, [])

  const connectProfile = (p) => { setForm(p); window.electron.connect(p) }
  const removeProfile = async (id) => setProfiles(await window.electron.removeProfile(id))

  useEffect(() => {
    const unsubscribe = window.electron?.onPairStatus(({ stage, payload }) => {
      if (stage === 'error') {
        setPairError(typeof payload === 'string' ? payload : t('pair.running'))
        setPairStage(null)
        return
      }
      if (stage === 'server-paired') {
        const next = {
          ip: payload.ip ?? '',
          port: payload.port ?? '',
          steamId: payload.steamId ?? '',
          playerToken: payload.playerToken ?? '',
        }
        setForm(next)
        setPairStage(null)
        setPairError(null)
        setLocalError(null)
        window.electron.connect(next)
        return
      }
      setPairError(null)
      setPairStage(stage)
    })
    return () => unsubscribe?.()
  }, [t])

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value.trim() }))

  const validate = () => {
    if (!form.ip) return t('setup.errIp')
    if (!form.port || Number.isNaN(Number(form.port))) return t('setup.errPort')
    if (!/^\d{17}$/.test(form.steamId)) return t('setup.errSteamId')
    if (!form.playerToken) return t('setup.errToken')
    return null
  }

  const handleConnect = async (e) => {
    e.preventDefault()
    setLocalError(null)
    const err = validate()
    if (err) {
      setLocalError(err)
      return
    }
    await window.electron.connect(form)
  }

  const handleDisconnect = () => window.electron.disconnect()

  const handlePair = async () => {
    setPairError(null)
    setLocalError(null)
    setPairStage('registering-fcm')
    const res = await window.electron.startPairing()
    if (!res?.ok && res?.error) {
      setPairError(res.error)
      setPairStage(null)
    }
  }

  const handleCancelPair = async () => {
    await window.electron.cancelPairing()
    setPairStage(null)
  }

  const connecting = status === 'connecting'
  const connected = status === 'connected'
  const pairing = pairStage !== null
  const formDisabled = connecting || connected || pairing

  return (
    <div className="flex justify-center items-start pt-10 px-6 h-full overflow-y-auto">
      <div className="w-full max-w-lg pb-10">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">{t('setup.title')}</h1>
        <p className="text-gray-400 text-sm mb-6">{t('setup.subtitle')}</p>

        {/* Saved server profiles */}
        {!connected && profiles.length > 0 && (
          <div className="bg-rust-card rounded-xl p-5 mb-4 border border-black/30">
            <div className="flex items-center gap-2 text-gray-200 font-medium mb-3">
              <Server size={18} className="text-rust-accent" /> {t('setup.savedServers')}
            </div>
            <div className="space-y-2">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-2 bg-rust-bg rounded-lg px-3 py-2 border border-black/30">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-100 truncate">{p.name || p.ip}</div>
                    <div className="text-[11px] text-gray-500 truncate">{p.ip}:{p.port}</div>
                  </div>
                  <button onClick={() => connectProfile(p)} disabled={formDisabled}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rust-accent hover:bg-[#b8401d] text-white text-sm disabled:opacity-40">
                    <Plug size={14} /> {t('setup.connect')}
                  </button>
                  <button onClick={() => removeProfile(p.id)} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-red-400" title={t('settings.remove')}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pairing */}
        {!connected && (
          <div className="bg-rust-card rounded-xl p-6 mb-4 border border-black/30">
            <div className="flex items-center gap-2 text-gray-200 font-medium mb-1">
              <Gamepad2 size={18} className="text-rust-accent" /> {t('setup.pairTitle')}
            </div>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">{t('setup.pairDesc')}</p>

            {pairing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-200">
                  <Loader2 size={16} className="animate-spin text-rust-accent" />
                  {t(STAGE_KEY[pairStage] || 'pair.running')}
                </div>
                {pairStage === 'listening' && (
                  <div className="text-xs text-gray-500">{t('pair.listeningSub')}</div>
                )}
                <button
                  type="button"
                  onClick={handleCancelPair}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                >
                  {t('setup.pairCancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePair}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rust-accent hover:bg-[#b8401d] text-white font-medium transition-colors"
              >
                <Gamepad2 size={18} /> {t('setup.pairButton')}
              </button>
            )}

            {pairError && (
              <div className="flex items-center gap-2 text-red-400 text-sm mt-3">
                <AlertCircle size={16} /> {pairError}
              </div>
            )}
          </div>
        )}

        {!connected && (
          <div className="flex items-center gap-3 my-4 text-xs text-gray-600 uppercase tracking-wide">
            <span className="flex-1 h-px bg-black/40" />
            {t('setup.orManual')}
            <span className="flex-1 h-px bg-black/40" />
          </div>
        )}

        {/* Manual form */}
        <form onSubmit={handleConnect} className="bg-rust-card rounded-xl p-6 space-y-4 border border-black/30">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm text-gray-300 mb-1">{t(field.label)}</label>
              <input
                type="text"
                value={form[field.key]}
                onChange={update(field.key)}
                placeholder={t(field.ph)}
                disabled={formDisabled}
                spellCheck={false}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg bg-rust-bg border border-black/40 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-rust-accent disabled:opacity-50 transition-colors"
              />
            </div>
          ))}

          {localError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} /> {localError}
            </div>
          )}
          {status === 'error' && statusDetail && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              {typeof statusDetail === 'string' ? statusDetail : t('status.error')}
            </div>
          )}
          {connected && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle2 size={16} /> {t('setup.connectedOk')}
            </div>
          )}

          {!connected ? (
            <button
              type="submit"
              disabled={connecting || pairing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rust-accent hover:bg-[#b8401d] text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {connecting ? (
                <><Loader2 size={18} className="animate-spin" /> {t('setup.connecting')}</>
              ) : (
                <><Plug size={18} /> {t('setup.connect')}</>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
              {t('setup.disconnect')}
            </button>
          )}
        </form>

        {/* Hint */}
        <div className="mt-5 bg-rust-card/60 rounded-lg p-4 border border-black/30 text-sm text-gray-400">
          <div className="flex items-center gap-2 text-gray-300 mb-2 font-medium">
            <Info size={16} className="text-rust-accent" /> {t('setup.hintTitle')}
          </div>
          <p className="leading-relaxed">{t('setup.hintText')}</p>
        </div>
      </div>
    </div>
  )
}
