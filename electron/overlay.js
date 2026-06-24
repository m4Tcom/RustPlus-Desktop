// Shared overlay system: transparent, always-on-top, click-through windows shown
// across every monitor. Used by the raid alarm and custom image overlays.
const { BrowserWindow, screen } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

let raidWindows = []
let imageWindows = []
let customWindows = {} // overlay id -> BrowserWindow (bottom-right images)
let minimapWindow = null
let lastMinimapData = null // cached so a freshly-opened window can paint immediately

// Turn an absolute disk path into a file:// URL the overlay's <img> can load.
// Leaves http(s)/file/relative URLs untouched.
function toSrcUrl(src) {
  if (!src) return ''
  if (/^(https?:|file:|data:|\/)/i.test(src)) return src
  try {
    return pathToFileURL(src).href
  } catch (_) {
    return src
  }
}

function makeOverlayWindow(rect) {
  const { x, y, width, height } = rect
  const win = new BrowserWindow({
    x, y, width, height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required', // siren may start without a click
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  // Float above fullscreen games and let clicks pass through to the game.
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true)
  win.once('ready-to-show', () => win.showInactive())
  return win
}

function loadOverlay(win, params) {
  const search = new URLSearchParams(params).toString()
  win.loadFile(path.join(__dirname, 'overlay.html'), { search })
}

function closeAll(list) {
  list.forEach((w) => {
    try {
      if (!w.isDestroyed()) w.destroy()
    } catch (_) {
      /* ignore */
    }
  })
  return []
}

// ---- raid warning (all monitors) ----

function showRaid(details = {}) {
  hideRaid()
  for (const display of screen.getAllDisplays()) {
    const win = makeOverlayWindow(display.bounds)
    loadOverlay(win, { mode: 'raid', time: String(details.time || Date.now()), name: details.name || '' })
    raidWindows.push(win)
  }
}

function hideRaid() {
  raidWindows = closeAll(raidWindows)
}

function isRaidActive() {
  return raidWindows.length > 0
}

// ---- image overlay (primary monitor for now) ----

function showImage(src) {
  hideImage()
  const win = makeOverlayWindow(screen.getPrimaryDisplay().bounds)
  loadOverlay(win, { mode: 'image', src: toSrcUrl(src) })
  imageWindows.push(win)
}

function hideImage() {
  imageWindows = closeAll(imageWindows)
}

function toggleImage(src) {
  if (imageWindows.length) hideImage()
  else showImage(src)
}

// ---- custom image overlays (any corner of primary display) ----

const CUSTOM_SIZE = 340

// Compute the window rect for a given corner ('tl'|'tr'|'bl'|'br') and size.
function cornerRect(corner, size) {
  const wa = screen.getPrimaryDisplay().workArea
  const m = 12
  const left = wa.x + m
  const right = wa.x + wa.width - size - m
  const top = wa.y + m
  const bottom = wa.y + wa.height - size - m
  const pos = {
    tl: { x: left, y: top }, tr: { x: right, y: top },
    bl: { x: left, y: bottom }, br: { x: right, y: bottom },
  }[corner] || { x: right, y: bottom }
  return { x: pos.x, y: pos.y, width: size, height: size }
}

function showCustom(id, src, opts = {}) {
  hideCustom(id)
  const size = Math.max(80, Number(opts.size) || CUSTOM_SIZE)
  const win = makeOverlayWindow(cornerRect(opts.corner || 'br', size))
  loadOverlay(win, { mode: 'image', src: toSrcUrl(src) })
  customWindows[id] = win
  return true
}

function hideCustom(id) {
  const w = customWindows[id]
  if (w) {
    try {
      if (!w.isDestroyed()) w.destroy()
    } catch (_) {
      /* ignore */
    }
    delete customWindows[id]
  }
  return false
}

// Returns the new visibility (true = now shown).
function toggleCustom(id, src, opts) {
  return customWindows[id] ? hideCustom(id) : showCustom(id, src, opts)
}

function isCustomVisible(id) {
  return !!customWindows[id]
}

function hideAllCustom() {
  Object.keys(customWindows).forEach(hideCustom)
}

// ---- in-game overlay minimap (top-left corner of primary display) ----

const MINIMAP_SIZE = 420

function showMinimap() {
  if (minimapWindow && !minimapWindow.isDestroyed()) return
  const wa = screen.getPrimaryDisplay().workArea
  const win = new BrowserWindow({
    x: wa.x + 12,
    y: wa.y + 12,
    width: MINIMAP_SIZE,
    height: MINIMAP_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true)
  win.once('ready-to-show', () => {
    win.showInactive()
    if (lastMinimapData) pushMinimap(lastMinimapData)
  })
  win.loadFile(path.join(__dirname, 'minimap.html'))
  minimapWindow = win
}

function hideMinimap() {
  if (minimapWindow) {
    try { if (!minimapWindow.isDestroyed()) minimapWindow.destroy() } catch (_) { /* ignore */ }
    minimapWindow = null
  }
}

function toggleMinimap() {
  if (minimapWindow && !minimapWindow.isDestroyed()) { hideMinimap(); return false }
  showMinimap()
  return true
}

function isMinimapActive() {
  return !!(minimapWindow && !minimapWindow.isDestroyed())
}

// Push live data (map image, team positions) into the open minimap window.
function pushMinimap(data) {
  lastMinimapData = { ...lastMinimapData, ...data }
  if (!minimapWindow || minimapWindow.isDestroyed()) return
  const payload = JSON.stringify(lastMinimapData).replace(/</g, '\\u003c')
  minimapWindow.webContents
    .executeJavaScript(`window.__minimap && window.__minimap(${payload})`)
    .catch(() => {})
}

function destroyAll() {
  hideRaid()
  hideImage()
  hideAllCustom()
  hideMinimap()
}

module.exports = {
  showRaid, hideRaid, isRaidActive,
  showImage, hideImage, toggleImage,
  showCustom, hideCustom, toggleCustom, isCustomVisible, hideAllCustom,
  showMinimap, hideMinimap, toggleMinimap, isMinimapActive, pushMinimap,
  destroyAll,
}
