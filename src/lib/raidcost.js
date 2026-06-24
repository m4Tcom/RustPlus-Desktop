// Localized display names for the raid calculator: category labels, explosive
// tools and all 148 structures. Building blocks are composed from tier × shape;
// the rest are hand-translated. Covers the main Rust languages
// (de, ru, zh-CN, zh-TW, ko); every other language falls back to the English
// name. Keyed by the English string used in raidcost.json.
import i18n from './raidcost.i18n.json'

export function raidName(name, lang = 'en') {
  if (!name) return ''
  if (lang && lang !== 'en') {
    const e = i18n[name]
    if (e && e[lang]) return e[lang]
  }
  return name
}
