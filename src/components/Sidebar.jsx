import { Settings, Map, Users, ToggleLeft, Video, Shield, Siren, MessageSquare, SlidersHorizontal, Package, Bomb } from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'

const ITEMS = [
  { id: 'setup', key: 'nav.setup', icon: Settings, alwaysEnabled: true },
  { id: 'map', key: 'nav.map', icon: Map },
  { id: 'team', key: 'nav.team', icon: Users },
  { id: 'devices', key: 'nav.devices', icon: ToggleLeft },
  { id: 'cameras', key: 'nav.cameras', icon: Video },
  { id: 'clan', key: 'nav.clan', icon: Shield },
  { id: 'alarms', key: 'nav.alarms', icon: Siren, alwaysEnabled: true },
  { id: 'chat', key: 'nav.chat', icon: MessageSquare },
  { id: 'items', key: 'nav.items', icon: Package, alwaysEnabled: true },
  { id: 'raid', key: 'nav.raid', icon: Bomb, alwaysEnabled: true },
  { id: 'settings', key: 'nav.settings', icon: SlidersHorizontal, alwaysEnabled: true },
]

export default function Sidebar() {
  const { t } = useT()
  const view = useRustStore((s) => s.view)
  const setView = useRustStore((s) => s.setView)
  const connected = useRustStore((s) => s.status === 'connected')

  return (
    <nav className="flex flex-col w-20 bg-rust-card border-r border-black/40 py-3 gap-1 select-none">
      {ITEMS.map(({ id, key, icon: Icon, alwaysEnabled }) => {
        const disabled = !alwaysEnabled && !connected
        const active = view === id
        const label = t(key)
        return (
          <button
            key={id}
            onClick={() => !disabled && setView(id)}
            disabled={disabled}
            title={disabled ? `${label} (${t('nav.lockedHint')})` : label}
            className={`flex flex-col items-center gap-1 mx-2 py-2.5 rounded-lg text-[11px] transition-colors
              ${active ? 'bg-rust-accent text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}
              ${disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}`}
          >
            <Icon size={20} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
