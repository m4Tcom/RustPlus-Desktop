const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, globalShortcut, dialog, shell } = require('electron')
const { randomUUID } = require('crypto')
const https = require('https')
const path = require('path')
const Store = require('electron-store')
const Jimp = require('jimp')
const RustPlus = require('@liamcottle/rustplus.js')
const pairing = require('./pairing')
const overlay = require('./overlay')

// Optional native global mouse hook (for binding extra mouse buttons as hotkeys).
// Loaded defensively: if the prebuilt binary isn't available the app still runs,
// just without mouse-button hotkeys.
let uIOhook = null
try {
  ;({ uIOhook } = require('uiohook-napi'))
} catch (err) {
  console.warn('[uiohook] not available:', err.message)
}

const isDev = process.env.NODE_ENV === 'development'

// Safety net: rustplus.js decodes incoming packets synchronously inside the
// WebSocket handler, so a malformed packet would otherwise throw an uncaught
// exception and crash the whole Main process. Log it instead of dying.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('rust:status', {
      status: 'error',
      detail: 'Interner Fehler: ' + (err?.message || String(err)),
    })
  }
})

// Persistent storage (no localStorage – see CLAUDE.md)
const store = new Store({
  name: 'rustplus-config',
  defaults: {
    connection: { ip: '', port: '', steamId: '', playerToken: '' },
    profiles: [], // [{ id, name, ip, port, steamId, playerToken }] saved servers
    devices: [], // [{ entityId, name, type }]  type: 1=Switch 2=Alarm 3=StorageMonitor
    cameras: [], // [{ identifier, label }]
    overlays: [], // [{ id, label, src(abs path), hotkey, visible }]
    automations: [], // [{ id, entityId, name, mode:'night'|'day'|'interval', intervalMin, enabled }]
    settings: {
      // Default deliberately hard to hit by accident (3 modifiers + R).
      stopRaidHotkey: 'Control+Alt+Shift+R',
      minimapHotkey: '', // global hotkey to toggle the in-game overlay minimap
      autostart: false,
      ttsAlarm: false,      // speak raid alarms aloud
      ttsChat: false,       // speak incoming team chat aloud
      eventCargo: true,     // toast when cargo ship spawns
      eventHeli: true,      // toast when patrol heli spawns
      eventChinook: true,   // toast when chinook (CH47) spawns
      eventDeath: true,     // toast when a teammate dies
      eventOnline: false,   // toast when a teammate comes online
      proximityWarn: true,  // warn when a heli/chinook approaches your position
      discordWebhook: '',   // Discord webhook URL for raid alarms
      discordAlarms: false, // post raid alarms to Discord
      discordChat: false,   // relay team chat to Discord
      telegramBotToken: '', // Telegram bot token (from @BotFather)
      telegramChatId: '',   // Telegram chat id to send to
      telegramAlarms: false,// push raid alarms to Telegram
      telegramChat: false,  // relay team chat to Telegram
      pushoverToken: '',    // Pushover application API token
      pushoverUser: '',     // Pushover user key
      pushoverAlarms: false,// push raid alarms to Pushover
    },
    language: 'de',
  },
})

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {Tray | null} */
let tray = null
/** True while the app is genuinely quitting (vs. just hiding to tray). */
let isQuitting = false
/** @type {RustPlus | null} */
let rustplus = null
let lastCreds = null         // last successful creds, for auto-reconnect
let userDisconnect = false   // true when the user (not the network) disconnected
let reconnectTimer = null
let reconnectAttempts = 0
/** Active polling interval handles, cleared on disconnect. */
let pollTimers = []
/** Active camera subscriptions: identifier -> Camera instance. */
let cameras = {}

// ---- helpers --------------------------------------------------------------

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function sendStatus(status, detail) {
  send('rust:status', { status, detail })
}

// uint64 / Long → string (steamIds etc. lose precision as JS numbers)
const s = (v) => (v == null ? null : String(v))

/** Call a rustplus request and return the plain response, or throw. */
async function rustCall(data, timeout = 10000) {
  if (!rustplus || !rustplus.isConnected()) throw new Error('Nicht verbunden')
  return await rustplus.sendRequestAsync(data, timeout)
}

// ---- response mappers (protobuf message -> plain, IPC-safe object) ---------

function mapInfo(i) {
  return {
    name: i.name,
    headerImage: i.headerImage,
    url: i.url,
    map: i.map,
    mapSize: i.mapSize,
    wipeTime: i.wipeTime,
    players: i.players,
    maxPlayers: i.maxPlayers,
    queuedPlayers: i.queuedPlayers ?? 0,
    seed: i.seed,
  }
}

function mapTime(t) {
  return {
    time: t.time,
    sunrise: t.sunrise,
    sunset: t.sunset,
    dayLengthMinutes: t.dayLengthMinutes,
    timeScale: t.timeScale,
  }
}

