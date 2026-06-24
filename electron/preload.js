const { contextBridge, ipcRenderer } = require('electron')

// Helper: subscribe to a Main->Renderer channel, return an unsubscribe fn.
function on(channel, callback) {
  const handler = (_evt, payload) => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// Whitelisted IPC surface exposed to the renderer as window.electron.
contextBridge.exposeInMainWorld('electron', {
  // Connection
  connect: (creds) => ipcRenderer.invoke('rust:connect', creds),
  disconnect: () => ipcRenderer.invoke('rust:disconnect'),
  getSavedConfig: () => ipcRenderer.invoke('rust:getSavedConfig'),

  // Saved server profiles
  getProfiles: () => ipcRenderer.invoke('profiles:get'),
  removeProfile: (id) => ipcRenderer.invoke('profiles:remove', id),
  renameProfile: (id, name) => ipcRenderer.invoke('profiles:rename', { id, name }),

  // Device automations
  getAutomations: () => ipcRenderer.invoke('automations:get'),
  addAutomation: (a) => ipcRenderer.invoke('automations:add', a),
  updateAutomation: (a) => ipcRenderer.invoke('automations:update', a),
  removeAutomation: (id) => ipcRenderer.invoke('automations:remove', id),

  // Language preference (persisted in electron-store)
  getLanguage: () => ipcRenderer.invoke('app:getLanguage'),
  setLanguage: (lang) => ipcRenderer.invoke('app:setLanguage', lang),

  // Pairing
  startPairing: () => ipcRenderer.invoke('rust:startPairing'),
  cancelPairing: () => ipcRenderer.invoke('rust:cancelPairing'),

  // Data on demand
  getMap: () => ipcRenderer.invoke('rust:getMap'),
  sendChat: (message) => ipcRenderer.invoke('rust:sendChat', message),

  // Smart devices
  getDevices: () => ipcRenderer.invoke('rust:getDevices'),
  removeDevice: (entityId) => ipcRenderer.invoke('rust:removeDevice', entityId),
  getEntityInfo: (entityId) => ipcRenderer.invoke('rust:getEntityInfo', entityId),
  setEntityValue: (entityId, value) =>
    ipcRenderer.invoke('rust:setEntityValue', { entityId, value }),

  // Overlays (raid warning + custom image overlays)
  dismissRaid: () => ipcRenderer.invoke('overlay:dismissRaid'),
  testRaid: () => ipcRenderer.invoke('overlay:testRaid'),
  toggleImageOverlay: (src) => ipcRenderer.invoke('overlay:toggleImage', src),
  toggleMinimap: () => ipcRenderer.invoke('overlay:toggleMinimap'),

  // Settings (hotkeys, autostart)
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setStopHotkey: (accelerator) => ipcRenderer.invoke('settings:setStopHotkey', accelerator),
  setMinimapHotkey: (accelerator) => ipcRenderer.invoke('settings:setMinimapHotkey', accelerator),
  setAutostart: (on) => ipcRenderer.invoke('settings:setAutostart', on),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  testNotify: (channel) => ipcRenderer.invoke('settings:testNotify', channel),
  notify: (title, body) => ipcRenderer.invoke('app:notify', { title, body }),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  // Custom overlays management
  getOverlays: () => ipcRenderer.invoke('overlays:get'),
  pickOverlayImage: () => ipcRenderer.invoke('overlays:pickImage'),
  addOverlay: (o) => ipcRenderer.invoke('overlays:add', o),
  updateOverlay: (o) => ipcRenderer.invoke('overlays:update', o),
  removeOverlay: (id) => ipcRenderer.invoke('overlays:remove', id),
  toggleOverlay: (id) => ipcRenderer.invoke('overlays:toggle', id),

  // Team actions
  promoteToLeader: (steamId) => ipcRenderer.invoke('rust:promoteToLeader', steamId),

  // Clan
  getClanInfo: () => ipcRenderer.invoke('rust:getClanInfo'),
  getClanChat: () => ipcRenderer.invoke('rust:getClanChat'),
  sendClanMessage: (message) => ipcRenderer.invoke('rust:sendClanMessage', message),
  setClanMotd: (message) => ipcRenderer.invoke('rust:setClanMotd', message),

  // Cameras
  getCameras: () => ipcRenderer.invoke('rust:getCameras'),
  addCamera: (identifier, label) => ipcRenderer.invoke('rust:addCamera', { identifier, label }),
  removeCamera: (identifier) => ipcRenderer.invoke('rust:removeCamera', identifier),
  cameraSubscribe: (identifier) => ipcRenderer.invoke('rust:cameraSubscribe', identifier),
  cameraUnsubscribe: (identifier) => ipcRenderer.invoke('rust:cameraUnsubscribe', identifier),
  cameraInput: (identifier, buttons, x, y) =>
    ipcRenderer.invoke('rust:cameraInput', { identifier, buttons, x, y }),
  cameraAction: (identifier, action) =>
    ipcRenderer.invoke('rust:cameraAction', { identifier, action }),

  // Events (Main -> Renderer). Each returns an unsubscribe fn.
  onStatus: (cb) => on('rust:status', cb),
  onSelf: (cb) => on('rust:self', cb),
  onPairStatus: (cb) => on('rust:pairStatus', cb),
  onMapImage: (cb) => on('rust:mapImage', cb),
  onTeamUpdate: (cb) => on('rust:teamUpdate', cb),
  onChatUpdate: (cb) => on('rust:chatUpdate', cb),
  onChatMessage: (cb) => on('rust:chatMessage', cb),
  onMarkersUpdate: (cb) => on('rust:markersUpdate', cb),
  onInfoUpdate: (cb) => on('rust:infoUpdate', cb),
  onTimeUpdate: (cb) => on('rust:timeUpdate', cb),
  onDevicesUpdate: (cb) => on('rust:devicesUpdate', cb),
  onEntityChanged: (cb) => on('rust:entityChanged', cb),
  onClanMessage: (cb) => on('rust:clanMessage', cb),
  onCameraFrame: (cb) => on('rust:cameraFrame', cb),
  onOverlayState: (cb) => on('overlay:state', cb),
  onAlarm: (cb) => on('rust:alarm', cb),
  onProfilesUpdate: (cb) => on('rust:profilesUpdate', cb),
  onProximity: (cb) => on('rust:proximity', cb),
})
