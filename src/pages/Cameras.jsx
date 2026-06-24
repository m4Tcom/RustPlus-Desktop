import { useCallback, useEffect, useRef, useState } from 'react'
import { Video, Plus, Trash2, X, Loader2, ZoomIn, Crosshair, RotateCw, AlertCircle } from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'

// Camera input button bitmask (mirrors @liamcottle/rustplus.js Camera.Buttons).
const BTN = { FORWARD: 2, BACKWARD: 4, LEFT: 8, RIGHT: 16, JUMP: 32, DUCK: 64, SPRINT: 128 }
// Camera control flags (mirrors Camera.ControlFlags).
const FLAG = { MOVEMENT: 1, MOUSE: 2, FIRE: 8, RELOAD: 16, CROSSHAIR: 32 }
const KEYMAP = {
  KeyW: BTN.FORWARD, KeyS: BTN.BACKWARD, KeyA: BTN.LEFT, KeyD: BTN.RIGHT,
  Space: BTN.JUMP, ShiftLeft: BTN.SPRINT, ControlLeft: BTN.DUCK,
}

export default function Cameras() {
  const { t } = useT()
  const cameras = useRustStore((s) => s.cameras)
  const setCameras = useRustStore((s) => s.setCameras)
  const connected = useRustStore((s) => s.status === 'connected')

  const [active, setActive] = useState(null) // identifier currently subscribed
  const [info, setInfo] = useState(null) // AppCameraInfo
  const [frame, setFrame] = useState(null) // data URL of latest frame
  const [subscribing, setSubscribing] = useState(false)
  const [error, setError] = useState(null)
  const [newId, setNewId] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const buttonsRef = useRef(0)
  const mouseRef = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const activeRef = useRef(null)
  activeRef.current = active

  const canMove = (info?.controlFlags & FLAG.MOVEMENT) === FLAG.MOVEMENT
  const canMouse = (info?.controlFlags & FLAG.MOUSE) === FLAG.MOUSE

  // Incoming rendered frames (only keep the active camera's).
  useEffect(() => {
    return window.electron.onCameraFrame(({ identifier, png }) => {
      if (identifier === activeRef.current) setFrame('data:image/png;base64,' + png)
    })
  }, [])

  // Send accumulated input ~12x/sec while a camera is active.
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      const buttons = buttonsRef.current
      const md = mouseRef.current
      if (buttons !== 0 || md.x !== 0 || md.y !== 0) {
        window.electron.cameraInput(active, buttons, md.x, md.y)
        mouseRef.current = { x: 0, y: 0 }
      }
    }, 85)
    return () => clearInterval(id)
  }, [active])

  // Keyboard movement (WASD / Space / Shift / Ctrl) for movable cameras.
  useEffect(() => {
    if (!active || !canMove) return
    const down = (e) => {
      const b = KEYMAP[e.code]
      if (b) { buttonsRef.current |= b; e.preventDefault() }
    }
    const up = (e) => {
      const b = KEYMAP[e.code]
      if (b) buttonsRef.current &= ~b
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      buttonsRef.current = 0
    }
  }, [active, canMove])

  const subscribe = useCallback(async (identifier) => {
    const prev = activeRef.current
    if (prev && prev !== identifier) await window.electron.cameraUnsubscribe(prev)
    setError(null)
    setFrame(null)
    setInfo(null)
    setSubscribing(true)
    setActive(identifier)
    const res = await window.electron.cameraSubscribe(identifier)
    setSubscribing(false)
    if (res?.ok) {
      setInfo(res.info)
    } else {
      setError(res?.error || 'Fehler')
      setActive(null)
    }
  }, [])

  const close = useCallback(async () => {
    const id = activeRef.current
    if (id) await window.electron.cameraUnsubscribe(id)
    setActive(null)
    setInfo(null)
    setFrame(null)
    setError(null)
  }, [])

  // Clean up on unmount (leaving the page releases the camera for others).
  useEffect(() => () => {
    if (activeRef.current) window.electron.cameraUnsubscribe(activeRef.current)
  }, [])

  const add = async (e) => {
    e.preventDefault()
    const id = newId.trim()
    if (!id) return
    const list = await window.electron.addCamera(id, newLabel.trim())
    setCameras(list)
    setNewId('')
    setNewLabel('')
  }

  const remove = async (identifier) => {
    if (identifier === activeRef.current) await close()
    const list = await window.electron.removeCamera(identifier)
    setCameras(list)
  }

  const onMouseDown = () => { dragging.current = true }
  const onMouseUp = () => { dragging.current = false }
  const onMouseLeave = () => { dragging.current = false }
  const onMouseMove = (e) => {
    if (!dragging.current || !canMouse) return
    mouseRef.current.x += e.movementX
    mouseRef.current.y += e.movementY
  }

  const action = (a) => window.electron.cameraAction(active, a)

  return (
    <div className="h-full flex">
      {/* Camera list / add */}
      <div className="w-72 shrink-0 border-r border-black/40 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/40">
          <Video className="text-rust-accent" size={20} />
          <h1 className="text-lg font-bold text-gray-100">{t('cameras.title')}</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {cameras.length === 0 ? (
            <p className="text-gray-500 text-sm leading-relaxed px-1 py-2">{t('cameras.empty')}</p>
          ) : (
            cameras.map((c) => (
              <div
                key={c.identifier}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 border cursor-pointer transition-colors
                  ${active === c.identifier ? 'bg-rust-accent/20 border-rust-accent/60' : 'bg-rust-card border-black/30 hover:bg-white/5'}`}
                onClick={() => connected && subscribe(c.identifier)}
              >
                <Video size={16} className={active === c.identifier ? 'text-rust-accent' : 'text-gray-400'} />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-100 text-sm font-medium truncate">{c.label}</div>
                  <div className="text-[11px] text-gray-500 truncate">{c.identifier}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(c.identifier) }}
                  className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                  title={t('cameras.remove')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={add} className="p-3 border-t border-black/40 space-y-2 bg-rust-card/40">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder={t('cameras.phId')}
            className="w-full px-3 py-2 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-100
                       placeholder-gray-600 focus:outline-none focus:border-rust-accent"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t('cameras.phLabel')}
            className="w-full px-3 py-2 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-100
                       placeholder-gray-600 focus:outline-none focus:border-rust-accent"
          />
          <button
            type="submit"
            disabled={!newId.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rust-accent
                       hover:bg-[#b8401d] text-white text-sm font-medium disabled:opacity-40"
          >
            <Plus size={15} /> {t('cameras.add')}
          </button>
          <p className="text-[11px] text-gray-600 leading-snug">{t('cameras.hint')}</p>
        </form>
      </div>

      {/* Viewer */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-6 bg-black/20">
        {!active ? (
          <div className="text-center text-gray-600">
            <Video size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{connected ? t('cameras.selectHint') : t('cameras.notConnected')}</p>
          </div>
        ) : (
          <div className="w-full max-w-3xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-gray-200">
                <Video size={16} className="text-rust-accent" />
                <span className="font-medium">{cameras.find((c) => c.identifier === active)?.label || active}</span>
                {info?.isAutoTurret && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">{t('cameras.turret')}</span>
                )}
              </div>
              <button onClick={close} className="p-1.5 rounded hover:bg-white/10 text-gray-400" title={t('cameras.close')}>
                <X size={18} />
              </button>
            </div>

            <div
              className="relative rounded-xl overflow-hidden border border-black/50 bg-black aspect-video flex items-center justify-center select-none"
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              onMouseMove={onMouseMove}
              style={{ cursor: canMouse ? 'move' : 'default' }}
            >
              {frame ? (
                <img src={frame} alt="camera" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="text-gray-500 flex flex-col items-center gap-2">
                  {error ? (
                    <>
                      <AlertCircle size={28} className="text-red-400" />
                      <span className="text-sm text-red-300">{error}</span>
                    </>
                  ) : (
                    <>
                      <Loader2 size={28} className="animate-spin" />
                      <span className="text-sm">{subscribing ? t('cameras.connecting') : t('cameras.waiting')}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={() => action('zoom')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rust-card border border-black/30 text-sm text-gray-200 hover:bg-white/5">
                <ZoomIn size={15} /> {t('cameras.zoom')}
              </button>
              {info?.isAutoTurret && (
                <>
                  <button onClick={() => action('shoot')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-sm text-white">
                    <Crosshair size={15} /> {t('cameras.shoot')}
                  </button>
                  <button onClick={() => action('reload')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rust-card border border-black/30 text-sm text-gray-200 hover:bg-white/5">
                    <RotateCw size={15} /> {t('cameras.reload')}
                  </button>
                </>
              )}
              {canMove && <span className="text-[11px] text-gray-500 ml-1">{t('cameras.controlsHint')}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