function mapTeam(t) {
  const note = (n) => ({ type: n.type, x: n.x, y: n.y })
  return {
    leaderSteamId: s(t.leaderSteamId),
    members: (t.members || []).map((m) => ({
      steamId: s(m.steamId),
      name: m.name,
      x: m.x,
      y: m.y,
      isOnline: !!m.isOnline,
      isAlive: !!m.isAlive,
      spawnTime: m.spawnTime,
      deathTime: m.deathTime,
    })),
    mapNotes: (t.mapNotes || []).map(note),
    leaderMapNotes: (t.leaderMapNotes || []).map(note),
  }
}

function mapChat(c) {
  return {
    messages: (c.messages || []).map((m) => ({
      steamId: s(m.steamId),
      name: m.name,
      message: m.message,
      color: m.color,
      time: m.time,
    })),
  }
}

function mapMarkers(mm) {
  return {
    markers: (mm.markers || []).map((k) => ({
      id: k.id,
      type: k.type, // numeric AppMarkerType
      x: k.x,
      y: k.y,
      steamId: s(k.steamId),
      name: k.name,
      rotation: k.rotation,
      radius: k.radius,
      outOfStock: !!k.outOfStock,
      // Vending machine sell orders (type 3): item shop contents.
      sellOrders: (k.sellOrders || []).map((o) => ({
        itemId: o.itemId,
        quantity: o.quantity,
        currencyId: o.currencyId,
        costPerItem: o.costPerItem,
        amountInStock: o.amountInStock,
        itemIsBlueprint: !!o.itemIsBlueprint,
        currencyIsBlueprint: !!o.currencyIsBlueprint,
      })),
    })),
  }
}

function mapClan(ci) {
  if (!ci) return null
  const num = (v) => (v == null ? null : Number(v))
  return {
    clanId: s(ci.clanId),
    name: ci.name,
    created: num(ci.created),
    creator: s(ci.creator),
    motd: ci.motd || '',
    motdTimestamp: num(ci.motdTimestamp),
    motdAuthor: s(ci.motdAuthor),
    color: ci.color,
    maxMemberCount: ci.maxMemberCount,
    roles: (ci.roles || []).map((r) => ({ roleId: r.roleId, rank: r.rank, name: r.name })),
    members: (ci.members || []).map((m) => ({
      steamId: s(m.steamId),
      roleId: m.roleId,
      joined: num(m.joined),
      lastSeen: num(m.lastSeen),
      notes: m.notes || '',
      online: !!m.online,
    })),
  }
}

function mapClanChat(c) {
  return {
    messages: (c.messages || []).map((m) => ({
      steamId: s(m.steamId),
      name: m.name,
      message: m.message,
      time: m.time == null ? null : Number(m.time),
    })),
  }
}

function mapCameraInfo(info, isAutoTurret) {
  return {
    width: info?.width,
    height: info?.height,
    nearPlane: info?.nearPlane,
    farPlane: info?.farPlane,
    controlFlags: info?.controlFlags,
    isAutoTurret: !!isAutoTurret,
  }
}

function mapMap(m) {
  return {
    width: m.width,
    height: m.height,
    oceanMargin: m.oceanMargin,
    background: m.background,
    monuments: (m.monuments || []).map((mo) => ({ token: mo.token, x: mo.x, y: mo.y })),
    jpgImage: m.jpgImage && m.jpgImage.length ? Buffer.from(m.jpgImage).toString('base64') : null,
  }
}

function mapEntity(e) {
  const p = e.payload || {}
  return {
    type: e.type, // 1=Switch 2=Alarm 3=StorageMonitor
    value: !!p.value,
    capacity: p.capacity,
    hasProtection: !!p.hasProtection,
    protectionExpiry: p.protectionExpiry,
    items: (p.items || []).map((it) => ({
      itemId: it.itemId,
      quantity: it.quantity,
      itemIsBlueprint: !!it.itemIsBlueprint,
    })),
  }
}

// ---- window ---------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Closing the window keeps the app alive in the tray (background mode).
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

// ---- tray + global hotkeys (background mode) -------------------------------

async function setupTray() {
  let icon
  try {
    const img = new Jimp(16, 16, 0xcd4a22ff) // rust-orange square
    icon = nativeImage.createFromBuffer(await img.getBufferAsync(Jimp.MIME_PNG))
  } catch (_) {
    icon = nativeImage.createEmpty()
  }
  tray = new Tray(icon)
  tray.setToolTip('RustPlus Desktop')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Öffnen', click: () => showMainWindow() },
      { label: 'Raid-Alarm stoppen', click: () => overlay.hideRaid() },
      { type: 'separator' },
      { label: 'Beenden', click: () => { isQuitting = true; app.quit() } },
    ]),
  )
  tray.on('double-click', () => showMainWindow())
}

// (Re)register all global hotkeys: the raid-stop key + every custom overlay's
// toggle key. Called on startup and whenever settings/overlays change.
// Mouse-button bindings (e.g. "Mouse4") are handled by the uIOhook callback;
// keyboard accelerators go through Electron's globalShortcut.
let mouseBindings = {}
let mouseHookStarted = false
const MOUSE_BTN = { 3: 'MouseMiddle', 4: 'Mouse4', 5: 'Mouse5' }

