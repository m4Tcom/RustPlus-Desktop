# Icons / eigene Assets

Hier kannst du eigene Icons, Bilder und Grafiken ablegen (PNG, SVG, JPG, WEBP …).

Alles in `public/` wird von Vite **unverändert** ausgeliefert und ist im Renderer
direkt über einen absoluten Pfad erreichbar — **ohne** Import.

## So referenzierst du eine Datei

Lege z. B. `public/icons/cargo.png` ab. Im Code dann:

```jsx
<img src="/icons/cargo.png" alt="" />
```

oder als CSS-Hintergrund:

```jsx
<div style={{ backgroundImage: 'url(/icons/cargo.png)' }} />
```

> Wichtig: Der Pfad beginnt mit `/icons/...` (führender Slash = Projekt-Root),
> **nicht** `public/icons/...`. Das `public/` fällt in der URL weg.

## Empfohlene Benennung

- Kleinschreibung, keine Leerzeichen: `patrol-heli.png`, `oil-rig.svg`
- Map-Marker am besten quadratisch (z. B. 64×64 px) und mit transparentem Hintergrund
- SVG ist ideal für Marker (skaliert verlustfrei)

## Wenn du so weit bist

Leg die Dateien hier rein und sag mir, **welche Datei wofür** gedacht ist
(z. B. „`cargo.png` soll das Frachtschiff-Icon auf der Karte ersetzen"),
dann baue ich die Einbindung ein.
