import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ZoomIn, ZoomOut, RefreshCw, Sun, Moon, Loader2, Maximize2, LocateFixed,
  Ship, Plane, Package, ShoppingBag, Bomb, Users, ChevronRight, ChevronLeft, Crown, X, MapPin,
  Eye, EyeOff, Landmark, Circle, Layers, TrainTrack, Ruler, Search, Store,
} from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'
import { itemName } from '../lib/items'
import { MARKER, formatGameTime, isDaytime, gridFromWorld, gridCellCount, colLabel, monumentName } from '../lib/rust'

// map marker type -> translation key
const MARKER_KEY = { 1: 'marker.player', 2: 'marker.explosion', 3: 'marker.shop', 4: 'marker.chinook', 5: 'marker.cargo', 6: 'marker.crate', 7: 'marker.radius', 8: 'marker.heli' }
// map marker type -> toggleable legend layer key
const LAYER_BY_TYPE = { 2: 'explosion', 3: 'shop', 4: 'chinook', 5: 'cargo', 6: 'crate', 8: 'heli' }

// Small helicopter glyph (lucide has no heli icon).
function Heli({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h18" />
      <path d="M12 4v6" />
      <rect x="7" y="10" width="9" height="5" rx="2" />
      <path d="M16 12h4l-2 3" />
      <path d="M5 19h7" />
      <path d="M8 15v4" />
    </svg>
  )
}

// Returns the icon + color for a map marker type.
function markerVisual(type) {
  switch (type) {
    case 2: return { Icon: Bomb, color: MARKER[2].color }
    case 3: return { Icon: ShoppingBag, color: MARKER[3].color }
    case 4: return { Icon: Plane, color: MARKER[4].color }
    case 5: return { Icon: Ship, color: MARKER[5].color }
    case 6: return { Icon: Package, color: MARKER[6].color }
    case 8: return { Icon: Heli, color: MARKER[8].color }
    default: return null
  }
}

const MAX_ZOOM_FACTOR = 14 // how far past "fit" you can zoom in

