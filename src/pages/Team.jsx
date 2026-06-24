import { Users, Heart, Skull, Crown, ArrowUpCircle } from 'lucide-react'
import { useRustStore } from '../store/useRustStore'
import { gridFromWorld } from '../lib/rust'
import { useT } from '../i18n'

export default function Team() {
  const { t } = useT()
  const team = useRustStore((s) => s.team)
  const serverInfo = useRustStore((s) => s.serverInfo)
  const mySteamId = useRustStore((s) => s.mySteamId)
  const mapSize = serverInfo?.mapSize || 0

  const members = team?.members || []
  const online = members.filter((m) => m.isOnline).length
  const iAmLeader = team?.leaderSteamId && mySteamId && team.leaderSteamId === mySteamId

  const promote = (steamId) => window.electron.promoteToLeader(steamId)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Users className="text-rust-accent" size={22} />
          <h1 className="text-2xl font-bold text-gray-100">{t('team.title')}</h1>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          {t('team.summary', { count: members.length, online })}
        </p>

        {members.length === 0 ? (
          <div className="text-gray-500 bg-rust-card rounded-xl p-8 text-center border border-black/30">
            {t('team.noData')}
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const isLeader = team.leaderSteamId && m.steamId === team.leaderSteamId
              return (
                <div
                  key={m.steamId}
                  className={`flex items-center gap-3 bg-rust-card rounded-lg px-4 py-3 border border-black/30 ${m.isOnline ? '' : 'opacity-50'}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${m.isOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-gray-100 font-medium truncate">
                      {m.name || t('chat.unknown')}
                      {isLeader && <Crown size={14} className="text-yellow-400 shrink-0" title={t('team.leader')} />}
                    </div>
                    <div className="text-xs text-gray-500">
                      {m.isOnline ? t('team.position', { grid: gridFromWorld(m.x, m.y, mapSize) }) : t('team.offline')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    {m.isAlive ? (
                      <><Heart size={15} className="text-red-500" /><span className="text-gray-300">{t('team.alive')}</span></>
                    ) : (
                      <><Skull size={15} className="text-gray-400" /><span className="text-gray-400">{t('team.dead')}</span></>
                    )}
                  </div>
                  {iAmLeader && !isLeader && (
                    <button
                      onClick={() => promote(m.steamId)}
                      className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-yellow-400"
                      title={t('team.promote')}
                    >
                      <ArrowUpCircle size={17} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