function setupMouseHook() {
  if (!uIOhook || mouseHookStarted) return
  try {
    uIOhook.on('mousedown', (e) => {
      const name = MOUSE_BTN[e.button]
      const fn = name && mouseBindings[name]
      if (fn) fn()
    })
    uIOhook.start()
    mouseHookStarted = true
  } catch (err) {
    console.warn('[uiohook] start failed:', err.message)
  }
}

function registerShortcuts() {
  globalShortcut.unregisterAll()
  mouseBindings = {}
  const bind = (accel, fn) => {
    if (!accel) return
    if (accel.startsWith('Mouse')) { mouseBindings[accel] = fn; return }
    try {
      globalShortcut.register(accel, fn)
    } catch (err) {
      console.warn('[hotkey]', accel, err.message)
    }
  }
  const settings = store.get('settings') || {}
  bind(settings.stopRaidHotkey, () => overlay.hideRaid())
  bind(settings.minimapHotkey, () => overlay.toggleMinimap())
  for (const ov of store.get('overlays') || []) bind(ov.hotkey, () => toggleOverlay(ov.id))
}

/** Toggle a custom image overlay by id and report its new visibility. */
function toggleOverlay(id) {
  const list = store.get('overlays') || []
  const ov = list.find((o) => o.id === id)
  if (!ov) return
  const visible = overlay.toggleCustom(id, ov.src, { corner: ov.corner, size: ov.size })
  store.set('overlays', list.map((o) => (o.id === id ? { ...o, visible } : o)))
  send('overlay:state', { id, visible })
}

function applyAutostart() {
  const on = !!(store.get('settings') || {}).autostart
  try {
    app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] })
  } catch (_) {
    /* not supported on this platform */
  }
}

// ---- connection -----------------------------------------------------------

function unsubscribeAllCameras() {
  for (const id of Object.keys(cameras)) {
    try {
      cameras[id].unsubscribe()
    } catch (_) {
      /* ignore */
    }
  }
  cameras = {}
}

function destroyRustplus() {
  stopPolling()
  unsubscribeAllCameras()
  if (rustplus) {
    try {
      rustplus.removeAllListeners()
      rustplus.disconnect()
    } catch (_) {
      /* ignore */
    }
    rustplus = null
  }
}

// Reconnect with exponential backoff after an unexpected drop (server restart,
// wipe, network blip). Cancelled by a user-initiated disconnect.
function scheduleReconnect() {
  if (userDisconnect || !lastCreds || reconnectTimer) return
  const delay = Math.min(30000, 3000 * 2 ** reconnectAttempts)
  reconnectAttempts++
  sendStatus('connecting', `Reconnect in ${Math.round(delay / 1000)}s…`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (userDisconnect || !lastCreds) return
    connect(lastCreds).catch(() => scheduleReconnect())
  }, delay)
}

// Remember every server we successfully connect to, keyed by ip:port:steamId,
// so the user can quick-switch between them later.
function upsertProfile({ ip, port, steamId, playerToken, name }) {
  const key = `${ip}:${port}:${steamId}`
  const profiles = store.get('profiles') || []
  const existing = profiles.find((p) => p.id === key)
  if (existing) {
    existing.playerToken = playerToken
    if (name) existing.name = name
  } else {
    profiles.push({ id: key, name: name || ip, ip, port: String(port), steamId, playerToken })
  }
  store.set('profiles', profiles)
}

function connect({ ip, port, steamId, playerToken }) {
  return new Promise((resolve, reject) => {
    destroyRustplus()
    userDisconnect = false
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    sendStatus('connecting')

    rustplus = new RustPlus(ip, Number(port), steamId, playerToken)

    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      destroyRustplus()
      sendStatus('error', 'Timeout – keine Antwort vom Server')
      reject(new Error('Verbindungs-Timeout (10s)'))
    }, 10000)

    rustplus.on('connected', () => {
      rustplus.getInfo((message) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)

        if (message.response && message.response.error) {
          const err = message.response.error.error || 'Unbekannter Fehler'
          destroyRustplus()
          sendStatus('error', err)
          reject(new Error(err))
          return
        }

        store.set('connection', { ip, port: String(port), steamId, playerToken })
        lastCreds = { ip, port: String(port), steamId, playerToken }
        reconnectAttempts = 0
        mySteamId = String(steamId)
        const info = mapInfo((message.response && message.response.info) || {})
        lastMapSize = info.mapSize || 0
        upsertProfile({ ip, port: String(port), steamId, playerToken, name: info?.name })
        send('rust:profilesUpdate', store.get('profiles'))
        // Authoritative own Steam ID for this connection (used to identify
        // "me" on the map / minimap). Sent every connect so switching servers
        // or accounts updates it, not just the value saved at app start.
        send('rust:self', { steamId: mySteamId })
        sendStatus('connected', info)
        startPolling()
        resolve(info)
      })
    })

    rustplus.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      destroyRustplus()
      const msg = (err && err.message) || 'Socket-Fehler'
      sendStatus('error', msg)
      reject(new Error(msg))
    })

    rustplus.on('disconnected', () => {
      stopPolling()
      if (!settled) return
      if (!userDisconnect && lastCreds) scheduleReconnect()
      else sendStatus('disconnected')
    })

    // Live push broadcasts (in addition to polling): device state, team and
    // clan changes arrive here while connected.
    rustplus.on('message', (message) => {
      const b = message?.broadcast
      if (!b) return
      if (b.entityChanged) {
        send('rust:entityChanged', {
          entityId: b.entityChanged.entityId,
          value: !!b.entityChanged.payload?.value,
        })
      }
      if (b.teamChanged?.teamInfo) {
        const team = mapTeam(b.teamChanged.teamInfo)
        send('rust:teamUpdate', team)
        trackSelf(team)
        overlay.pushMinimap({ members: minimapMembers(team), mySteamId })
      }
      if (b.teamMessage?.message) {
        const m = b.teamMessage.message
        send('rust:chatMessage', {
          steamId: s(m.steamId),
          name: m.name,
          message: m.message,
          color: m.color,
          time: m.time,
        })
        {
          const st = store.get('settings') || {}
          if (st.discordChat) postDiscord(`💬 **${m.name}**: ${m.message}`)
          if (st.telegramChat) postTelegram(`💬 ${m.name}: ${m.message}`)
        }
      }
      if (b.clanMessage?.message) {
        const m = b.clanMessage.message
        send('rust:clanMessage', {
          steamId: s(m.steamId),
          name: m.name,
          message: m.message,
          time: m.time == null ? null : Number(m.time),
        })
      }
    })

    rustplus.connect()
  })
}

