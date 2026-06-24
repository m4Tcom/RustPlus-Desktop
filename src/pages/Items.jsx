import { useMemo, useState } from 'react'
import { Package, Search, Hammer } from 'lucide-react'
import itemsMap from '../lib/items.json'
import craft from '../lib/craftdata.json'
import { itemName } from '../lib/items'
import { useT } from '../i18n'

const ENTRIES = Object.entries(itemsMap) // [id, name]

export default function Items() {
  const { t, lang } = useT()
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    // Match the English name and the localized name, so users can search in
    // either language.
    return ENTRIES.filter(([id, name]) =>
      name.toLowerCase().includes(s) || itemName(id, lang).toLowerCase().includes(s),
    ).slice(0, 80)
  }, [q, lang])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Package className="text-rust-accent" size={22} />
          <h1 className="text-2xl font-bold text-gray-100">{t('items.title')}</h1>
        </div>
        <p className="text-gray-400 text-sm mb-4">{t('items.subtitle')}</p>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('items.search')}
            autoFocus
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-rust-bg border border-black/40 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-rust-accent"
          />
        </div>

        {!q.trim() ? (
          <div className="text-gray-600 text-sm text-center py-10">{t('items.searchHint')}</div>
        ) : results.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-10">{t('items.noResults')}</div>
        ) : (
          <div className="space-y-2">
            {results.map(([id, name]) => {
              const recipe = craft[id]
              return (
                <div key={id} className="bg-rust-card rounded-lg px-4 py-3 border border-black/30">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-100 font-medium">{itemName(id, lang)}</span>
                    <span className="text-[11px] text-gray-600">#{id}</span>
                  </div>
                  {recipe && recipe.ing.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="flex items-center gap-1 text-gray-500">
                        <Hammer size={12} /> {t('items.craft')}:
                      </span>
                      {recipe.ing.map(([ingId, qty], i) => (
                        <span key={i} className="text-gray-300">
                          {qty}× {itemName(ingId, lang)}
                        </span>
                      ))}
                      {recipe.wb ? (
                        <span className="text-rust-accent/80">· {t('items.workbench')} {recipe.wb}</span>
                      ) : (
                        <span className="text-gray-600">· {t('items.noWorkbench')}</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-600">{t('items.noCraft')}</div>
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
