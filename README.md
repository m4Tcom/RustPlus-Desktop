# RustPlus Desktop

A free, open-source desktop app for **Rust+** — the companion features of the official mobile app, on your PC. Live map with team positions, smart switches & alarms, team chat, cameras, an in-game overlay minimap, raid alarm + warning overlays with custom hotkeys, device automations, a Discord bridge and a raid calculator.

> ⚠️ **Not affiliated with, endorsed by, or sponsored by Facepunch Studios.** "Rust" and "Rust+" are trademarks of Facepunch Studios. This is an independent community tool that talks to the public Rust+ API.

---

## Features

- **Map** – live server map with team positions, monuments, vending machines, cargo/heli/chinook/crate events, a toggleable layer legend, hover grid coordinates, a distance measure tool and a searchable global shop index.
- **Team** – members with HP, online/offline status and grid position.
- **Smart Devices** – toggle Smart Switches, watch Smart Alarms and Storage Monitors, plus **time-based automations** (e.g. lights on at night) and interval timers.
- **Cameras** – live CCTV / turret camera feeds with controls.
- **Chat & Clan** – read and send team & clan chat.
- **Raid alarm** – on a Smart Alarm trigger: a full-screen "you are being raided" warning with siren on every monitor, plus an in-app history where you mark each one test vs. real. Stop hotkey is fully configurable (keyboard **or** mouse button).
- **Overlays** – add your own image overlays, each with its own screen corner, size, on/off button and hotkey.
- **In-game minimap** – an always-on-top overlay minimap with live team + event positions and a proximity warning when a heli/chinook approaches you.
- **Items & Raid calculator** – item search with craft cost, and a raid cost calculator (walls/doors/deployables, cheapest mix).
- **Discord** – forward raid alarms and team chat to a Discord webhook.
- **Quality of life** – multiple saved servers, auto-reconnect, autostart, tray/background mode, 25-language UI.

## Download & install (Windows)

1. Grab the latest `RustPlus Desktop-Setup-x.y.z.exe` from the [Releases](../../releases) page.
2. Run it. Windows SmartScreen may warn about an unsigned app → **More info → Run anyway** (the app is unsigned; build it yourself from source if you prefer).

## Pairing

You need your server connection details from the game:

1. In Rust, press **F1** and run `client.gettoken` (or use the in-app **Pair with Steam** flow).
2. Enter Server IP, Port, Steam ID and Player Token in the **Setup** tab — or use the automatic pairing button.

## Build from source

```bash
git clone https://github.com/m4Tcom/RustPlus-Desktop.git
cd RustPlus-Desktop
npm install
npm run dev      # run in development
npm run build    # build a Windows installer into ./release
```

Requires Node.js 18+. The mouse-button hotkeys use the native `uiohook-napi` module (prebuilt binaries, no extra toolchain needed).

## Tech stack

Electron · React (Vite) · Tailwind CSS · Zustand · [`@liamcottle/rustplus.js`](https://github.com/liamcottle/rustplus.js)

## Support

This app is free. If it's useful to you, a small tip is hugely appreciated — but never required:

**[❤️ Donate via Revolut](https://revolut.me/mathis_j1_xrtt)**

## License

[MIT](LICENSE) © m4Tcom