// ---- polling --------------------------------------------------------------

function poll(fn, intervalMs, runImmediately = true) {
  const tick = async () => {
    try {
      await fn()
    } catch (err) {
      // Transient request errors are expected; don't spam.
      if (err?.message && err.message !== 'Nicht verbunden') {
        console.warn('[poll]', err.message)
      }
    }
  }
  if (runImmediately) tick()
  const handle = setInterval(tick, intervalMs)
  pollTimers.push(handle)
}

// Remember our own live position (for minimap proximity warnings).
function trackSelf(team) {
  const me = (team.members || []).find((m) => m.steamId === mySteamId)
  if (me && me.isOnline && me.x != null) lastSelf = { x: me.x, y: me.y }
}

// Build the minimap member list. The Rust+ API stops reporting a position once a
// member goes offline, so we cache each member's last known spot and fall back
// to it for offline members (drawn dimmed on the minimap).
let memberPosCache = {}
function minimapMembers(team) {
  return (team.members || []).map((m) => {
    if (m.x != null) memberPosCache[m.steamId] = { x: m.x, y: m.y }
    const pos = m.x != null ? { x: m.x, y: m.y } : memberPosCache[m.steamId]
    return { steamId: m.steamId, name: m.name, isOnline: m.isOnline, isAlive: m.isAlive, x: pos?.x ?? null, y: pos?.y ?? null }
  })
}

// Warn (notification + minimap flash + TTS) when a patrol heli / chinook comes
// within range of our position. Hysteresis re-arms only after it leaves.
const PROX_RADIUS = 350 // metres
function checkProximity(markers) {
  const s = store.get('settings') || {}
  if (!s.proximityWarn || !lastSelf || lastSelf.x == null) return
  const present = new Set()
  for (const m of markers) {
    if ((m.type !== 4 && m.type !== 8) || m.x == null) continue
    present.add(m.id)
    const dist = Math.hypot(m.x - lastSelf.x, m.y - lastSelf.y)
    if (dist < PROX_RADIUS) {
      if (!warnedMarkers.has(m.id)) {
        warnedMarkers.add(m.id)
        const what = m.type === 4 ? 'Chinook' : 'Patrol Helicopter'
        if (Notification.isSupported()) new Notification({ title: 'Rust+', body: `⚠ ${what} – ${Math.round(dist)}m` }).show()
        overlay.pushMinimap({ warn: Date.now() })
        send('rust:proximity', { type: m.type, what, dist: Math.round(dist) })
      }
    } else if (dist > PROX_RADIUS * 1.3) {
      warnedMarkers.delete(m.id)
    }
  }
  for (const id of [...warnedMarkers]) if (!present.has(id)) warnedMarkers.delete(id)
}

function startPolling() {
  stopPolling()
  autoState = {}
  lastSelf = null
  warnedMarkers = new Set()
  memberPosCache = {}

  // Map image once on connect (only changes on wipe; manual refresh available).
  rustCall({ getMap: {} })
    .then((r) => {
      const mm = mapMap(r.map)
      send('rust:mapImage', mm)
      overlay.pushMinimap({ jpg: mm.jpgImage, width: mm.width, height: mm.height, margin: mm.oceanMargin || 0, mapSize: lastMapSize, mySteamId })
    })
    .catch((err) => console.warn('[getMap]', err.message))

  // Team info (CLAUDE.md: every 10s)
  poll(async () => {
    const r = await rustCall({ getTeamInfo: {} })
    const team = mapTeam(r.teamInfo)
    send('rust:teamUpdate', team)
    trackSelf(team)
    overlay.pushMinimap({ members: minimapMembers(team), mySteamId })
  }, 10000)

  // Team chat (every 3s)
  poll(async () => {
    const r = await rustCall({ getTeamChat: {} })
    send('rust:chatUpdate', mapChat(r.teamChat))
  }, 3000)

  // Map markers (every 5s)
  poll(async () => {
    const r = await rustCall({ getMapMarkers: {} })
    const data = mapMarkers(r.mapMarkers)
    send('rust:markersUpdate', data)
    overlay.pushMinimap({ markers: data.markers.map((m) => ({ type: m.type, x: m.x, y: m.y, id: m.id })) })
    checkProximity(data.markers)
  }, 5000)

  // Server info + time (every 30s, for player count & day/night)
  poll(async () => {
    const r = await rustCall({ getInfo: {} })
    send('rust:infoUpdate', mapInfo(r.info))
  }, 30000)
  poll(async () => {
    const r = await rustCall({ getTime: {} })
    lastTimeInfo = mapTime(r.time)
    send('rust:timeUpdate', lastTimeInfo)
    runAutomations()
  }, 30000)
}

