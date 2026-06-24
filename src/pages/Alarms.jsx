import { Siren, ShieldAlert, ShieldCheck, BellOff, Play } from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'

function fmt(t) {
  if (!t) return ''
  return new Date(t).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })
}

export default function Alarms() {
  const { t } = useT()
  const alarms = useRustStore((s) => s.alarms)
  const ackAlarm = useRustStore((s) => s.ackAlarm)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Siren className="text-rust-accent" size={22} />
          <h1 className="text-2xl font-bold text-gray-100">{t('alarms.title')}</h1>
          <div className="flex-1" />
          <button
            onClick={() => window.electron.testRaid()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rust-card border border-black/30 text-sm text-gray-200 hover:bg-white/5"
          >
            <Play size={14} /> {t('alarms.test')}
          </button>
          <button
            onClick={() => window.electron.dismissRaid()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rust-accent hover:bg-[#b8401d] text-white text-sm"
          >
            <BellOff size={14} /> {t('alarms.stop')}
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-6">{t('alarms.subtitle')}</p>

        {alarms.length === 0 ? (
          <div className="text-gray-500 bg-rust-card rounded-xl p-8 text-center border border-black/30 leading-relaxed">
            {t('alarms.empty')}
          </div>
        ) : (
          <div className="space-y-2">
            {alarms.map((a) => {
              const isReal = a.status === 'real'
              const isTest = a.status === 'test'
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 border
                    ${isReal ? 'bg-red-950/40 border-red-500/40' : 'bg-rust-card border-black/30'}`}
                >
                  <Siren size={20} className={isReal ? 'text-red-400' : isTest ? 'text-green-400' : 'text-rust-accent'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-100 font-medium truncate">{a.title || a.message || t('alarms.generic')}</div>
                    <div className="text-xs text-gray-500">
                      {fmt(a.time)}
                      {a.message && a.title ? ` · ${a.message}` : ''}
                      {a.status === 'pending' && <span className="text-yellow-500"> · {t('alarms.pending')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => ackAlarm(a.id, 'test')}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors
                        ${isTest ? 'bg-green-600/80 border-green-500 text-white' : 'bg-rust-bg border-black/40 text-gray-300 hover:bg-white/5'}`}
                    >
                      <ShieldCheck size={13} /> {t('alarms.markTest')}
                    </button>
                    <button
                      onClick={() => ackAlarm(a.id, 'real')}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors
                        ${isReal ? 'bg-red-600 border-red-500 text-white' : 'bg-rust-bg border-black/40 text-gray-300 hover:bg-white/5'}`}
                    >
                      <ShieldAlert size={13} /> {t('alarms.markReal')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
