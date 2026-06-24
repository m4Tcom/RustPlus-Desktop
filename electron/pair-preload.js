// Preload for the Steam login window. Runs with contextIsolation:false so it
// shares the page's window object and can inject the handler the Rust+ login
// page expects (it thinks it's running inside the React Native mobile app).
const { ipcRenderer } = require('electron')

function installHandler() {
  if (window.ReactNativeWebView) return
  window.ReactNativeWebView = {
    // Rust+ calls this with a JSON string { SteamId, Token } after Steam login.
    postMessage: (message) => ipcRenderer.send('pair:steam-callback', message),
  }
}

// Install immediately, then keep re-installing: each cross-origin navigation
// (rust+ -> steam -> rust+) resets the window object.
installHandler()
setInterval(installHandler, 400)