function stopPolling() {
  pollTimers.forEach(clearInterval)
  pollTimers = []
}

// ---- device automations ---------------------------------------------------

let lastTimeInfo = null
let autoState = {} // automationId -> { applied: bool|null, lastToggle: number }
let lastMapSize = 0
let mySteamId = null
let lastSelf = null // own {x,y} for proximity warnings
let warnedMarkers = new Set() // marker ids we've already warned about

function isNight(ti) {
  if (!ti || ti.time == null || ti.sunrise == null || ti.sunset == null) return false
  return !(ti.time >= ti.sunrise && ti.time < ti.sunset)
}

// Evaluate enabled automations and flip switches when their target state changes.
async function runAutomations() {
  if (!rustplus || !rustplus.isConnected()) return
  const now = Date.now()
  for (const a of store.get('automations') || []) {
    if (!a.enabled) continue
    const st = autoState[a.id] || (autoState[a.id] = { applied: null, lastToggle: 0 })
    let desired = null
    if (a.mode === 'night') desired = isNight(lastTimeInfo)
    else if (a.mode === 'day') desired = !isNight(lastTimeInfo)
    else if (a.mode === 'interval') {
      const periodMs = Math.max(1, Number(a.intervalMin) || 5) * 60000
      if (now - (st.lastToggle || 0) < periodMs) continue
      st.lastToggle = now
      desired = !(st.applied ?? false)
    }
    if (desired == null || st.applied === desired) continue
    try {
      await rustCall({ entityId: Number(a.entityId), setEntityValue: { value: desired } })
      st.applied = desired
      send('rust:entityChanged', { entityId: Number(a.entityId), value: desired })
    } catch (err) {
      console.warn('[automation]', a.entityId, err.message)
    }
  }
}

// ---- FCM notifications (server/device pairing + alarms) -------------------

// Fire-and-forget POST to a Discord webhook (no extra dependency).
function postDiscord(content) {
  const url = (store.get('settings') || {}).discordWebhook
  if (!url || !content) return
  let u
  try { u = new URL(url) } catch { return }
  if (!/discord(app)?\.com$/.test(u.hostname)) return
  const data = JSON.stringify({ content: String(content).slice(0, 1900) })
  const req = https.request(
    { method: 'POST', hostname: u.hostname, path: u.pathname + u.search, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    (res) => res.resume(),
  )
  req.on('error', (err) => console.warn('[discord]', err.message))
  req.write(data)
  req.end()
}

// Fire-and-forget push to a Telegram chat via the Bot API.
function postTelegram(text) {
  const s = store.get('settings') || {}
  const token = s.telegramBotToken
  const chatId = s.telegramChatId
  if (!token || !chatId || !text) return
  const data = JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true })
  const req = https.request(
    { method: 'POST', hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    (res) => res.resume(),
  )
  req.on('error', (err) => console.warn('[telegram]', err.message))
  req.write(data)
  req.end()
}

// Fire-and-forget push to Pushover (loud phone alert app). priority 1 = high.
function postPushover(title, message) {
  const s = store.get('settings') || {}
  const token = s.pushoverToken
  const user = s.pushoverUser
  if (!token || !user || !message) return
  const data = new URLSearchParams({
    token, user,
    title: String(title || 'Rust+').slice(0, 250),
    message: String(message).slice(0, 1024),
    priority: '1',
  }).toString()
  const req = https.request(
    { method: 'POST', hostname: 'api.pushover.net', path: '/1/messages.json', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) } },
    (res) => res.resume(),
  )
  req.on('error', (err) => console.warn('[pushover]', err.message))
  req.write(data)
  req.end()
}

// Fan a raid alarm out to every enabled phone/chat channel.
function pushAlarmChannels(title, message) {
  const s = store.get('settings') || {}
  const line = `🚨 Rust+ Alarm — ${title || 'Smart Alarm'}${message ? `: ${message}` : ''}`
  if (s.discordAlarms) postDiscord(line)
  if (s.telegramAlarms) postTelegram(line)
  if (s.pushoverAlarms) postPushover('🚨 Rust+ Raid Alarm', `${title || 'Smart Alarm'}${message ? `: ${message}` : ''}`)
}

