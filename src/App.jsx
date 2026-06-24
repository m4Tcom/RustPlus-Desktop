import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import Setup from './pages/Setup'
import MapPage from './pages/Map'
import Team from './pages/Team'
import Devices from './pages/Devices'
import Cameras from './pages/Cameras'
import Clan from './pages/Clan'
import Alarms from './pages/Alarms'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import Items from './pages/Items'
import RaidCalc from './pages/RaidCalc'
import EventWatcher from './components/EventWatcher'
import ErrorBoundary from './components/ErrorBoundary'
import { useRustStore } from './store/useRustStore'
import { useT } from './i18n'
import { speak } from './lib/tts'

const PAGES = {
  setup: Setup,
  map: MapPage,
  team: Team,
  devices: Devices,
  cameras: Cameras,
  clan: Clan,
  alarms: Alarms,
  chat: Chat,
  items: Items,
  raid: RaidCalc,
  settings: Settings,
}

export default function App() {
  const view = useRustStore((s) => s.view)
  const store = useRustStore
  const { lang, t } = useT()

  // Subscribe to all Main-process events once on mount.
  useEffect(() => {
    const e = window.electron
    if (!e) return
    const {
      setStatus, setTeam, setChat, appendChat, setMarkers, setMapImage,
      setServerInfo, setTime, setDevices, setCameras, appendClanChat, pushAlarm, setAppSettings,
    } = store.getState()

    const unsubs = [
      e.onStatus(({ status, detail }) => setStatus(status, detail)),
      // Authoritative own Steam ID for the active connection (keeps "center on
      // me" / self highlight correct even after switching servers/accounts).
      e.onSelf(({ steamId }) => steamId && store.getState().setMySteamId(String(steamId))),
      e.onTeamUpdate((team) => setTeam(team)),
      e.onChatUpdate((chat) => setChat(chat)),
      e.onChatMessage((msg) => {
        appendChat(msg)
        const s = store.getState().settings
        if (s?.ttsChat && msg?.message) speak(`${msg.name || ''}: ${msg.message}`, store.getState().lang || lang)
      }),
      e.onMarkersUpdate((m) => setMarkers(m)),
      e.onMapImage((img) => setMapImage(img)),
      e.onInfoUpdate((info) => setServerInfo(info)),
      e.onTimeUpdate((time) => setTime(time)),
      e.onDevicesUpdate((devices) => setDevices(devices)),
      e.onClanMessage((msg) => appendClanChat(msg)),
      e.onAlarm((alarm) => {
        pushAlarm(alarm)
        const s = store.getState().settings
        if (s?.ttsAlarm) speak(alarm?.title || alarm?.message || 'Raid alarm', lang)
      }),
      e.onProximity((p) => {
        const s = store.getState().settings
        if (s?.ttsAlarm) speak(`${p?.what} ${p?.dist} meters`, lang)
      }),
    ]

    // Load any devices / cameras paired or added in a previous session.
    e.getDevices().then((devices) => setDevices(devices || []))
    e.getCameras().then((cameras) => setCameras(cameras || []))
    e.getSettings().then((s) => setAppSettings(s || {}))

    // Remember our own Steam ID (for "center on me" / self highlight).
    e.getSavedConfig().then((cfg) => {
      if (cfg?.steamId) store.getState().setMySteamId(String(cfg.steamId))
    })

    return () => unsubs.forEach((u) => u?.())
  }, [store])

  const Page = PAGES[view] ?? Setup

  return (
    <div className="flex h-full bg-rust-bg text-gray-100">
      <EventWatcher />
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <StatusBar />
        <main className="flex-1 min-h-0">
          <ErrorBoundary resetKey={view} title={t('error.title')} retryLabel={t('error.retry')}>
            <Page />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
