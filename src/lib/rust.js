// Shared Rust helpers: marker metadata, grid coords, entity types, time, monuments.

// AppMarkerType (rustplus.proto)
export const MARKER = {
  0: { label: 'Unbekannt', color: '#9ca3af' },
  1: { label: 'Spieler', color: '#22c55e' },
  2: { label: 'Explosion', color: '#ef4444' },
  3: { label: 'Shop', color: '#38bdf8' },
  4: { label: 'Chinook', color: '#a855f7' },
  5: { label: 'Cargo Ship', color: '#eab308' },
  6: { label: 'Crate', color: '#f97316' },
  7: { label: 'Radius', color: '#6b7280' },
  8: { label: 'Patrol Heli', color: '#f43f5e' },
}

// AppEntityType
export const ENTITY_TYPE = {
  1: 'Smart Switch',
  2: 'Smart Alarm',
  3: 'Storage Monitor',
}

// Rust grid cell size in world units (matches the in-game map grid).
export const GRID_CELL = 146.28571428571428

/** Number of grid cells along one axis for a given map size. */
export function gridCellCount(mapSize) {
  return Math.max(1, Math.floor(mapSize / GRID_CELL))
}

/** Column index -> letter label: A..Z, AA, AB, ... */
export function colLabel(i) {
  let letters = ''
  let c = i
  do {
    letters = String.fromCharCode(65 + (c % 26)) + letters
    c = Math.floor(c / 26) - 1
  } while (c >= 0)
  return letters
}

/** World coords -> Rust grid reference (e.g. "G14"). */
export function gridFromWorld(x, y, mapSize) {
  if (!mapSize || x == null || y == null) return '—'
  const cells = gridCellCount(mapSize)
  const cell = mapSize / cells
  const col = Math.min(cells - 1, Math.max(0, Math.floor(x / cell)))
  const row = Math.min(cells - 1, Math.max(0, Math.floor((mapSize - y) / cell)))
  return `${colLabel(col)}${row}`
}