function handleFcmNotification(notif) {
  const { title, message, body } = notif

  if (body?.type === 'server') {
    send('rust:pairStatus', {
      stage: 'server-paired',
      payload: {
        ip: body.ip,
        port: String(body.port),
        steamId: String(body.playerId),
        playerToken: String(body.playerToken),
        name: body.name,
      },
    })
    return
  }

  if (body?.type === 'entity') {
    const device = {
      entityId: Number(body.entityId),
      name: body.entityName || title || `Gerät ${body.entityId}`,
      type: Number(body.entityType) || 1,
    }
    const devices = store.get('devices') || []
    if (!devices.find((d) => d.entityId === device.entityId)) {
      devices.push(device)
      store.set('devices', devices)
    }
    send('rust:devicesUpdate', store.get('devices'))
    return
  }

  // Anything else = a smart alarm trigger (or generic notification).
  if (title || message) {
    if (Notification.isSupported()) {
      new Notification({ title: title || 'Rust+ Alarm', body: message || '' }).show()
    }
    const time = Date.now()
    send('rust:alarm', { title, message, time })
    // Smart alarms are the practical raid signal -> full-screen warning + siren.
    overlay.showRaid({ time, name: title || message })
    pushAlarmChannels(title, message)
  }
}

// ---- app lifecycle --------------------------------------------------------

app.whenReady().then(async () => {
  createWindow()
  await setupTray()
  registerShortcuts()
  setupMouseHook()
  applyAutostart()

  // If we paired before, resume listening so device pairings & alarms work
  // without re-pairing.
  const saved = store.get('pairing')
  if (saved?.fcmCredentials) {
    pairing
      .startFcmListener(saved.fcmCredentials, handleFcmNotification)
      .catch((err) => console.warn('[fcm-resume]', err.message))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else showMainWindow()
  })
})

// Stay alive in the tray when all windows are closed (background mode).
app.on('window-all-closed', () => {
  /* intentionally empty: tray keeps the app running */
})

app.on('before-quit', () => {
  isQuitting = true
  destroyRustplus()
  pairing.stopFcmListener()
  overlay.destroyAll()
  globalShortcut.unregisterAll()
  if (uIOhook && mouseHookStarted) { try { uIOhook.stop() } catch (_) { /* ignore */ } }
})

// ---- IPC: connection ------------------------------------------------------