export default function MapPage() {
  const { t, lang } = useT()
  const mapImage = useRustStore((s) => s.mapImage)
  const markers = useRustStore((s) => s.markers)
  const team = useRustStore((s) => s.team)
  const serverInfo = useRustStore((s) => s.serverInfo)
  const time = useRustStore((s) => s.time)
  const mySteamId = useRustStore((s) => s.mySteamId)
  const setMapImage = useRustStore((s) => s.setMapImage)

  const mapSize = serverInfo?.mapSize || 0
  const imgW = mapImage?.width || 0
  const imgH = mapImage?.height || 0

  // The getMap image has an ocean-margin border; world coords (0..mapSize) only
  // cover the inner area. Verified formula (see RustPlusBot mapmarker example):
  //   diff = (width - 2*margin) / mapSize;  px = margin + x*diff;  py = height - (margin + y*diff)
  const margin = mapImage?.oceanMargin || 0
  const diff = mapSize ? (imgW - 2 * margin) / mapSize : 0
  const w2px = (x) => margin + x * diff
  const w2py = (y) => imgH - (margin + y * diff)

  const viewportRef = useRef(null)
  const worldRef = useRef(null)
  const dragRef = useRef(null)
  const initializedRef = useRef(false)

  const [vp, setVp] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const [refreshing, setRefreshing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [legendOpen, setLegendOpen] = useState(true)
  const [shop, setShop] = useState(null) // selected vending machine marker
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePts, setMeasurePts] = useState([]) // world coords [{x,y}, {x,y}]
  const [hover, setHover] = useState(null) // world coord under cursor
  const [shopIndexOpen, setShopIndexOpen] = useState(false)
  const [shopQuery, setShopQuery] = useState('')
  const [layers, setLayers] = useState({
    monuments: true, tunnels: false, team: true, notes: true,
    cargo: true, heli: true, chinook: true, crate: true, shop: true, explosion: true, radius: true,
  })
  const toggleLayer = (k) => setLayers((p) => ({ ...p, [k]: !p[k] }))

  // Viewport (client) pixel -> world coordinate (metres, 0..mapSize).
  const clientToWorld = (clientX, clientY) => {
    const el = viewportRef.current
    if (!el || !diff) return null
    const rect = el.getBoundingClientRect()
    const ipx = (clientX - rect.left - view.tx) / view.scale
    const ipy = (clientY - rect.top - view.ty) / view.scale
    return { x: (ipx - margin) / diff, y: (imgH - ipy - margin) / diff }
  }

  const fitScale = vp.w && imgW ? Math.min(vp.w / imgW, vp.h / imgH) : 1
  const maxScale = fitScale * MAX_ZOOM_FACTOR

  // world(image px) -> keep map covering the viewport (no dragging into the void)
  const clamp = useCallback(
    (next) => {
      const scale = Math.min(maxScale, Math.max(fitScale, next.scale))
      const sw = imgW * scale
      const sh = imgH * scale
      let { tx, ty } = next
      tx = sw <= vp.w ? (vp.w - sw) / 2 : Math.min(0, Math.max(vp.w - sw, tx))
      ty = sh <= vp.h ? (vp.h - sh) / 2 : Math.min(0, Math.max(vp.h - sh, ty))
      return { scale, tx, ty }
    },
    [fitScale, maxScale, imgW, imgH, vp.w, vp.h],
  )

  const fit = useCallback(() => {
    setView(clamp({ scale: fitScale, tx: 0, ty: 0 }))
  }, [clamp, fitScale])

  // Center the viewport on a world coordinate at a given zoom.
  const focusWorld = useCallback(
    (x, y, targetScale) => {
      if (!mapSize || x == null) return
      const px = margin + x * diff
      const py = imgH - (margin + y * diff)
      const scale = targetScale ?? Math.min(maxScale, Math.max(fitScale * 3.5, fitScale))
      setView(clamp({ scale, tx: vp.w / 2 - px * scale, ty: vp.h / 2 - py * scale }))
    },
    [clamp, fitScale, maxScale, imgH, margin, diff, mapSize, vp.w, vp.h],
  )

  // Measure viewport.
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setVp({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fit once we have both image + viewport; re-fit on resize until user interacts.
  useEffect(() => {
    if (!imgW || !vp.w) return
    if (!initializedRef.current) {
      initializedRef.current = true
      fit()
    }
  }, [imgW, vp.w, fit])

  // Wheel zoom toward cursor (native listener so we can preventDefault).
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setView((prev) => {
        const factor = Math.exp(-e.deltaY * 0.0015)
        const scale = Math.min(maxScale, Math.max(fitScale, prev.scale * factor))
        const wx = (cx - prev.tx) / prev.scale
        const wy = (cy - prev.ty) / prev.scale
        return clamp({ scale, tx: cx - wx * scale, ty: cy - wy * scale })
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [clamp, fitScale, maxScale])

  // Drag to pan (or place measure points when the ruler is active).
  const onMouseDown = (e) => {
    if (e.button !== 0) return
    if (measureMode) {
      const p = clientToWorld(e.clientX, e.clientY)
      if (p) setMeasurePts((pts) => (pts.length >= 2 ? [p] : [...pts, p]))
      return
    }
    dragRef.current = { sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty }
  }
  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return
      setView((prev) => clamp({ scale: prev.scale, tx: d.tx + (e.clientX - d.sx), ty: d.ty + (e.clientY - d.sy) }))
    }
    const onUp = () => (dragRef.current = null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [clamp])

  const refreshMap = async () => {
    setRefreshing(true)
    const res = await window.electron.getMap()
    if (res?.ok) setMapImage(res.data)
    setRefreshing(false)
  }

  const zoomButton = (dir) => {
    setView((prev) => {
      const scale = Math.min(maxScale, Math.max(fitScale, prev.scale * (dir > 0 ? 1.4 : 1 / 1.4)))
      const cx = vp.w / 2
      const cy = vp.h / 2
      const wx = (cx - prev.tx) / prev.scale
      const wy = (cy - prev.ty) / prev.scale
      return clamp({ scale, tx: cx - wx * scale, ty: cy - wy * scale })
    })
  }

  const members = team?.members || []
  const onlineMembers = members.filter((m) => m.isOnline && m.x != null)
  const me = members.find((m) => m.steamId === mySteamId)

  // Keep the open shop popup in sync with the latest marker poll.
  const activeShop = shop ? markers.find((m) => m.id === shop.id) : null
  const mapNotes = [...(team?.mapNotes || []), ...(team?.leaderMapNotes || [])].filter((n) => n.x != null)

  // Measured distance between the two placed points (world coords are metres).
  const measureDist = measurePts.length === 2
    ? Math.round(Math.hypot(measurePts[1].x - measurePts[0].x, measurePts[1].y - measurePts[0].y))
    : null

  // Global shop index: every sell order across all vending machines, searchable.
  const shopOrders = useMemo(() => {
    const out = []
    for (const m of markers) {
      if (m.type !== 3 || !m.sellOrders?.length) continue
      for (const o of m.sellOrders) {
        out.push({
          shopId: m.id, shopName: m.name, x: m.x, y: m.y,
          item: itemName(o.itemId), itemBp: o.itemIsBlueprint, quantity: o.quantity,
          cost: o.costPerItem, currency: itemName(o.currencyId), currencyBp: o.currencyIsBlueprint,
          stock: o.amountInStock,
        })
      }
    }
    const q = shopQuery.trim().toLowerCase()
    const filtered = q ? out.filter((o) => o.item.toLowerCase().includes(q) || o.currency.toLowerCase().includes(q)) : out
    return filtered.sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.item.localeCompare(b.item))
  }, [markers, shopQuery, mapSize])

  // Toggleable legend layers (icon swatch + label per category).
  const legendItems = [
    { key: 'team', Icon: Users, color: '#22c55e', label: t('map.team') },
    { key: 'monuments', Icon: Landmark, color: '#b8a06a', label: t('map.monuments') },
    { key: 'tunnels', Icon: TrainTrack, color: '#8b8170', label: t('map.tunnels') },
    { key: 'notes', Icon: MapPin, color: '#fbbf24', label: t('map.note') },
    { key: 'cargo', Icon: Ship, color: MARKER[5].color, label: t('marker.cargo') },
    { key: 'heli', Icon: Heli, color: MARKER[8].color, label: t('marker.heli') },
    { key: 'chinook', Icon: Plane, color: MARKER[4].color, label: t('marker.chinook') },
    { key: 'crate', Icon: Package, color: MARKER[6].color, label: t('marker.crate') },
    { key: 'shop', Icon: ShoppingBag, color: MARKER[3].color, label: t('marker.shop') },
    { key: 'explosion', Icon: Bomb, color: MARKER[2].color, label: t('marker.explosion') },
    { key: 'radius', Icon: Circle, color: MARKER[7].color, label: t('marker.radius') },
  ]

  // ---- static-ish overlay (grid + monuments + radius), memoized in image px ----
  const overlay = useMemo(() => {
    if (!imgW || !mapSize) return null
    const cells = gridCellCount(mapSize)
    const innerW = imgW - 2 * margin
    const innerH = imgH - 2 * margin
    const cw = innerW / cells
    const ch = innerH / cells
    const x0 = margin
    const y0 = margin // top of playable area (world y = mapSize)
    const lines = []
    for (let i = 1; i < cells; i++) {
      lines.push(<line key={`v${i}`} x1={x0 + i * cw} y1={y0} x2={x0 + i * cw} y2={y0 + innerH} />)
      lines.push(<line key={`h${i}`} x1={x0} y1={y0 + i * ch} x2={x0 + innerW} y2={y0 + i * ch} />)
    }
    const labels = []
    for (let c = 0; c < cells; c++) {
      for (let r = 0; r < cells; r++) {
        labels.push(
          <text key={`l${c}-${r}`} x={x0 + c * cw + cw * 0.06} y={y0 + r * ch + ch * 0.22} fontSize={cw * 0.16}>
            {colLabel(c)}{r}
          </text>,
        )
      }
    }
    return { cw, lines, labels }
  }, [imgW, imgH, mapSize, margin])

  const monuments = useMemo(() => {
    if (!imgW || !mapSize || !mapImage?.monuments) return []
    const out = []
    for (const mo of mapImage.monuments) {
      const name = monumentName(mo.token, lang)
      if (!name) continue
      // Collapse clustered duplicate labels. Underwater labs / train tunnels are
      // made of many module entries spread over a wide area, so dedupe them with
      // a large radius; normal monuments only merge if nearly coincident.
      const r = /lab|tunnel|labor|тонн|лаборатор|隧道|실험|터널/i.test(name) ? 900 : 120
      if (out.some((m) => m.name === name && Math.abs(m.x - mo.x) < r && Math.abs(m.y - mo.y) < r)) continue
      // Train tunnels get their own toggleable layer (language-independent flag).
      const tunnel = monumentName(mo.token, 'en') === 'Train Tunnel'
      out.push({ name, tunnel, x: mo.x, y: mo.y, px: margin + mo.x * diff, py: imgH - (margin + mo.y * diff) })
    }
    return out
  }, [mapImage, imgW, imgH, mapSize, margin, diff, lang])

  if (!mapImage?.jpgImage) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
        <Loader2 className="animate-spin text-rust-accent" size={28} />
        {t('map.loading')}
        <button onClick={refreshMap} className="text-sm text-rust-accent hover:underline">{t('map.retry')}</button>
      </div>
    )
  }

  const labelFont = overlay ? overlay.cw * 0.26 : 12

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-black/40 bg-rust-card/40 z-10">
        <span className="text-sm text-gray-300">{serverInfo?.map || 'Karte'}</span>
        <span className="text-xs text-gray-500">{mapSize} m</span>
        <div className="flex items-center gap-1 ml-1 text-sm text-gray-300">
          {isDaytime(time) ? <Sun size={15} className="text-yellow-400" /> : <Moon size={15} className="text-blue-300" />}
          {formatGameTime(time?.time)}
        </div>
        <div className="flex-1" />
        <button onClick={() => focusWorld(me?.x ?? onlineMembers[0]?.x, me?.y ?? onlineMembers[0]?.y)}
          disabled={!me && onlineMembers.length === 0}
          className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded hover:bg-white/10 disabled:opacity-30" title={t('map.centerMeTip')}>
          <LocateFixed size={15} /> {t('map.centerMe')}
        </button>
        <button onClick={() => setShopIndexOpen((o) => !o)} className={`p-1.5 rounded hover:bg-white/10 ${shopIndexOpen ? 'bg-white/10 text-rust-accent' : ''}`} title={t('map.shops')}><Store size={16} /></button>
        <button onClick={() => { setMeasureMode((m) => !m); setMeasurePts([]) }} className={`p-1.5 rounded hover:bg-white/10 ${measureMode ? 'bg-rust-accent text-white' : ''}`} title={t('map.measure')}><Ruler size={16} /></button>
        <button onClick={fit} className="p-1.5 rounded hover:bg-white/10" title={t('map.wholeMap')}><Maximize2 size={16} /></button>
        <button onClick={() => zoomButton(-1)} className="p-1.5 rounded hover:bg-white/10" title={t('map.zoomOut')}><ZoomOut size={16} /></button>
        <button onClick={() => zoomButton(1)} className="p-1.5 rounded hover:bg-white/10" title={t('map.zoomIn')}><ZoomIn size={16} /></button>
        <button onClick={refreshMap} className="p-1.5 rounded hover:bg-white/10" title={t('map.reload')}>
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Map viewport + team panel */}
      <div className="flex-1 relative min-h-0">
        <div
          ref={viewportRef}
          onMouseDown={onMouseDown}
          onMouseMove={(e) => { if (mapSize) setHover(clientToWorld(e.clientX, e.clientY)) }}
          onMouseLeave={() => setHover(null)}
          className={`absolute inset-0 overflow-hidden bg-[#0d1b2a] ${measureMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        >
          <div
            ref={worldRef}
            style={{
              position: 'absolute', width: imgW, height: imgH, transformOrigin: '0 0',
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
              '--inv': 1 / view.scale,
            }}
          >
            <img src={`data:image/jpeg;base64,${mapImage.jpgImage}`} alt="Rust map" width={imgW} height={imgH} className="block select-none" draggable={false} />

            {/* Grid + monument labels (scale with the map, like in-game) */}
            {overlay && (
              <svg className="absolute inset-0 pointer-events-none" width={imgW} height={imgH}>
                <g stroke="rgba(0,0,0,0.30)" strokeWidth={imgW * 0.0006}>{overlay.lines}</g>
                <g fill="rgba(20,20,20,0.5)" fontFamily="sans-serif">{overlay.labels}</g>
                <g fill="#f5ecd8" stroke="rgba(0,0,0,0.7)" strokeWidth={labelFont * 0.05} paintOrder="stroke" fontFamily="sans-serif" textAnchor="middle">
                  {monuments.map((m, i) =>
                    (m.tunnel ? layers.tunnels : layers.monuments) ? (
                      <text key={i} x={m.px} y={m.py} fontSize={labelFont} fontStyle="italic">{m.name}</text>
                    ) : null,
                  )}
                </g>
              </svg>
            )}

            {/* Generic radius markers (cargo/heli zones) in world space */}
            <svg className="absolute inset-0 pointer-events-none" width={imgW} height={imgH}>
              {layers.radius && markers.filter((m) => m.type === 7 && m.radius).map((m) => (
                <circle key={m.id} cx={w2px(m.x)} cy={w2py(m.y)} r={m.radius * diff}
                  fill="rgba(244,63,94,0.10)" stroke="rgba(244,63,94,0.5)" strokeWidth={imgW * 0.0008} />
              ))}
            </svg>

            {/* Distance measure tool */}
            {measurePts.length > 0 && (() => {
              const a = measurePts[0]
              const b = measurePts[1] || (measureMode ? hover : null)
              const sw = imgW * 0.0012
              return (
                <svg className="absolute inset-0 pointer-events-none" width={imgW} height={imgH}>
                  {b && <line x1={w2px(a.x)} y1={w2py(a.y)} x2={w2px(b.x)} y2={w2py(b.y)} stroke="#cd4a22" strokeWidth={sw} strokeDasharray={`${sw * 4} ${sw * 3}`} />}
                  {measurePts.map((p, i) => (
                    <circle key={i} cx={w2px(p.x)} cy={w2py(p.y)} r={sw * 2.5} fill="#cd4a22" stroke="#000" strokeWidth={sw * 0.5} />
                  ))}
                </svg>
              )
            })()}

            {/* Event markers (constant screen size via --inv counter-scale) */}
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              {markers.map((m) => {
                const v = markerVisual(m.type)
                if (!v) return null
                if (!layers[LAYER_BY_TYPE[m.type]]) return null
                const { Icon, color } = v
                const isShop = m.type === 3 && m.sellOrders?.length > 0
                return (
                  <div key={m.id} title={m.name || t(MARKER_KEY[m.type] || 'marker.player')}
                    onClick={isShop ? () => setShop(m) : undefined}
                    onContextMenu={isShop ? (e) => { e.preventDefault(); setShop(null) } : undefined}
                    style={{ position: 'absolute', left: w2px(m.x), top: w2py(m.y), width: 26, height: 26, marginLeft: -13, marginTop: -13, transform: 'scale(var(--inv))', transformOrigin: 'center', pointerEvents: 'auto', cursor: isShop ? 'pointer' : 'default' }}>
                    <div className="w-full h-full rounded-full flex items-center justify-center shadow-md border border-black/40" style={{ background: color }}>
                      <Icon size={16} color="#fff" />
                    </div>
                  </div>
                )
              })}

              {/* Team map notes (pings placed on the in-game map) */}
              {layers.notes && mapNotes.map((n, i) => (
                <div key={`note${i}`} title={t('map.note')}
                  style={{ position: 'absolute', left: w2px(n.x), top: w2py(n.y), width: 20, height: 20, marginLeft: -10, marginTop: -20, transform: 'scale(var(--inv))', transformOrigin: 'bottom center' }}>
                  <MapPin size={20} color="#fbbf24" fill="#fbbf24" stroke="#000" strokeWidth={1.5} />
                </div>
              ))}

              {/* Teammates */}
              {layers.team && onlineMembers.map((m) => {
                const isMe = m.steamId === mySteamId
                return (
                  <div key={m.steamId}
                    style={{ position: 'absolute', left: w2px(m.x), top: w2py(m.y), width: 18, height: 18, marginLeft: -9, marginTop: -9, transform: 'scale(var(--inv))', transformOrigin: 'center' }}>
                    <div className="w-full h-full rounded-full border-2 shadow-md"
                      style={{ background: m.isAlive ? (isMe ? '#cd4a22' : '#22c55e') : '#6b7280', borderColor: '#000' }} />
                    <div className="absolute left-[22px] top-1/2 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium"
                      style={{ color: '#fff', textShadow: '0 0 3px #000, 0 0 3px #000' }}>
                      {m.name}{isMe ? ` (${t('map.you')})` : ''}
                    </div>
                  </div>
                )
              })}

              {/* Measure distance label at the midpoint */}
              {measureDist != null && (
                <div style={{ position: 'absolute', left: w2px((measurePts[0].x + measurePts[1].x) / 2), top: w2py((measurePts[0].y + measurePts[1].y) / 2), transform: 'scale(var(--inv))', transformOrigin: 'center', pointerEvents: 'none' }}>
                  <span className="px-1.5 py-0.5 rounded bg-rust-accent text-white text-[12px] font-medium whitespace-nowrap shadow-md">{measureDist} m</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible team panel */}
        {panelOpen ? (
          <div className="absolute top-3 right-3 bottom-3 w-60 bg-rust-card/95 backdrop-blur rounded-xl border border-black/40 flex flex-col shadow-xl">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/30">
              <Users size={16} className="text-rust-accent" />
              <span className="font-medium text-sm text-gray-100">{t('map.team')}</span>
              <span className="text-xs text-gray-500">{t('map.online', { count: onlineMembers.length })}</span>
              <button onClick={() => setPanelOpen(false)} className="ml-auto p-1 rounded hover:bg-white/10 text-gray-400" title={t('map.collapse')}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {members.length === 0 && <div className="text-xs text-gray-500 p-2">{t('map.noTeam')}</div>}
              {members.map((m) => {
                const isMe = m.steamId === mySteamId
                return (
                  <button key={m.steamId} onClick={() => m.x != null && focusWorld(m.x, m.y)}
                    disabled={!m.isOnline || m.x == null}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors
                      ${m.isOnline ? 'hover:bg-white/5' : 'opacity-50'} disabled:cursor-default`}>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0`}
                      style={{ background: !m.isOnline ? '#4b5563' : m.isAlive ? (isMe ? '#cd4a22' : '#22c55e') : '#6b7280' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-100 truncate flex items-center gap-1">
                        {m.name || t('chat.unknown')}
                        {isMe && <span className="text-[10px] text-rust-accent">({t('map.you')})</span>}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {m.isOnline ? `${gridFromWorld(m.x, m.y, mapSize)} · ${m.isAlive ? t('map.alive') : t('map.dead')}` : t('map.offline')}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <button onClick={() => setPanelOpen(true)}
            className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-2 rounded-lg bg-rust-card/95 border border-black/40 text-gray-200 hover:bg-rust-card shadow-xl" title={t('map.openPanel')}>
            <ChevronLeft size={16} /> <Users size={16} />
          </button>
        )}

        {/* Interactive legend / layer toggles (left side) */}
        {legendOpen ? (
          <div className="absolute top-3 left-3 w-52 bg-rust-card/95 backdrop-blur rounded-xl border border-black/40 flex flex-col shadow-xl max-h-[calc(100%-1.5rem)]">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/30">
              <Layers size={16} className="text-rust-accent" />
              <span className="font-medium text-sm text-gray-100">{t('map.legend')}</span>
              <button onClick={() => setLegendOpen(false)} className="ml-auto p-1 rounded hover:bg-white/10 text-gray-400" title={t('map.collapse')}>
                <ChevronLeft size={16} />
              </button>
            </div>
            <div className="p-2 space-y-0.5 overflow-y-auto">
              {legendItems.map(({ key, Icon, color, label }) => {
                const on = layers[key]
                return (
                  <button key={key} onClick={() => toggleLayer(key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm hover:bg-white/5 transition-opacity ${on ? '' : 'opacity-40'}`}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border border-black/40" style={{ background: color }}>
                      <Icon size={12} color="#fff" />
                    </span>
                    <span className="flex-1 truncate text-gray-200">{label}</span>
                    {on ? <Eye size={15} className="text-gray-400" /> : <EyeOff size={15} className="text-gray-600" />}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <button onClick={() => setLegendOpen(true)}
            className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-2 rounded-lg bg-rust-card/95 border border-black/40 text-gray-200 hover:bg-rust-card shadow-xl" title={t('map.legend')}>
            <Layers size={16} /> <ChevronRight size={16} />
          </button>
        )}

        {/* Vending machine shop popup */}
        {activeShop && (
          <div onContextMenu={(e) => { e.preventDefault(); setShop(null) }}
            className="absolute top-3 left-1/2 -translate-x-1/2 w-72 max-h-[75%] bg-rust-card/95 backdrop-blur rounded-xl border border-black/40 flex flex-col shadow-xl z-10">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/30">
              <ShoppingBag size={16} className="text-sky-400 shrink-0" />
              <span className="font-medium text-sm text-gray-100 truncate flex-1">{activeShop.name || t('marker.shop')}</span>
              <span className="text-[11px] text-gray-500 shrink-0">{gridFromWorld(activeShop.x, activeShop.y, mapSize)}</span>
              <button onClick={() => setShop(null)} className="p-1 rounded hover:bg-white/10 text-gray-400 shrink-0"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {activeShop.sellOrders.map((o, i) => (
                <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/20 text-sm ${o.amountInStock === 0 ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-100 truncate">{o.quantity}× {itemName(o.itemId)}{o.itemIsBlueprint ? ` (${t('map.bp')})` : ''}</div>
                    <div className="text-[11px] text-gray-500">{t('map.stock', { count: o.amountInStock })}</div>
                  </div>
                  <div className="text-right shrink-0 max-w-[90px]">
                    <div className="text-gray-300">{o.costPerItem}×</div>
                    <div className="text-[11px] text-gray-500 truncate">{itemName(o.currencyId)}{o.currencyIsBlueprint ? ` (${t('map.bp')})` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cursor coordinate / measure readout */}
        {(hover || measureMode) && (
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-rust-card/95 border border-black/40 text-xs text-gray-200 shadow-xl pointer-events-none flex items-center gap-2">
            {hover && <span className="tabular-nums">{gridFromWorld(hover.x, hover.y, mapSize)} · {Math.round(hover.x)}, {Math.round(hover.y)}</span>}
            {measureMode && <span className="text-rust-accent">{measureDist != null ? `${measureDist} m` : t('map.measureHint')}</span>}
          </div>
        )}

        {/* Global shop index */}
        {shopIndexOpen && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[26rem] max-h-[80%] bg-rust-card/95 backdrop-blur rounded-xl border border-black/40 flex flex-col shadow-xl z-20">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/30">
              <Store size={16} className="text-rust-accent" />
              <span className="font-medium text-sm text-gray-100">{t('map.shops')}</span>
              <span className="text-xs text-gray-500">{shopOrders.length}</span>
              <button onClick={() => setShopIndexOpen(false)} className="ml-auto p-1 rounded hover:bg-white/10 text-gray-400"><X size={15} /></button>
            </div>
            <div className="p-2 border-b border-black/30">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input autoFocus value={shopQuery} onChange={(e) => setShopQuery(e.target.value)} placeholder={t('map.shopSearch')}
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-100 focus:outline-none focus:border-rust-accent" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {shopOrders.length === 0 && <div className="text-sm text-gray-500 p-3 text-center">{t('map.noShops')}</div>}
              {shopOrders.slice(0, 200).map((o, i) => (
                <button key={i} onClick={() => { const mk = markers.find((m) => m.id === o.shopId); if (mk) { focusWorld(o.x, o.y); setShop(mk); setShopIndexOpen(false) } }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm hover:bg-white/5 ${o.stock === 0 ? 'opacity-40' : ''}`}>
                  <span className="text-gray-100 flex-1 truncate">{o.quantity}× {o.item}{o.itemBp ? ` (${t('map.bp')})` : ''}</span>
                  <span className="text-gray-400 shrink-0 truncate max-w-[40%]">{o.cost}× {o.currency}{o.currencyBp ? ` (${t('map.bp')})` : ''}</span>
                  <span className="text-[11px] text-gray-500 shrink-0 w-10 text-right">{gridFromWorld(o.x, o.y, mapSize)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
