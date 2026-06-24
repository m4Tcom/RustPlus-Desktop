# RustPlus Desktop – CLAUDE.md

## Projektziel
Baue eine native Windows/Mac Desktop-App, die exakt dieselben Funktionen wie die offizielle **Rust+** Mobile App bietet – aber als PC-Anwendung.

---

## Tech Stack

| Schicht | Technologie |
|---|---|
| Desktop-Framework | **Electron** |
| Frontend | **React** (Vite + JSX) |
| Styling | **Tailwind CSS** |
| Rust-Protokoll | **@liamcottle/rustplus.js** |
| State Management | **Zustand** |
| Icons | **lucide-react** |

---

## Projektstruktur

```
rustplus-desktop/
├── CLAUDE.md
├── package.json
├── vite.config.js
├── tailwind.config.js
├── electron/
│   ├── main.js          # Electron Main Process
│   └── preload.js       # IPC Bridge
└── src/
    ├── App.jsx           # Root mit Tab-Navigation
    ├── main.jsx          # React Entry Point
    ├── store/
    │   └── useRustStore.js   # Zustand Store (globaler State)
    ├── components/
    │   ├── Sidebar.jsx       # Tab-Leiste links
    │   ├── StatusBar.jsx     # Verbindungsstatus oben
    │   └── Notification.jsx  # Desktop-Alarm Toast
    └── pages/
        ├── Setup.jsx         # Pairing / Token eingeben
        ├── Map.jsx           # Serverkarte
        ├── Team.jsx          # Teammitglieder + Positionen
        ├── Devices.jsx       # Smart Switch / Alarm
        └── Chat.jsx          # Team-Chat
```

---

## Features – nach Priorität

### 1. Setup & Verbindung (ZUERST bauen)
- Formular für: Server IP, Port, Steam ID, Player Token
- Daten lokal speichern via `electron-store`
- Verbindungsstatus anzeigen (Connecting / Connected / Error)
- rustplus.js Instanz im Main Process halten

### 2. Karte (Map)
- `getMap()` aufrufen und als Bild rendern
- Alle 5 Sekunden `getEntityInfo` für Monumentpositionen
- Teammarker auf der Karte einzeichnen (Canvas overlay)

### 3. Team
- `getTeamInfo()` alle 10 Sekunden pollen
- Für jedes Mitglied anzeigen: Name, HP, Online/Offline, Koordinaten
- Online-Mitglieder grün, Offline grau markieren

### 4. Smart Devices
- Alle gepairten Smart Switches und Smart Alarms auflisten
- Switches toggeln via `setEntityValue()`
- Bei eingehendem Alarm → Electron Desktop Notification

### 5. Chat
- `getTeamChat()` alle 3 Sekunden pollen
- Nachrichten senden via `sendTeamMessage()`
- Autoscroll nach unten

---

## Electron IPC Architektur

Die rustplus.js Verbindung läuft **ausschließlich im Main Process** (Node.js).
Das Frontend (Renderer) kommuniziert nur über IPC:

```js
// Renderer → Main (Befehle senden)
window.electron.invoke('rust:connect', { ip, port, steamId, playerToken })
window.electron.invoke('rust:toggleSwitch', { entityId, value })
window.electron.invoke('rust:sendChat', { message })

// Main → Renderer (Events pushen)
window.electron.on('rust:teamUpdate', (teamData) => { ... })
window.electron.on('rust:alarm', (alarmData) => { ... })
window.electron.on('rust:chat', (messages) => { ... })
```

---

## Design

- **Dark Theme**, Farbpalette: Hintergrund `#1a1a1a`, Karten `#252525`, Akzent `#cd4a22` (Rust-Orange)
- Seitenleiste links mit Icons für jede Seite
- Kompakter Header mit Servername + Verbindungsstatus (grüner Punkt)
- Ähnlicher Look zur offiziellen Rust+ App, aber für Desktop optimiert

---

## Abhängigkeiten (package.json)

```json
{
  "dependencies": {
    "@liamcottle/rustplus.js": "latest",
    "electron-store": "^8.1.0",
    "react": "^18",
    "react-dom": "^18",
    "zustand": "^4"
  },
  "devDependencies": {
    "electron": "latest",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8",
    "electron-builder": "latest",
    "concurrently": "latest",
    "wait-on": "latest"
  }
}
```

---

## Wichtige Hinweise für Claude Code

1. **rustplus.js nur im Main Process** – niemals im Renderer importieren (Node.js APIs)
2. **Polling statt Echtzeit** für Map/Team (rustplus.js Events sind unzuverlässig) – Intervalle oben angegeben
3. **electron-store** für persistente Daten (Token, IP etc.) – kein localStorage
4. **CSP im Main Process** locker halten damit Vite Dev Server funktioniert
5. **Zuerst Verbindung und Setup bauen**, dann Features oben draufsetzen
6. **Token Info**: Player Token und Steam ID bekommt man beim In-Game Pairing. Im Setup-Screen einen Hinweis einbauen wie man das macht (Rust → F1 → `client.gettoken`)

---

## Start-Befehle

```bash
npm install
npm run dev        # Electron + Vite gleichzeitig starten
npm run build      # Für Distribution bauen
```

---

## Erster Schritt für Claude Code

> Starte mit `electron/main.js`, `electron/preload.js` und `src/pages/Setup.jsx`. Baue zuerst die funktionierende Verbindung zu einem Rust-Server mit rustplus.js, bevor du andere Seiten implementierst.
