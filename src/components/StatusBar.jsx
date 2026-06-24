import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'
import LanguageSwitcher from './LanguageSwitcher'

const DOT = {
  disconnected: 'bg-gray-500',
  connecting: 'bg-yellow-400 animate-pulse',
  connected: 'bg-green-500',
  error: 'bg-red-500',
}

export default function StatusBar() {
  const { t } = useT()
  const status = useRustStore((s) => s.status)
  const serverInfo = useRustStore((s) => s.serverInfo)
  const dot = DOT[status] ?? DOT.disconnected

  return (
    <header className="flex items-center justify-between h-12 px-4 bg-rust-card border-b border-black/40 select-none">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-rust-accent">RustPlus</span>
        <span className="text-gray-500">{t('app.subtitle')}</span>
        {serverInfo?.name && (
          <span className="ml-3 text-sm text-gray-300 truncate max-w-[420px]">{serverInfo.name}</span>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        {status === 'connected' && serverInfo?.players != null && (
          <span className="text-gray-400">
            {t('status.players', { players: serverInfo.players, max: serverInfo.maxPlayers })}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
          <span className="text-gray-300">{t(`status.${status}`)}</span>
        </div>
        <div className="w-px h-5 bg-black/40" />
        <LanguageSwitcher />
      </div>
    </header>
  )
}
