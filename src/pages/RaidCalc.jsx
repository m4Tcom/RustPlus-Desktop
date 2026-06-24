import { useMemo, useState } from 'react'
import { Bomb, Search, Plus, Minus, X, Trash2 } from 'lucide-react'
import raid from '../lib/raidcost.json'
import { useT } from '../i18n'

export default function RaidCalc() {
  const { t } = useT()
  const [catId, setCatId] = useState(raid.categories[0].id)
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([]) // [{ name, qty }]

  const cat = raid.categories.find((c) => c.id === catId) || raid.categories[0]

  // Flat name -> costs lookup across every category.
  const costsByName = useMemo(() => {
    const m = {}
    for (const c of raid.categories) for (const s of c.structures) m[s.name] = s.costs
    return m
  }, [])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cat.structures
    return cat.structures.filter((s) => s.name.toLowerCase().includes(q))
  }, [cat, query])

  const addToCart = (name) =>
    setCart((c) => {
      const i = c.findIndex((x) => x.name === name)
      if (i >= 0) { const next = [...c]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next }
      return [...c, { name, qty: 1 }]
    })
  const setQty = (name, qty) =>
    setCart((c) => c.map((x) => (x.name === name ? { ...x, qty: Math.max(1, qty) } : x)))
  const removeOne = (name) =>
    setCart((c) => {
      const i = c.findIndex((x) => x.name === name)
      if (i < 0) return c
      const q = c[i].qty - 1
      if (q <= 0) return c.filter((x) => x.name !== name)
      const next = [...c]; next[i] = { ...next[i], qty: q }; return next
    })
  const removeItem = (name) => setCart((c) => c.filter((x) => x.name !== name))
  const clearCart = () => setCart([])

  const cartQty = (name) => cart.find((x) => x.name === name)?.qty || 0

  // Sum every tool across the whole cart.
  const totals = useMemo(() => {
    const acc = {} // tool -> { qty, sulfur, hasSulfur }
    for (const { name, qty } of cart) {
      const costs = costsByName[name]
      if (!costs) continue
      for (const tn of raid.tools) {
        const c = costs[tn]
        if (!c) continue
        if (!acc[tn]) acc[tn] = { qty: 0, sulfur: 0, hasSulfur: false }
        acc[tn].qty += c.qty * qty
        if (c.sulfur != null) { acc[tn].sulfur += c.sulfur * qty; acc[tn].hasSulfur = true }
      }
    }
    return raid.tools.filter((tn) => acc[tn]).map((tn) => ({ tool: tn, ...acc[tn] }))
  }, [cart, costsByName])

  // Cheapest mix: per structure pick the tool with the lowest sulfur cost,
  // then aggregate the chosen tools into one combined shopping list.
  const cheapest = useMemo(() => {
    const rows = []
    const byTool = {} // tool -> { amount, sulfur }
    let totalSulfur = 0
    for (const { name, qty } of cart) {
      const costs = costsByName[name]
      if (!costs) continue
      let best = null
      for (const tn of raid.tools) {
        const c = costs[tn]
        if (!c || c.sulfur == null) continue
        if (!best || c.sulfur < best.sulfur) best = { tool: tn, qty: c.qty, sulfur: c.sulfur }
      }
      if (!best) continue
      const lineSulfur = best.sulfur * qty
      const lineAmount = best.qty * qty
      totalSulfur += lineSulfur
      rows.push({ name, count: qty, tool: best.tool, amount: lineAmount, sulfur: lineSulfur })
      if (!byTool[best.tool]) byTool[best.tool] = { amount: 0, sulfur: 0 }
      byTool[best.tool].amount += lineAmount
      byTool[best.tool].sulfur += lineSulfur
    }
    const shopping = raid.tools.filter((tn) => byTool[tn]).map((tn) => ({ tool: tn, ...byTool[tn] }))
    return { rows, shopping, totalSulfur }
  }, [cart, costsByName])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Bomb className="text-rust-accent" size={22} />
          <h1 className="text-2xl font-bold text-gray-100">{t('raid.title')}</h1>
        </div>
        <p className="text-gray-400 text-sm mb-5">{t('raid.subtitle')}</p>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-3">
          {raid.categories.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCatId(c.id); setQuery('') }}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
                ${catId === c.id ? 'bg-rust-accent border-rust-accent text-white' : 'bg-rust-card border-black/30 text-gray-300 hover:bg-white/5'}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search within category */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('raid.search')}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-100 focus:outline-none focus:border-rust-accent"
          />
        </div>

        {/* Structure picker — click to add to cart */}
        <div className="flex flex-wrap gap-2 mb-6 max-h-44 overflow-y-auto pr-1">
          {list.map((s) => {
            const inCart = cartQty(s.name)
            return (
              <button
                key={s.name}
                onClick={() => addToCart(s.name)}
                onContextMenu={(e) => { e.preventDefault(); removeOne(s.name) }}
                title={t('raid.addHint')}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center gap-1.5
                  ${inCart ? 'bg-rust-accent/25 border-rust-accent text-white' : 'bg-rust-card border-black/30 text-gray-300 hover:bg-white/5'}`}
              >
                {s.name}
                {inCart > 0 && <span className="text-[11px] bg-rust-accent text-white rounded-full px-1.5 leading-5">{inCart}</span>}
                <Plus size={13} className="opacity-60" />
              </button>
            )
          })}
          {list.length === 0 && (
            <span className="text-sm text-gray-500 py-1">{t('raid.noResults')}</span>
          )}
        </div>

        {/* Cart */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm uppercase tracking-wide text-gray-500">{t('raid.cart')}</h2>
          {cart.length > 0 && (
            <button onClick={clearCart} className="flex items-center gap-1 text-xs text-gray-500 hover:text-rust-accent">
              <Trash2 size={13} /> {t('raid.clear')}
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="bg-rust-card rounded-xl border border-black/30 px-4 py-6 text-center text-sm text-gray-500 mb-5">
            {t('raid.empty')}
          </div>
        ) : (
          <div className="bg-rust-card rounded-xl border border-black/30 overflow-hidden mb-5">
            {cart.map(({ name, qty }) => (
              <div key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-black/20 last:border-0">
                <span className="flex-1 text-sm text-gray-200 truncate">{name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(name, qty - 1)} className="p-1 rounded hover:bg-white/10 text-gray-400"><Minus size={14} /></button>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(name, Math.floor(Number(e.target.value) || 1))}
                    className="w-14 text-center px-1 py-1 rounded bg-rust-bg border border-black/40 text-gray-100 text-sm focus:outline-none focus:border-rust-accent"
                  />
                  <button onClick={() => setQty(name, qty + 1)} className="p-1 rounded hover:bg-white/10 text-gray-400"><Plus size={14} /></button>
                </div>
                <button onClick={() => removeItem(name)} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-rust-accent"><X size={15} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Cheapest mix suggestion */}
        {cheapest.rows.length > 0 && (
          <>
            <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-2">{t('raid.cheapest')}</h2>
            <div className="bg-rust-card rounded-xl border border-rust-accent/40 overflow-hidden mb-5">
              {/* Combined shopping list — what to actually bring */}
              <div className="px-4 py-3 border-b border-black/30">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">{t('raid.shopping')}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {cheapest.shopping.map((s, i) => (
                    <span key={s.tool} className="text-sm">
                      <span className="text-rust-accent font-semibold tabular-nums">{s.amount.toLocaleString()}×</span>
                      <span className="text-gray-200"> {s.tool}</span>
                      {i < cheapest.shopping.length - 1 && <span className="text-gray-600"> ·</span>}
                    </span>
                  ))}
                </div>
              </div>
              {/* Per-structure breakdown */}
              {cheapest.rows.map((r) => (
                <div key={r.name} className="flex items-center gap-2 px-4 py-2 text-sm border-b border-black/20">
                  <span className="text-gray-500 tabular-nums shrink-0">{r.count}×</span>
                  <span className="text-gray-400 flex-1 truncate">{r.name}</span>
                  <span className="text-gray-300 tabular-nums">{r.amount.toLocaleString()}× {r.tool}</span>
                  <span className="text-gray-600 tabular-nums text-right w-16 shrink-0">{r.sulfur.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2.5 bg-rust-accent/10 text-sm">
                <span className="text-gray-300 font-medium">{t('raid.totalSulfur')}</span>
                <span className="text-rust-accent font-bold tabular-nums">{cheapest.totalSulfur.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}

        {/* Total cost table — full raid with one single tool */}
        <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-2">{t('raid.total')}</h2>
        <div className="bg-rust-card rounded-xl border border-black/30 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs uppercase tracking-wide text-gray-500 border-b border-black/30">
            <span>{t('raid.tool')}</span>
            <span className="text-right">{t('raid.amount')}</span>
            <span className="text-right">{t('raid.sulfur')}</span>
          </div>
          {totals.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-600">—</div>
          ) : (
            totals.map(({ tool, qty, sulfur, hasSulfur }) => (
              <div key={tool} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 text-sm border-b border-black/20 last:border-0">
                <span className="text-gray-200">{tool}</span>
                <span className="text-right text-gray-100 tabular-nums font-medium">{qty.toLocaleString()}×</span>
                <span className="text-right text-gray-400 tabular-nums">{hasSulfur ? sulfur.toLocaleString() : '—'}</span>
              </div>
            ))
          )}
        </div>
        <p className="text-[11px] text-gray-600 mt-3">{t('raid.note')}</p>
      </div>
    </div>
  )
}
