// Rust item id -> display name. Source: rustplusplus staticFiles/items.json
// (trimmed to id->name). Used for vending machine sell orders and storage
// monitor contents.
import items from './items.json'

export function itemName(id) {
  if (id == null) return ''
  return items[String(id)] || `#${id}`
}