/** Rust in-game time (float hours, 0-24) -> "HH:MM". */
export function formatGameTime(t) {
  if (t == null) return '—'
  const h = Math.floor(t)
  const m = Math.floor((t - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isDaytime(time) {
  if (!time) return true
  return time.time >= (time.sunrise ?? 6) && time.time < (time.sunset ?? 18)
}

// Monument token -> name per language. Tokens are normalized (lowercase,
// alphanumeric only, "displayname" stripped) before lookup.
// Priority languages are filled with verified official/community Rust terms:
//   en  – official Rust English
//   de  – official Rust German (verified via rustplusplus de.json)
//   ru  – Russian (verified via rustplusplus ru.json, grammar normalized)
//   ko  – Korean (verified via rustplusplus ko.json)
//   zh-CN / zh-TW – Simplified / Traditional Chinese (community-standard names;
//                   Facepunch publishes no machine-readable locale file)
// Any other language falls back to the English value.
const MONUMENTS = {
  launchsite: { en: 'Launch Site', de: 'Raketenstartplatz', ru: 'Космодром', ko: '발사장', 'zh-CN': '火箭发射场', 'zh-TW': '火箭發射場' },
  militarytunnels: { en: 'Military Tunnels', de: 'Militärtunnel', ru: 'Военный тоннель', ko: '군사 터널', 'zh-CN': '军事隧道', 'zh-TW': '軍事隧道' },
  militarytunnel: { en: 'Military Tunnels', de: 'Militärtunnel', ru: 'Военный тоннель', ko: '군사 터널', 'zh-CN': '军事隧道', 'zh-TW': '軍事隧道' },
  airfield: { en: 'Airfield', de: 'Flugplatz', ru: 'Аэропорт', ko: '비행장', 'zh-CN': '机场', 'zh-TW': '機場' },
  trainyard: { en: 'Train Yard', de: 'Güterbahnhof', ru: 'Железнодорожное депо', ko: '기차 차고지', 'zh-CN': '火车场', 'zh-TW': '火車場' },
  watertreatmentplant: { en: 'Water Treatment Plant', de: 'Klärwerk', ru: 'Очистные сооружения', ko: '정수 처리장', 'zh-CN': '水处理厂', 'zh-TW': '水處理廠' },
  watertreatment: { en: 'Water Treatment Plant', de: 'Klärwerk', ru: 'Очистные сооружения', ko: '정수 처리장', 'zh-CN': '水处理厂', 'zh-TW': '水處理廠' },
  powerplant: { en: 'Power Plant', de: 'Kraftwerk', ru: 'Электростанция', ko: '발전소', 'zh-CN': '发电厂', 'zh-TW': '發電廠' },
  harbor: { en: 'Harbor', de: 'Hafen', ru: 'Порт', ko: '항구', 'zh-CN': '港口', 'zh-TW': '港口' },
  harbor1: { en: 'Harbor', de: 'Hafen', ru: 'Порт', ko: '항구', 'zh-CN': '港口', 'zh-TW': '港口' },
  harbor2: { en: 'Harbor', de: 'Hafen', ru: 'Порт', ko: '항구', 'zh-CN': '港口', 'zh-TW': '港口' },
  satellitedish: { en: 'Satellite Dish', de: 'Parabolantenne', ru: 'Спутниковая тарелка', ko: '위성 안테나', 'zh-CN': '卫星天线', 'zh-TW': '衛星天線' },
  satellite: { en: 'Satellite Dish', de: 'Parabolantenne', ru: 'Спутниковая тарелка', ko: '위성 안테나', 'zh-CN': '卫星天线', 'zh-TW': '衛星天線' },
  sphere: { en: 'The Dome', de: 'Kugeltank', ru: 'Сфера', ko: '돔', 'zh-CN': '穹顶', 'zh-TW': '穹頂' },
  spheretank: { en: 'The Dome', de: 'Kugeltank', ru: 'Сфера', ko: '돔', 'zh-CN': '穹顶', 'zh-TW': '穹頂' },
  dome: { en: 'The Dome', de: 'Kugeltank', ru: 'Сфера', ko: '돔', 'zh-CN': '穹顶', 'zh-TW': '穹頂' },
  junkyard: { en: 'Junkyard', de: 'Schrottplatz', ru: 'Свалка', ko: '폐차장', 'zh-CN': '垃圾场', 'zh-TW': '垃圾場' },
  gasstation: { en: 'Oxum\'s Gas Station', de: "Oxum's Tankstelle", ru: 'Заправка', ko: '오슘 주유소', 'zh-CN': '加油站', 'zh-TW': '加油站' },
  supermarket: { en: 'Abandoned Supermarket', de: 'Verlassener Supermarkt', ru: 'Заброшенный супермаркет', ko: '버려진 슈퍼마켓', 'zh-CN': '废弃超市', 'zh-TW': '廢棄超市' },
  miningoutpost: { en: 'Mining Outpost', de: 'Bergbau-Außenposten', ru: 'Склад', ko: '광산 전초 기지', 'zh-CN': '采矿前哨', 'zh-TW': '採礦前哨' },
  miningquarrystone: { en: 'Stone Quarry', de: 'Steinbruch', ru: 'Каменный карьер', ko: '돌 채석장', 'zh-CN': '石头采石场', 'zh-TW': '石頭採石場' },
  stonequarry: { en: 'Stone Quarry', de: 'Steinbruch', ru: 'Каменный карьер', ko: '돌 채석장', 'zh-CN': '石头采石场', 'zh-TW': '石頭採石場' },
  miningquarrysulfur: { en: 'Sulfur Quarry', de: 'Schwefel-Steinbruch', ru: 'Серный карьер', ko: '유황 채석장', 'zh-CN': '硫磺采石场', 'zh-TW': '硫磺採石場' },
  sulfurquarry: { en: 'Sulfur Quarry', de: 'Schwefel-Steinbruch', ru: 'Серный карьер', ko: '유황 채석장', 'zh-CN': '硫磺采石场', 'zh-TW': '硫磺採石場' },
  miningquarryhqm: { en: 'HQM Quarry', de: 'HQM-Steinbruch', ru: 'МВК карьер', ko: '고품질 금속 채석장', 'zh-CN': '高质量金属采石场', 'zh-TW': '高質量金屬採石場' },
  outpost: { en: 'Outpost', de: 'Außenposten', ru: 'Аванпост', ko: '전초기지', 'zh-CN': '前哨站', 'zh-TW': '前哨站' },
  compound: { en: 'Outpost', de: 'Außenposten', ru: 'Аванпост', ko: '전초기지', 'zh-CN': '前哨站', 'zh-TW': '前哨站' },
  banditcamp: { en: 'Bandit Camp', de: 'Banditenlager', ru: 'Лагерь бандитов', ko: '밴딧 캠프', 'zh-CN': '强盗营地', 'zh-TW': '強盜營地' },
  bandit: { en: 'Bandit Camp', de: 'Banditenlager', ru: 'Лагерь бандитов', ko: '밴딧 캠프', 'zh-CN': '强盗营地', 'zh-TW': '強盜營地' },
  fishingvillage: { en: 'Fishing Village', de: 'Fischerdorf', ru: 'Рыбацкая деревня', ko: '어촌', 'zh-CN': '渔村', 'zh-TW': '漁村' },
  largefishingvillage: { en: 'Large Fishing Village', de: 'Großes Fischerdorf', ru: 'Большая рыбацкая деревня', ko: '대형 어촌', 'zh-CN': '大型渔村', 'zh-TW': '大型漁村' },
  excavator: { en: 'Giant Excavator Pit', de: 'Riesige Baggergrube', ru: 'Гигантский экскаватор', ko: '거대 굴착기', 'zh-CN': '巨型挖掘机坑', 'zh-TW': '巨型挖掘機坑' },
  giantexcavatorpit: { en: 'Giant Excavator Pit', de: 'Riesige Baggergrube', ru: 'Гигантский экскаватор', ko: '거대 굴착기', 'zh-CN': '巨型挖掘机坑', 'zh-TW': '巨型挖掘機坑' },
  radtown: { en: 'Radtown', de: 'Radtown', ru: 'Рэдтаун', ko: '라드타운', 'zh-CN': '辐射镇', 'zh-TW': '輻射鎮' },
  arcticresearchbase: { en: 'Arctic Research Base', de: 'Arktische Forschungsbasis', ru: 'Арктическая научная станция', ko: '북극 연구 기지', 'zh-CN': '北极研究基地', 'zh-TW': '北極研究基地' },
  ferryterminal: { en: 'Ferry Terminal', de: 'Fährterminal', ru: 'Паромный терминал', ko: '여객선 터미널', 'zh-CN': '渡轮码头', 'zh-TW': '渡輪碼頭' },
  lighthouse: { en: 'Lighthouse', de: 'Leuchtturm', ru: 'Маяк', ko: '등대', 'zh-CN': '灯塔', 'zh-TW': '燈塔' },
  oilrig: { en: 'Oil Rig', de: 'Ölbohrinsel', ru: 'Нефтяная вышка', ko: '석유 굴착지', 'zh-CN': '石油钻井平台', 'zh-TW': '石油鑽井平台' },
  largeoilrig: { en: 'Large Oil Rig', de: 'Große Ölbohrinsel', ru: 'Большая нефтяная вышка', ko: '대형 석유 굴착지', 'zh-CN': '大型石油钻井平台', 'zh-TW': '大型石油鑽井平台' },
  sewerbranch: { en: 'Sewer Branch', de: 'Kanalisationszweig', ru: 'Канализационный отвод', ko: '하수 분기점', 'zh-CN': '下水道支管', 'zh-TW': '下水道支管' },
  sewer: { en: 'Sewer Branch', de: 'Kanalisationszweig', ru: 'Канализационный отвод', ko: '하수 분기점', 'zh-CN': '下水道支管', 'zh-TW': '下水道支管' },
  missilesilo: { en: 'Missile Silo', de: 'Raketensilo', ru: 'Ракетная пусковая шахта', ko: '미사일 격납고', 'zh-CN': '导弹发射井', 'zh-TW': '導彈發射井' },
  swamp: { en: 'Swamp', de: 'Sumpf', ru: 'Болото', ko: '늪', 'zh-CN': '沼泽', 'zh-TW': '沼澤' },
  cave: { en: 'Cave', de: 'Höhle', ru: 'Пещера', ko: '동굴', 'zh-CN': '洞穴', 'zh-TW': '洞穴' },
  undergroundtunnels: { en: 'Underground Tunnels', de: 'Tunnelsystem', ru: 'Подземные тоннели', ko: '지하 터널', 'zh-CN': '地下隧道', 'zh-TW': '地下隧道' },
  underwaterlab: { en: 'Underwater Lab', de: 'Unterwasserlabor', ru: 'Подводная лаборатория', ko: '해저 실험실', 'zh-CN': '水下实验室', 'zh-TW': '水下實驗室' },
  traintunnel: { en: 'Train Tunnel', de: 'Zugtunnel', ru: 'Железнодорожный тоннель', ko: '기차 터널', 'zh-CN': '火车隧道', 'zh-TW': '火車隧道' },
}

export function monumentName(token, lang = 'en') {
  if (!token) return ''
  const lower = token.toLowerCase()
  const norm = lower.replace(/displayname/g, '').replace(/[^a-z0-9]/g, '')
  const entry = MONUMENTS[norm]
  if (entry) return entry[lang] || entry.en

  // Some tokens arrive as full prefab asset paths (e.g. underwater lab modules,
  // train tunnels). Match by keyword so we never render a raw path.
  const byKey = (key) => MONUMENTS[key][lang] || MONUMENTS[key].en
  // Match on the normalized token (no spaces/underscores) so every spelling
  // variant collapses to the same name. Underwater lab building blocks come
  // through as suffixed prefabs ("underwater_lab_a", "Module 900x900 Moonpool"),
  // which must all resolve to a single "Underwater Lab".
  if (
    norm.includes('underwaterlab') ||
    norm.includes('moonpool') ||
    norm.includes('module') ||
    /\d+x\d+/.test(norm)
  ) return byKey('underwaterlab')
  if (norm.includes('train') && norm.includes('tunnel')) return byKey('traintunnel')
  if (norm.includes('cave')) return byKey('cave')

  // Fallback: prettify – strip any asset path, ".prefab" and size/module noise.
  let raw = token
  if (raw.includes('/')) raw = raw.split('/').pop()
  raw = raw.replace(/\.prefab$/i, '')
  return raw
    .replace(/_?display_?name/gi, '')
    .replace(/\b\d+x\d+\b/g, '') // e.g. "900x900"
    .replace(/\bmodule\b/gi, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Tokens that aren't real monuments (spawn/cave markers we usually hide).
export function isLabelMonument(token) {
  if (!token) return false
  const norm = token.toLowerCase()
  return !norm.includes('cave') && !norm.includes('swamp') && !norm.includes('standalone')
}
