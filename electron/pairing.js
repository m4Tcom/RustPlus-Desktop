// Native Rust+ pairing for the Main process.
//
// Replicates what `npx @liamcottle/rustplus.js fcm-register` + `fcm-listen` do,
// but uses an Electron BrowserWindow for the Steam login instead of launching an
// external Google Chrome with web-security disabled. Result: no Chrome required.
//
// Flow:
//   1. Register a virtual Android device with FCM            -> fcmCredentials
//   2. Trade the FCM token for an Expo push token            -> expoPushToken
//   3. Open Steam login, capture the Rust+ auth token        -> rustplusAuthToken
//   4. Register that token with the Rust Companion API
//   5. Listen on FCM for the pairing notification the game
//      sends when the user clicks "Pair" on a server         -> { ip, port, steamId, playerToken }

const path = require('path')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const { BrowserWindow, ipcMain } = require('electron')
const AndroidFCM = require('@liamcottle/push-receiver/src/android/fcm')
const PushReceiverClient = require('@liamcottle/push-receiver/src/client')

// Constants lifted from the official rustplus.js CLI (Rust Companion app identity).
const FCM = {
  apiKey: 'AIzaSyB5y2y-Tzqb4-I4Qnlsh_9naYv_TD8pCvY',
  projectId: 'rust-companion-app',
  gcmSenderId: '976529667804',
  gmsAppId: '1:976529667804:android:d6f1ddeb4403b338fea619',
  androidPackageName: 'com.facepunch.rust.companion',
  androidPackageCert: 'E28D05345FB78A7A1A63D70F4A302DBF426CA5AD',
}
const EXPO_PROJECT_ID = '49451aca-a822-41e6-ad59-955718d0ff9c'
const STEAM_LOGIN_URL = 'https://companion-rust.facepunch.com/login'

let fcmClient = null // active push-receiver client (kept alive to catch notifications)
let steamWindow = null // active Steam login window, if any

async function getExpoPushToken(fcmToken) {
  const response = await axios.post('https://exp.host/--/api/v2/push/getExpoPushToken', {
    type: 'fcm',
    deviceId: uuidv4(),
    development: false,
    appId: FCM.androidPackageName,
    deviceToken: fcmToken,
    projectId: EXPO_PROJECT_ID,
  })
  return response.data.data.expoPushToken
}

function registerWithRustPlus(authToken, expoPushToken) {
  return axios.post('https://companion-rust.facepunch.com:443/api/push/register', {
    AuthToken: authToken,
    DeviceId: 'rustplus-desktop',
    PushKind: 3,
    PushToken: expoPushToken,
  })
}

/**
 * Open the Rust+ Steam login in a child BrowserWindow and resolve with the
 * captured auth data. A small preload injects window.ReactNativeWebView so the
 * Rust+ login page hands us { SteamId, Token } just like it would the mobile app.
 */
function steamLogin(parentWindow) {
  return new Promise((resolve, reject) => {
    closeSteamWindow()

    steamWindow = new BrowserWindow({
      width: 540,
      height: 760,
      parent: parentWindow || undefined,
      modal: false,
      autoHideMenuBar: true,
      title: 'Mit Steam bei Rust+ anmelden',
      backgroundColor: '#1a1a1a',
      webPreferences: {
        preload: path.join(__dirname, 'pair-preload.js'),
        contextIsolation: false, // preload must share the page's window to inject ReactNativeWebView
        nodeIntegration: false,
        partition: 'persist:rustplus-pairing', // isolated session, but remembers Steam login
      },
    })

    let settled = false

    const onCallback = (_evt, message) => {
      if (settled) return
      let auth
      try {
        auth = JSON.parse(message)
      } catch {
        return // not the message we want
      }
      if (!auth || !auth.Token) return
      settled = true
      ipcMain.removeListener('pair:steam-callback', onCallback)
      resolve({ token: auth.Token, steamId: auth.SteamId != null ? String(auth.SteamId) : null })
      closeSteamWindow()
    }

    ipcMain.on('pair:steam-callback', onCallback)

    // Surface only genuine load failures. ERR_ABORTED (-3) is expected here:
    // the Rust+ login page immediately redirects to Steam, which aborts the
    // original request even though navigation continues normally.
    const onFail = (_e, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isMainFrame || settled) return
      if (errorCode === -3) return // ERR_ABORTED – normal during redirects
      settled = true
      reject(new Error('Login-Seite konnte nicht geladen werden: ' + errorDescription))
      closeSteamWindow()
    }
    steamWindow.webContents.on('did-fail-load', onFail)

    steamWindow.on('closed', () => {
      steamWindow = null
      ipcMain.removeListener('pair:steam-callback', onCallback)
      if (!settled) {
        settled = true
        reject(new Error('Steam-Login abgebrochen'))
      }
    })

    // Redirect-induced ERR_ABORTED rejects this promise; that's expected and
    // handled by did-fail-load above, so swallow it here.
    steamWindow.loadURL(STEAM_LOGIN_URL).catch(() => {})
  })
}

function closeSteamWindow() {
  if (steamWindow && !steamWindow.isDestroyed()) {
    steamWindow.destroy()
  }
  steamWindow = null
}

/**
 * Start (or restart) the FCM listener. onNotification is called for every
 * incoming push with { title, message, body } where body is the parsed JSON
 * payload (server pairing, entity pairing, smart alarm, etc.).
 */
async function startFcmListener(fcmCredentials, onNotification) {
  stopFcmListener()

  const androidId = fcmCredentials.gcm.androidId
  const securityToken = fcmCredentials.gcm.securityToken
  fcmClient = new PushReceiverClient(androidId, securityToken, [])

  fcmClient.on('ON_DATA_RECEIVED', (data) => {
    try {
      const appData = data.appData || []
      const get = (key) => appData.find((d) => d.key === key)?.value
      const bodyRaw = get('body')
      const body = bodyRaw ? JSON.parse(bodyRaw) : {}
      onNotification({
        title: get('title') || '',
        message: get('message') || '',
        body,
      })
    } catch {
      // ignore malformed notifications
    }
  })

  await fcmClient.connect()
}

function stopFcmListener() {
  if (fcmClient) {
    try {
      fcmClient.destroy()
    } catch {
      /* ignore */
    }
    fcmClient = null
  }
}

/**
 * Run the full pairing flow.
 * @param {BrowserWindow} parentWindow
 * @param {(stage: string, payload?: any) => void} emit  status callback
 * @param {(notif: object) => void} onNotification       fires for every FCM push
 * @param {import('electron-store')} store               for persisting credentials
 */
async function startPairing(parentWindow, emit, onNotification, store) {
  emit('registering-fcm')
  const fcmCredentials = await AndroidFCM.register(
    FCM.apiKey,
    FCM.projectId,
    FCM.gcmSenderId,
    FCM.gmsAppId,
    FCM.androidPackageName,
    FCM.androidPackageCert,
  )

  emit('fetching-expo')
  const expoPushToken = await getExpoPushToken(fcmCredentials.fcm.token)

  emit('awaiting-steam')
  const { token, steamId } = await steamLogin(parentWindow)

  emit('registering-rustplus')
  await registerWithRustPlus(token, expoPushToken)

  // Persist so we could re-listen on a later launch.
  store.set('pairing', {
    fcmCredentials,
    expoPushToken,
    rustplusAuthToken: token,
    steamId,
  })

  emit('listening', { steamId })
  await startFcmListener(fcmCredentials, onNotification)
}

function cancelPairing() {
  closeSteamWindow()
}

module.exports = {
  startPairing,
  startFcmListener,
  cancelPairing,
  stopFcmListener,
}
