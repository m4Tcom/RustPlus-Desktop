import { create } from 'zustand'

export const useRustStore = create((set) => ({
  // ---- navigation ----
  view: 'setup', // 'setup' | 'map' | 'team' | 'devices' | 'cameras' | 'clan' | 'chat'
  setView: (view) => set({ view }),

  // ---- connection ----
  status: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
  statusDetail: null,
  serverInfo: null, // { name, players, maxPlayers, mapSize, ... }
  mySteamId: null, // own Steam64, used to highlight/center on self
  setMySteamId: (id) => set({ mySteamId: id }),

  setStatus: (status, detail) =>
    set((state) => {
      const next = { status, statusDetail: detail ?? null }
      if (status === 'connected' && detail && typeof detail === 'object') {
        next.serverInfo = detail
        next.view = 'map' // jump to the map once we're in
      } else if (status !== 'connected') {
        // Clear live data on disconnect/error.
        next.serverInfo = null
        next.team = null
        next.chat = []
        next.markers = []
        next.mapImage = null
        next.time = null
        next.clan = null
        next.clanChat = []
        if (status === 'disconnected') next.view = 'setup'
      }
      return next
    }),

  // ---- live feature state ----
  time: null, // { time, sunrise, sunset }
  team: null, // { leaderSteamId, members: [], mapNotes, leaderMapNotes }
  chat: [], // [{ steamId, name, message, color, time }]
  markers: [], // [{ id, type, x, y, sellOrders, ... }]
  mapImage: null, // { width, height, jpgImage(base64), monuments, ... }
  devices: [], // [{ entityId, name, type }]
  cameras: [], // [{ identifier, label }]
  clan: null, // { name, members, roles, motd, ... }
  clanChat: [], // [{ steamId, name, message, time }]
  alarms: [], // [{ title, message, time }]
  settings: {}, // app preferences (TTS, event toasts, discord) mirrored from electron-store
  setAppSettings: (settings) => set({ settings: settings || {} }),

  setServerInfo: (info) => set({ serverInfo: info }),
  setTime: (time) => set({ time }),
  setTeam: (team) => set({ team }),
  setChat: (chat) => set({ chat: chat.messages ?? chat }),
  appendChat: (msg) =>
    set((s) => {
      // De-dupe against the last polled message (same sender + text + time).
      const dup = s.chat.some(
        (m) => m.time === msg.time && m.steamId === msg.steamId && m.message === msg.message,
      )
      return dup ? {} : { chat: [...s.chat, msg].slice(-200) }
    }),
  setMarkers: (m) => set({ markers: m.markers ?? m }),
  setMapImage: (mapImage) => set({ mapImage }),
  setDevices: (devices) => set({ devices }),
  setCameras: (cameras) => set({ cameras }),
  setClan: (clan) => set({ clan }),
  setClanChat: (clanChat) => set({ clanChat: clanChat.messages ?? clanChat }),
  appendClanChat: (msg) => set((s) => ({ clanChat: [...s.clanChat, msg].slice(-200) })),
  pushAlarm: (alarm) =>
    set((s) => ({
      alarms: [
        { id: `${alarm.time || Date.now()}-${Math.random().toString(36).slice(2, 7)}`, status: 'pending', ...alarm },
        ...s.alarms,
      ].slice(0, 50),
    })),
  ackAlarm: (id, status) =>
    set((s) => ({ alarms: s.alarms.map((a) => (a.id === id ? { ...a, status } : a)) })),
}))
