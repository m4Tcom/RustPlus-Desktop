import { useEffect, useRef } from 'react'
import { useRustStore } from '../store/useRustStore'
import { useT } from '../i18n'
import { gridFromWorld } from '../lib/rust'

// Watches polled markers/team data and fires native desktop notifications on
// world events (cargo / heli / chinook spawn) and team events (death / online).
export default function EventWatcher() {
  const { t } = useT()
  const markers = useRustStore((s) => s.markers)
  const team = useRustStore((s) => s.team)
  const serverInfo = useRustStore((s) => s.serverInfo)
  const settings = useRustStore((s) => s.settings)
  const prev = useRef({ markers: null, members: null })

  const mapSize = serverInfo?.mapSize || 0
  const notify = (title, body) => window.electron?.notify(title, body)

  // World events from map markers.
  useEffect(() => {
    const s = settings || {}
    const seenBefore = prev.current.markers
    const now = new Set(markers.map((m) => `${m.type}:${m.id}`))
    if (seenBefore) {
      for (const m of markers) {
        const key = `${m.type}:${m.id}`
        if (seenBefore.has(key)) continue
        const grid = mapSize && m.x != null ? ` · ${gridFromWorld(m.x, m.y, mapSize)}` : ''
        if (m.type === 5 && s.eventCargo) notify('Rust+', t('event.cargo') + grid)
        else if (m.type === 8 && s.eventHeli) notify('Rust+', t('event.heli') + grid)
        else if (m.type === 4 && s.eventChinook) notify('Rust+', t('event.chinook') + grid)
      }
    }
    prev.current.markers = now
  }, [markers, settings, mapSize, t])

  // Team events from team info.
  useEffect(() => {
    const s = settings || {}
    const members = team?.members || []
    const before = prev.current.members
    if (before) {
      for (const m of members) {
        const old = before[m.steamId]
        if (!old) continue
        if (s.eventDeath && old.isAlive && !m.isAlive) notify('Rust+', t('event.death', { name: m.name || '?' }))
        if (s.eventOnline && !old.isOnline && m.isOnline) notify('Rust+', t('event.online', { name: m.name || '?' }))
      }
    }
    prev.current.members = Object.fromEntries(members.map((m) => [m.steamId, { isAlive: m.isAlive, isOnline: m.isOnline }]))
  }, [team, settings, t])

  return null
}
