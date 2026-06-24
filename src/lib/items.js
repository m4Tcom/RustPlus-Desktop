// Rust item id -> display name. Source: rustplusplus staticFiles/items.json
// (trimmed to id->name, English). Used for vending machine sell orders and
// storage monitor contents.
import items from './items.json'
// Localized names for the core gameplay items (resources, ammo, weapons,
// explosives, tools, medical, key build/deployables) in the most-played Rust
// languages. The long tail of items (mostly skins/cosmetics) stays English by
// design — Facepunch publishes no machine-readable item locale file, and the
// community uses English item names universally. id -> { lang: name }.
import itemsI18n from './items.i18n.json'

// Regional variants fall back to their base language for item names.
const LANG_ALIAS = { 'es-419': 'es', 'pt-PT': 'pt-BR' }

export function itemName(id, lang = 'en') {
  if (id == null) return ''
  const key = String(id)
  if (lang && lang !== 'en') {
    const loc = itemsI18n[key]
    if (loc) {
      const l = loc[lang] || loc[LANG_ALIAS[lang]]
      if (l) return l
    }
  }
  return items[key] || `#${id}`
}