ipcMain.handle('rust:connect', async (_e, creds) => {
  try {
    const info = await connect(creds)
    return { ok: true, info }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('rust:disconnect', async () => {
  userDisconnect = true
  lastCreds = null
  reconnectAttempts = 0
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  destroyRustplus()
  sendStatus('disconnected')
  return { ok: true }
})

ipcMain.handle('rust:getSavedConfig', async () => store.get('connection'))

ipcMain.handle('profiles:get', async () => store.get('profiles') || [])
ipcMain.handle('profiles:remove', async (_e, id) => {
  store.set('profiles', (store.get('profiles') || []).filter((p) => p.id !== id))
  return store.get('profiles')
})
ipcMain.handle('profiles:rename', async (_e, { id, name }) => {
  const profiles = store.get('profiles') || []
  const p = profiles.find((x) => x.id === id)
  if (p) { p.name = name; store.set('profiles', profiles) }
  return store.get('profiles')
})

// ---- IPC: device automations ----------------------------------------------

ipcMain.handle('automations:get', async () => store.get('automations') || [])
ipcMain.handle('automations:add', async (_e, a) => {
  const list = store.get('automations') || []
  list.push({ id: randomUUID(), enabled: true, mode: 'night', intervalMin: 5, ...a })
  store.set('automations', list)
  runAutomations()
  return list
})
ipcMain.handle('automations:update', async (_e, { id, ...patch }) => {
  const list = (store.get('automations') || []).map((a) => (a.id === id ? { ...a, ...patch } : a))
  store.set('automations', list)
  if (autoState[id]) autoState[id].applied = null // re-evaluate next tick
  runAutomations()
  return list
})
ipcMain.handle('automations:remove', async (_e, id) => {
  store.set('automations', (store.get('automations') || []).filter((a) => a.id !== id))
  delete autoState[id]
  return store.get('automations')
})

ipcMain.handle('app:getLanguage', async () => store.get('language') || 'de')
ipcMain.handle('app:setLanguage', async (_e, lang) => {
  store.set('language', lang)
  return true
})

// ---- IPC: pairing ---------------------------------------------------------

let pairingInProgress = false

ipcMain.handle('rust:startPairing', async () => {
  if (pairingInProgress) return { ok: false, error: 'Pairing läuft bereits' }
  pairingInProgress = true
  try {
    await pairing.startPairing(
      mainWindow,
      (stage, payload) => send('rust:pairStatus', { stage, payload }),
      handleFcmNotification,
      store,
    )
    return { ok: true }
  } catch (err) {
    send('rust:pairStatus', { stage: 'error', payload: err.message })
    return { ok: false, error: err.message }
  } finally {
    pairingInProgress = false
  }
})

ipcMain.handle('rust:cancelPairing', async () => {
  pairing.cancelPairing()
  pairingInProgress = false
  return { ok: true }
})

// ---- IPC: data on demand --------------------------------------------------

ipcMain.handle('rust:getMap', async () => {
  try {
    const r = await rustCall({ getMap: {} })
    return { ok: true, data: mapMap(r.map) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('rust:sendChat', async (_e, message) => {
  try {
    await rustCall({ sendTeamMessage: { message } })
    // Refresh chat immediately so the sender sees their message.
    const r = await rustCall({ getTeamChat: {} })
    send('rust:chatUpdate', mapChat(r.teamChat))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ---- IPC: smart devices ---------------------------------------------------

ipcMain.handle('rust:getDevices', async () => store.get('devices') || [])

ipcMain.handle('rust:removeDevice', async (_e, entityId) => {
  const devices = (store.get('devices') || []).filter((d) => d.entityId !== entityId)
  store.set('devices', devices)
  return devices
})

ipcMain.handle('rust:getEntityInfo', async (_e, entityId) => {
  try {
    const r = await rustCall({ entityId, getEntityInfo: {} })
    return { ok: true, data: mapEntity(r.entityInfo) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('rust:setEntityValue', async (_e, { entityId, value }) => {
  try {
    await rustCall({ entityId, setEntityValue: { value } })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ---- IPC: team actions ----------------------------------------------------

ipcMain.handle('rust:promoteToLeader', async (_e, steamId) => {
  try {
    await rustCall({ promoteToLeader: { steamId } })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ---- IPC: clan ------------------------------------------------------------

ipcMain.handle('rust:getClanInfo', async () => {
  try {
    const r = await rustCall({ getClanInfo: {} })
    return { ok: true, data: mapClan(r.clanInfo?.clanInfo) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('rust:getClanChat', async () => {
  try {
    const r = await rustCall({ getClanChat: {} })
    return { ok: true, data: mapClanChat(r.clanChat) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('rust:sendClanMessage', async (_e, message) => {
  try {
    await rustCall({ sendClanMessage: { message } })
    const r = await rustCall({ getClanChat: {} })
    return { ok: true, data: mapClanChat(r.clanChat) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('rust:setClanMotd', async (_e, message) => {
  try {
    await rustCall({ setClanMotd: { message } })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ---- IPC: cameras ---------------------------------------------------------

ipcMain.handle('rust:getCameras', async () => store.get('cameras') || [])

ipcMain.handle('rust:addCamera', async (_e, { identifier, label }) => {
  const id = String(identifier || '').trim()
  if (!id) return store.get('cameras') || []
  const list = store.get('cameras') || []
  if (!list.find((c) => c.identifier === id)) {
    list.push({ identifier: id, label: (label || id).trim() })
    store.set('cameras', list)
  }
  return store.get('cameras')
})

ipcMain.handle('rust:removeCamera', async (_e, identifier) => {
  const list = (store.get('cameras') || []).filter((c) => c.identifier !== identifier)
  store.set('cameras', list)
  return list
})

ipcMain.handle('rust:cameraSubscribe', async (_e, identifier) => {
  try {
    if (!rustplus || !rustplus.isConnected()) throw new Error('Nicht verbunden')
    // Drop any previous instance for this identifier first.
    if (cameras[identifier]) {
      try {
        await cameras[identifier].unsubscribe()
      } catch (_) {
        /* ignore */
      }
      delete cameras[identifier]
    }
    const cam = rustplus.getCamera(identifier)
    cameras[identifier] = cam
    cam.on('render', (png) => {
      send('rust:cameraFrame', { identifier, png: Buffer.from(png).toString('base64') })
    })
    await cam.subscribe()
    return { ok: true, info: mapCameraInfo(cam.cameraSubscribeInfo, cam.isAutoTurret()) }
  } catch (err) {
    if (cameras[identifier]) {
      try {
        await cameras[identifier].unsubscribe()
      } catch (_) {
        /* ignore */
      }
      delete cameras[identifier]
    }
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('rust:cameraUnsubscribe', async (_e, identifier) => {
  const cam = cameras[identifier]
  if (cam) {
    try {
      await cam.unsubscribe()
    } catch (_) {
      /* ignore */
    }
    delete cameras[identifier]
  }
  return { ok: true }
})

ipcMain.handle('rust:cameraInput', async (_e, { identifier, buttons, x, y }) => {
  try {
    const cam = cameras[identifier]
    if (!cam) throw new Error('Kamera nicht aktiv')
    await cam.move(buttons, x, y)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('rust:cameraAction', async (_e, { identifier, action }) => {
  try {
    const cam = cameras[identifier]
    if (!cam) throw new Error('Kamera nicht aktiv')
    if (action === 'zoom') await cam.zoom()
    else if (action === 'shoot') await cam.shoot()
    else if (action === 'reload') await cam.reload()
    else throw new Error('Unbekannte Aktion: ' + action)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ---- IPC: overlays --------------------------------------------------------

ipcMain.handle('overlay:dismissRaid', async () => {
  overlay.hideRaid()
  return { ok: true }
})

ipcMain.handle('overlay:testRaid', async () => {
  overlay.showRaid({ time: Date.now(), name: 'Test' })
  return { ok: true }
})

ipcMain.handle('overlay:toggleImage', async (_e, src) => {
  overlay.toggleImage(src)
  return { ok: true }
})

// ---- IPC: settings (hotkeys, autostart) -----------------------------------

ipcMain.handle('settings:get', async () => store.get('settings'))

ipcMain.handle('settings:setStopHotkey', async (_e, accelerator) => {
  // Mouse-button bindings are handled by uIOhook, not globalShortcut, so skip
  // the keyboard-accelerator validation for those.
  if (accelerator && !accelerator.startsWith('Mouse')) {
    globalShortcut.unregisterAll()
    let ok = false
    try {
      ok = globalShortcut.register(accelerator, () => overlay.hideRaid())
    } catch (_) {
      ok = false
    }
    if (!ok) {
      registerShortcuts() // restore previous bindings
      return { ok: false, error: 'Hotkey ungültig oder belegt' }
    }
    globalShortcut.unregisterAll()
  }
  store.set('settings', { ...store.get('settings'), stopRaidHotkey: accelerator || '' })
  registerShortcuts()
  return { ok: true }
})

ipcMain.handle('settings:setMinimapHotkey', async (_e, accelerator) => {
  if (accelerator && !accelerator.startsWith('Mouse')) {
    globalShortcut.unregisterAll()
    let ok = false
    try { ok = globalShortcut.register(accelerator, () => overlay.toggleMinimap()) } catch (_) { ok = false }
    if (!ok) { registerShortcuts(); return { ok: false, error: 'Hotkey ungültig oder belegt' } }
    globalShortcut.unregisterAll()
  }
  store.set('settings', { ...store.get('settings'), minimapHotkey: accelerator || '' })
  registerShortcuts()
  return { ok: true }
})

ipcMain.handle('overlay:toggleMinimap', async () => ({ ok: true, visible: overlay.toggleMinimap() }))

// Open a URL in the user's default browser (used by the donate button).
ipcMain.handle('app:openExternal', async (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url)
  return { ok: true }
})

ipcMain.handle('settings:setAutostart', async (_e, on) => {
  store.set('settings', { ...store.get('settings'), autostart: !!on })
  applyAutostart()
  return { ok: true }
})

// Generic merge for non-critical preference toggles (TTS, event toasts, Discord).
ipcMain.handle('settings:set', async (_e, partial) => {
  store.set('settings', { ...store.get('settings'), ...(partial || {}) })
  return { ok: true, settings: store.get('settings') }
})

// Send a test message through one notification channel so the user can verify
// their token/webhook/chat-id is correct.
ipcMain.handle('settings:testNotify', async (_e, channel) => {
  const text = '✅ Rust+ Desktop test — notifications are working.'
  if (channel === 'discord') postDiscord(text)
  else if (channel === 'telegram') postTelegram(text)
  else if (channel === 'pushover') postPushover('Rust+ Desktop', text)
  else return { ok: false }
  return { ok: true }
})

// Native desktop notification (used by the renderer's world/team event detector).
ipcMain.handle('app:notify', async (_e, { title, body } = {}) => {
  if (Notification.isSupported()) new Notification({ title: title || 'Rust+', body: body || '' }).show()
  return { ok: true }
})

// ---- IPC: custom overlays -------------------------------------------------

ipcMain.handle('overlays:get', async () => store.get('overlays') || [])

ipcMain.handle('overlays:pickImage', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Overlay-Bild auswählen',
    properties: ['openFile'],
    filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
  })
  if (res.canceled || !res.filePaths[0]) return { ok: false }
  const p = res.filePaths[0]
  return { ok: true, path: p, name: path.basename(p) }
})

ipcMain.handle('overlays:add', async (_e, { label, src, hotkey, corner, size }) => {
  const list = store.get('overlays') || []
  list.push({ id: randomUUID(), label: label || 'Overlay', src, hotkey: hotkey || '', corner: corner || 'br', size: Number(size) || 340, visible: false })
  store.set('overlays', list)
  registerShortcuts()
  return store.get('overlays')
})

ipcMain.handle('overlays:update', async (_e, { id, label, hotkey, corner, size }) => {
  const list = (store.get('overlays') || []).map((o) =>
    o.id === id
      ? { ...o, label: label ?? o.label, hotkey: hotkey ?? o.hotkey, corner: corner ?? o.corner, size: size ?? o.size }
      : o,
  )
  store.set('overlays', list)
  registerShortcuts()
  // If the overlay is currently shown, re-position/resize it live.
  const ov = list.find((o) => o.id === id)
  if (ov && overlay.isCustomVisible(id)) overlay.showCustom(id, ov.src, { corner: ov.corner, size: ov.size })
  return store.get('overlays')
})

ipcMain.handle('overlays:remove', async (_e, id) => {
  overlay.hideCustom(id)
  store.set('overlays', (store.get('overlays') || []).filter((o) => o.id !== id))
  registerShortcuts()
  return store.get('overlays')
})

ipcMain.handle('overlays:toggle', async (_e, id) => {
  toggleOverlay(id)
  const ov = (store.get('overlays') || []).find((o) => o.id === id)
  return { ok: true, visible: !!ov?.visible }
})
