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
const MONUMENTS =  {
  launchsite: { en: "Launch Site", de: "Raketenstartplatz", fr: "Site de lancement", it: "Sito di lancio", es: "Estación de Lanzamiento de Misiles", 'es-419': "Estación de Lanzamiento de Misiles", 'pt-BR': "Sitio de Lançamento", 'pt-PT': "Sitio de Lançamento", ru: "Космодром", uk: "Космодром", pl: "Launch Site", tr: "Fırlatma Üssü", nl: "Lanceerplatform", cs: "Launch Site", da: "Affyringsrampe", fi: "Laukaisualusta", sv: "Uppskjutningsplatsen", nb: "Utskytingsrampe", el: "Σημείο Εκτόξευσης", ja: "発射場", ko: "발사장", 'zh-CN': "火箭发射场", 'zh-TW': "火箭發射場", vi: "Bãi Phóng", ar: "موقع الإطلاق" },
  militarytunnels: { en: "Military Tunnels", de: "Militärtunnel", fr: "Tunnel militaire", it: "Tunnel Militare", es: "Túnel Militar", 'es-419': "Túnel Militar", 'pt-BR': "Túnel Militar", 'pt-PT': "Túnel Militar", ru: "Военный тоннель", uk: "Військові тунелі", pl: "Military Tunnel", tr: "Askeri Tünel", nl: "Militaire Tunnels", cs: "Military Tunnel", da: "Militærtunneler", fi: "Sotilastunnelit", sv: "Militära Tunnlar", nb: "Militærtunneler", el: "Στρατιωτικές Σήραγγες", ja: "軍事トンネル", ko: "군사 터널", 'zh-CN': "军事隧道", 'zh-TW': "軍事隧道", vi: "Đường Hầm Quân Sự", ar: "الأنفاق العسكرية" },
  militarytunnel: { en: "Military Tunnels", de: "Militärtunnel", fr: "Tunnel militaire", it: "Tunnel Militare", es: "Túnel Militar", 'es-419': "Túnel Militar", 'pt-BR': "Túnel Militar", 'pt-PT': "Túnel Militar", ru: "Военный тоннель", uk: "Військові тунелі", pl: "Military Tunnel", tr: "Askeri Tünel", nl: "Militaire Tunnels", cs: "Military Tunnel", da: "Militærtunneler", fi: "Sotilastunnelit", sv: "Militära Tunnlar", nb: "Militærtunneler", el: "Στρατιωτικές Σήραγγες", ja: "軍事トンネル", ko: "군사 터널", 'zh-CN': "军事隧道", 'zh-TW': "軍事隧道", vi: "Đường Hầm Quân Sự", ar: "الأنفاق العسكرية" },
  airfield: { en: "Airfield", de: "Flugplatz", fr: "Aérodrome", it: "Campo d'Aviazione", es: "Aeródromo", 'es-419': "Aeródromo", 'pt-BR': "Aeródromo", 'pt-PT': "Aeródromo", ru: "Аэропорт", uk: "Аеродром", pl: "Lotnisko", tr: "Havaalanı", nl: "Vliegveld", cs: "Letiště", da: "Flyveplads", fi: "Lentokenttä", sv: "Flygfält", nb: "Flyplass", el: "Αεροδρόμιο", ja: "飛行場", ko: "비행장", 'zh-CN': "机场", 'zh-TW': "機場", vi: "Sân Bay", ar: "المطار" },
  trainyard: { en: "Train Yard", de: "Güterbahnhof", fr: "Gare de Triage", it: "Cantiere dei Treni", es: "Patio ferroviario", 'es-419': "Patio ferroviario", 'pt-BR': "Estação de Comboios", 'pt-PT': "Estação de Comboios", ru: "Железнодорожное депо", uk: "Залізничне депо", pl: "Zajezdnia kolejowa", tr: "Tren İstasyonu", nl: "Rangeerterrein", cs: "Nádraží", da: "Banegård", fi: "Ratapiha", sv: "Tåggård", nb: "Jernbaneområde", el: "Σιδηροδρομικός Σταθμός", ja: "操車場", ko: "기차 차고지", 'zh-CN': "火车场", 'zh-TW': "火車場", vi: "Ga Tàu", ar: "محطة القطارات" },
  watertreatmentplant: { en: "Water Treatment Plant", de: "Klärwerk", fr: "Station d'épuration", it: "Impianto di Trattamento dell'Acqua", es: "Planta potabilizadora", 'es-419': "Planta potabilizadora", 'pt-BR': "Estação de Tratamento de Água", 'pt-PT': "Estação de Tratamento de Água", ru: "Очистные сооружения", uk: "Очисні споруди", pl: "Water Treatment Plant", tr: "Su Arıtma Tesisi", nl: "Waterzuiveringsinstallatie", cs: "Čistička odpadních vod", da: "Vandrensningsanlæg", fi: "Vedenpuhdistamo", sv: "Vattenreningsverk", nb: "Vannrenseanlegg", el: "Εγκατάσταση Επεξεργασίας Νερού", ja: "水処理場", ko: "정수 처리장", 'zh-CN': "水处理厂", 'zh-TW': "水處理廠", vi: "Nhà Máy Xử Lý Nước", ar: "محطة معالجة المياه" },
  watertreatment: { en: "Water Treatment Plant", de: "Klärwerk", fr: "Station d'épuration", it: "Impianto di Trattamento dell'Acqua", es: "Planta potabilizadora", 'es-419': "Planta potabilizadora", 'pt-BR': "Estação de Tratamento de Água", 'pt-PT': "Estação de Tratamento de Água", ru: "Очистные сооружения", uk: "Очисні споруди", pl: "Water Treatment Plant", tr: "Su Arıtma Tesisi", nl: "Waterzuiveringsinstallatie", cs: "Čistička odpadních vod", da: "Vandrensningsanlæg", fi: "Vedenpuhdistamo", sv: "Vattenreningsverk", nb: "Vannrenseanlegg", el: "Εγκατάσταση Επεξεργασίας Νερού", ja: "水処理場", ko: "정수 처리장", 'zh-CN': "水处理厂", 'zh-TW': "水處理廠", vi: "Nhà Máy Xử Lý Nước", ar: "محطة معالجة المياه" },
  powerplant: { en: "Power Plant", de: "Kraftwerk", fr: "Centrale électrique", it: "Centrale Elettrica", es: "Central Nuclear", 'es-419': "Central Nuclear", 'pt-BR': "Central Elétrica", 'pt-PT': "Central Elétrica", ru: "Электростанция", uk: "Електростанція", pl: "Power Plant", tr: "Nükleer Santral", nl: "Energiecentrale", cs: "Power Plant", da: "Kraftværk", fi: "Voimalaitos", sv: "Kraftverk", nb: "Kraftverk", el: "Εργοστάσιο Ενέργειας", ja: "発電所", ko: "발전소", 'zh-CN': "发电厂", 'zh-TW': "發電廠", vi: "Nhà Máy Điện", ar: "محطة الطاقة" },
  harbor: { en: "Harbor", de: "Hafen", fr: "Port", it: "Porto", es: "Puerto", 'es-419': "Puerto", 'pt-BR': "Cais", 'pt-PT': "Cais", ru: "Порт", uk: "Порт", pl: "Port", tr: "Liman", nl: "Haven", cs: "Harbor", da: "Havn", fi: "Satama", sv: "Hamnen", nb: "Havn", el: "Λιμάνι", ja: "港", ko: "항구", 'zh-CN': "港口", 'zh-TW': "港口", vi: "Cảng", ar: "الميناء" },
  harbor1: { en: "Harbor", de: "Hafen", fr: "Port", it: "Porto", es: "Puerto", 'es-419': "Puerto", 'pt-BR': "Cais", 'pt-PT': "Cais", ru: "Порт", uk: "Порт", pl: "Port", tr: "Liman", nl: "Haven", cs: "Harbor", da: "Havn", fi: "Satama", sv: "Hamnen", nb: "Havn", el: "Λιμάνι", ja: "港", ko: "항구", 'zh-CN': "港口", 'zh-TW': "港口", vi: "Cảng", ar: "الميناء" },
  harbor2: { en: "Harbor", de: "Hafen", fr: "Port", it: "Porto", es: "Puerto", 'es-419': "Puerto", 'pt-BR': "Cais", 'pt-PT': "Cais", ru: "Порт", uk: "Порт", pl: "Port", tr: "Liman", nl: "Haven", cs: "Harbor", da: "Havn", fi: "Satama", sv: "Hamnen", nb: "Havn", el: "Λιμάνι", ja: "港", ko: "항구", 'zh-CN': "港口", 'zh-TW': "港口", vi: "Cảng", ar: "الميناء" },
  satellitedish: { en: "Satellite Dish", de: "Parabolantenne", fr: "Antenne parabolique", it: "Parabola Satellitare", es: "Antena parabólica", 'es-419': "Antena parabólica", 'pt-BR': "Antena Parabólica", 'pt-PT': "Antena Parabólica", ru: "Спутниковая тарелка", uk: "Супутникова антена", pl: "Satellite Dish", tr: "Uydu", nl: "Satellietschotel", cs: "Satellite Dish", da: "Parabolantenne", fi: "Satelliittiantenni", sv: "Parabolantenn", nb: "Parabolantenne", el: "Δορυφορικό Πιάτο", ja: "衛星アンテナ", ko: "위성 안테나", 'zh-CN': "卫星天线", 'zh-TW': "衛星天線", vi: "Chảo Vệ Tinh", ar: "الطبق الفضائي" },
  satellite: { en: "Satellite Dish", de: "Parabolantenne", fr: "Antenne parabolique", it: "Parabola Satellitare", es: "Antena parabólica", 'es-419': "Antena parabólica", 'pt-BR': "Antena Parabólica", 'pt-PT': "Antena Parabólica", ru: "Спутниковая тарелка", uk: "Супутникова антена", pl: "Satellite Dish", tr: "Uydu", nl: "Satellietschotel", cs: "Satellite Dish", da: "Parabolantenne", fi: "Satelliittiantenni", sv: "Parabolantenn", nb: "Parabolantenne", el: "Δορυφορικό Πιάτο", ja: "衛星アンテナ", ko: "위성 안테나", 'zh-CN': "卫星天线", 'zh-TW': "衛星天線", vi: "Chảo Vệ Tinh", ar: "الطبق الفضائي" },
  sphere: { en: "The Dome", de: "Kugeltank", fr: "Le Dôme", it: "La Cupola", es: "La Cúpula", 'es-419': "La Cúpula", 'pt-BR': "A Cúpula", 'pt-PT': "A Cúpula", ru: "Сфера", uk: "Купол", pl: "The Dome", tr: "Küre", nl: "De Koepel", cs: "The Dome", da: "Kuplen", fi: "Kupoli", sv: "Kupolen", nb: "Kuppelen", el: "Ο Θόλος", ja: "ドーム", ko: "돔", 'zh-CN': "穹顶", 'zh-TW': "穹頂", vi: "Mái Vòm", ar: "القبة" },
  spheretank: { en: "The Dome", de: "Kugeltank", fr: "Le Dôme", it: "La Cupola", es: "La Cúpula", 'es-419': "La Cúpula", 'pt-BR': "A Cúpula", 'pt-PT': "A Cúpula", ru: "Сфера", uk: "Купол", pl: "The Dome", tr: "Küre", nl: "De Koepel", cs: "The Dome", da: "Kuplen", fi: "Kupoli", sv: "Kupolen", nb: "Kuppelen", el: "Ο Θόλος", ja: "ドーム", ko: "돔", 'zh-CN': "穹顶", 'zh-TW': "穹頂", vi: "Mái Vòm", ar: "القبة" },
  dome: { en: "The Dome", de: "Kugeltank", fr: "Le Dôme", it: "La Cupola", es: "La Cúpula", 'es-419': "La Cúpula", 'pt-BR': "A Cúpula", 'pt-PT': "A Cúpula", ru: "Сфера", uk: "Купол", pl: "The Dome", tr: "Küre", nl: "De Koepel", cs: "The Dome", da: "Kuplen", fi: "Kupoli", sv: "Kupolen", nb: "Kuppelen", el: "Ο Θόλος", ja: "ドーム", ko: "돔", 'zh-CN': "穹顶", 'zh-TW': "穹頂", vi: "Mái Vòm", ar: "القبة" },
  junkyard: { en: "Junkyard", de: "Schrottplatz", fr: "Décharge", it: "Discarica", es: "Vertedero", 'es-419': "Vertedero", 'pt-BR': "Ferro-velho", 'pt-PT': "Ferro-velho", ru: "Свалка", uk: "Звалище", pl: "Junkyard", tr: "Hurdalık", nl: "Schroothoop", cs: "Junkyard", da: "Skrotplads", fi: "Romuttamo", sv: "Skrotupplag", nb: "Skraphaug", el: "Μάντρα Παλιοσιδερικών", ja: "廃品置き場", ko: "폐차장", 'zh-CN': "垃圾场", 'zh-TW': "垃圾場", vi: "Bãi Phế Liệu", ar: "مكب الخردة" },
  gasstation: { en: "Oxum's Gas Station", de: "Oxum's Tankstelle", fr: "Station-service D'Oxum", it: "Stazione Gas di Oxum", es: "Gasolinera Oxum", 'es-419': "Gasolinera Oxum", 'pt-BR': "Posto de Gasolina Oxum", 'pt-PT': "Posto de Gasolina Oxum", ru: "Заправка", uk: "Заправка Oxum", pl: "Oxum's Gas Station", tr: "Oxum Gaz İstasyonu", nl: "Oxum's Tankstation", cs: "Oxum's Gas Station", da: "Oxums Tankstation", fi: "Oxumin huoltoasema", sv: "Oxums bensinstation", nb: "Oxums Bensinstasjon", el: "Βενζινάδικο Oxum", ja: "オクサムのガソリンスタンド", ko: "오슘 주유소", 'zh-CN': "加油站", 'zh-TW': "加油站", vi: "Trạm Xăng Oxum", ar: "محطة وقود أوكسوم" },
  supermarket: { en: "Abandoned Supermarket", de: "Verlassener Supermarkt", fr: "Supermarché Abandonné", it: "Supermercato Abbandonato", es: "Supermercado abandonado", 'es-419': "Supermercado abandonado", 'pt-BR': "Supermercado Abandonado", 'pt-PT': "Supermercado Abandonado", ru: "Заброшенный супермаркет", uk: "Покинутий супермаркет", pl: "Opuszczony supermarket", tr: "Süpermarket", nl: "Verlaten Supermarkt", cs: "Opuštěný supermarket", da: "Forladt Supermarked", fi: "Hylätty supermarket", sv: "Övergiven Stormarknad", nb: "Forlatt Supermarked", el: "Εγκαταλελειμμένο Σούπερ Μάρκετ", ja: "廃墟スーパー", ko: "버려진 슈퍼마켓", 'zh-CN': "废弃超市", 'zh-TW': "廢棄超市", vi: "Siêu Thị Bỏ Hoang", ar: "السوبر ماركت المهجور" },
  miningoutpost: { en: "Mining Outpost", de: "Bergbau-Außenposten", fr: "Exploitation Minier", it: "Avamposto Minerario", es: "Puesto Minero", 'es-419': "Puesto Minero", 'pt-BR': "Posto de Mineração", 'pt-PT': "Posto de Mineração", ru: "Склад", uk: "Гірничий пост", pl: "Mining Outpost", tr: "Madencilik", nl: "Mijnbouwpost", cs: "Mining Outpost", da: "Mineudpost", fi: "Kaivosasema", sv: "Gruvutpost", nb: "Gruveutpost", el: "Μεταλλευτικός Σταθμός", ja: "採掘前哨基地", ko: "광산 전초 기지", 'zh-CN': "采矿前哨", 'zh-TW': "採礦前哨", vi: "Tiền Đồn Khai Thác", ar: "مخفر التعدين" },
  miningquarrystone: { en: "Stone Quarry", de: "Steinbruch", fr: "Carrière de pierre", it: "Cava di pietra", es: "Cantera de Piedra", 'es-419': "Cantera de Piedra", 'pt-BR': "Pedreira", 'pt-PT': "Pedreira", ru: "Каменный карьер", uk: "Кам'яний кар'єр", pl: "Stone Quarry", tr: "Taş Madeni", nl: "Steengroeve", cs: "Stone Quarry", da: "Stenbrud", fi: "Kivilouhos", sv: "Stenbrott", nb: "Steinbrudd", el: "Λατομείο Πέτρας", ja: "石の採石場", ko: "돌 채석장", 'zh-CN': "石头采石场", 'zh-TW': "石頭採石場", vi: "Mỏ Đá", ar: "محجر الحجارة" },
  stonequarry: { en: "Stone Quarry", de: "Steinbruch", fr: "Carrière de pierre", it: "Cava di pietra", es: "Cantera de Piedra", 'es-419': "Cantera de Piedra", 'pt-BR': "Pedreira", 'pt-PT': "Pedreira", ru: "Каменный карьер", uk: "Кам'яний кар'єр", pl: "Stone Quarry", tr: "Taş Madeni", nl: "Steengroeve", cs: "Stone Quarry", da: "Stenbrud", fi: "Kivilouhos", sv: "Stenbrott", nb: "Steinbrudd", el: "Λατομείο Πέτρας", ja: "石の採石場", ko: "돌 채석장", 'zh-CN': "石头采石场", 'zh-TW': "石頭採石場", vi: "Mỏ Đá", ar: "محجر الحجارة" },
  miningquarrysulfur: { en: "Sulfur Quarry", de: "Schwefel-Steinbruch", fr: "Carrière de Sulfure", it: "Cava di Zolfo", es: "Cantera de Azufre", 'es-419': "Cantera de Azufre", 'pt-BR': "Pedreira de Enxofre", 'pt-PT': "Pedreira de Enxofre", ru: "Серный карьер", uk: "Сірчаний кар'єр", pl: "Sulfur Quarry", tr: "Sülfür Madeni", nl: "Zwavelgroeve", cs: "Sulfur Quarry", da: "Svovlbrud", fi: "Rikkilouhos", sv: "Svavel stenbrott", nb: "Svovelbrudd", el: "Λατομείο Θείου", ja: "硫黄の採石場", ko: "유황 채석장", 'zh-CN': "硫磺采石场", 'zh-TW': "硫磺採石場", vi: "Mỏ Lưu Huỳnh", ar: "محجر الكبريت" },
  sulfurquarry: { en: "Sulfur Quarry", de: "Schwefel-Steinbruch", fr: "Carrière de Sulfure", it: "Cava di Zolfo", es: "Cantera de Azufre", 'es-419': "Cantera de Azufre", 'pt-BR': "Pedreira de Enxofre", 'pt-PT': "Pedreira de Enxofre", ru: "Серный карьер", uk: "Сірчаний кар'єр", pl: "Sulfur Quarry", tr: "Sülfür Madeni", nl: "Zwavelgroeve", cs: "Sulfur Quarry", da: "Svovlbrud", fi: "Rikkilouhos", sv: "Svavel stenbrott", nb: "Svovelbrudd", el: "Λατομείο Θείου", ja: "硫黄の採石場", ko: "유황 채석장", 'zh-CN': "硫磺采石场", 'zh-TW': "硫磺採石場", vi: "Mỏ Lưu Huỳnh", ar: "محجر الكبريت" },
  miningquarryhqm: { en: "HQM Quarry", de: "HQM-Steinbruch", fr: "Carrière HQM", it: "Cava di HQM", es: "Cantera de metal de alta calidad", 'es-419': "Cantera de metal de alta calidad", 'pt-BR': "Pedreira HQM", 'pt-PT': "Pedreira HQM", ru: "МВК карьер", uk: "Кар'єр ВЯМ", pl: "HQM Quarry", tr: "HQ Madeni", nl: "HQM-groeve", cs: "HQM Quarry", da: "HQM-brud", fi: "HQM-louhos", sv: "HQM Stenbrott", nb: "HQM-brudd", el: "Λατομείο HQM", ja: "高品質金属の採石場", ko: "고품질 금속 채석장", 'zh-CN': "高质量金属采石场", 'zh-TW': "高質量金屬採石場", vi: "Mỏ HQM", ar: "محجر المعدن عالي الجودة" },
  outpost: { en: "Outpost", de: "Außenposten", fr: "Avant-poste", it: "Avamposto", es: "Ruinas", 'es-419': "Ruinas", 'pt-BR': "Posto Avançado", 'pt-PT': "Posto Avançado", ru: "Аванпост", uk: "Аванпост", pl: "Outpost", tr: "Karakol", nl: "Buitenpost", cs: "Outpost", da: "Udpost", fi: "Etuvartio", sv: "Utpost", nb: "Utpost", el: "Φυλάκιο", ja: "前哨基地", ko: "전초기지", 'zh-CN': "前哨站", 'zh-TW': "前哨站", vi: "Tiền Đồn", ar: "المخفر" },
  compound: { en: "Outpost", de: "Außenposten", fr: "Avant-poste", it: "Avamposto", es: "Ruinas", 'es-419': "Ruinas", 'pt-BR': "Posto Avançado", 'pt-PT': "Posto Avançado", ru: "Аванпост", uk: "Аванпост", pl: "Outpost", tr: "Karakol", nl: "Buitenpost", cs: "Outpost", da: "Udpost", fi: "Etuvartio", sv: "Utpost", nb: "Utpost", el: "Φυλάκιο", ja: "前哨基地", ko: "전초기지", 'zh-CN': "前哨站", 'zh-TW': "前哨站", vi: "Tiền Đồn", ar: "المخفر" },
  banditcamp: { en: "Bandit Camp", de: "Banditenlager", fr: "Camp de bandits", it: "Campo dei Banditi", es: "Campamento de Bandoleros", 'es-419': "Campamento de Bandoleros", 'pt-BR': "Acampamento de Bandidos", 'pt-PT': "Acampamento de Bandidos", ru: "Лагерь бандитов", uk: "Табір бандитів", pl: "Obóz Bandytów", tr: "Haydut Kampı", nl: "Bandietenkamp", cs: "Tábor banditů", da: "Banditlejr", fi: "Rosvoleiri", sv: "Banditläger", nb: "Bandittleir", el: "Καταυλισμός Ληστών", ja: "盗賊キャンプ", ko: "밴딧 캠프", 'zh-CN': "强盗营地", 'zh-TW': "強盜營地", vi: "Trại Cướp", ar: "معسكر اللصوص" },
  bandit: { en: "Bandit Camp", de: "Banditenlager", fr: "Camp de bandits", it: "Campo dei Banditi", es: "Campamento de Bandoleros", 'es-419': "Campamento de Bandoleros", 'pt-BR': "Acampamento de Bandidos", 'pt-PT': "Acampamento de Bandidos", ru: "Лагерь бандитов", uk: "Табір бандитів", pl: "Obóz Bandytów", tr: "Haydut Kampı", nl: "Bandietenkamp", cs: "Tábor banditů", da: "Banditlejr", fi: "Rosvoleiri", sv: "Banditläger", nb: "Bandittleir", el: "Καταυλισμός Ληστών", ja: "盗賊キャンプ", ko: "밴딧 캠프", 'zh-CN': "强盗营地", 'zh-TW': "強盜營地", vi: "Trại Cướp", ar: "معسكر اللصوص" },
  fishingvillage: { en: "Fishing Village", de: "Fischerdorf", fr: "Village de pêcheurs", it: "Villaggio di pesca", es: "Poblado pesquero", 'es-419': "Poblado pesquero", 'pt-BR': "Vila de Pesca", 'pt-PT': "Vila de Pesca", ru: "Рыбацкая деревня", uk: "Рибальське село", pl: "Wioska rybacka", tr: "Balıkçılık Köyü", nl: "Vissersdorp", cs: "Fishing Village", da: "Fiskerleje", fi: "Kalastajakylä", sv: "Fiskeby", nb: "Fiskelandsby", el: "Ψαροχώρι", ja: "漁村", ko: "어촌", 'zh-CN': "渔村", 'zh-TW': "漁村", vi: "Làng Chài", ar: "قرية الصيد" },
  largefishingvillage: { en: "Large Fishing Village", de: "Großes Fischerdorf", fr: "Grand Village de Pêcheurs", it: "Grande Villaggio di Pesca", es: "Gran Poblado Pesquero", 'es-419': "Gran Poblado Pesquero", 'pt-BR': "Vila de Pesca Grande", 'pt-PT': "Vila de Pesca Grande", ru: "Большая рыбацкая деревня", uk: "Велике рибальське село", pl: "Large Fishing Village", tr: "Büyük balıkçılık köyü", nl: "Groot Vissersdorp", cs: "Large Fishing Village", da: "Stort Fiskerleje", fi: "Suuri kalastajakylä", sv: "Stora Fiskebyn", nb: "Stor Fiskelandsby", el: "Μεγάλο Ψαροχώρι", ja: "大きな漁村", ko: "대형 어촌", 'zh-CN': "大型渔村", 'zh-TW': "大型漁村", vi: "Làng Chài Lớn", ar: "قرية الصيد الكبيرة" },
  excavator: { en: "Giant Excavator Pit", de: "Riesige Baggergrube", fr: "Grand trou d’excavation", it: "Grande Fossa di Scavo", es: "Excavadora gigante", 'es-419': "Excavadora gigante", 'pt-BR': "Tubo de escavador Gigante", 'pt-PT': "Tubo de escavador Gigante", ru: "Гигантский экскаватор", uk: "Гігантський екскаватор", pl: "Giant Excavator Pit", tr: "Devasa Kazıcı Çukuru", nl: "Reusachtige Graafmachineput", cs: "Giant Excavator Pit", da: "Kæmpe Gravemaskinegrav", fi: "Jättikaivinkonekuoppa", sv: "Gigantisk Grävmaskinsgrop", nb: "Gigantisk Gravemaskingrop", el: "Γιγάντιος Λάκκος Εκσκαφέα", ja: "巨大採掘場", ko: "거대 굴착기", 'zh-CN': "巨型挖掘机坑", 'zh-TW': "巨型挖掘機坑", vi: "Hố Máy Xúc Khổng Lồ", ar: "حفرة الحفّار العملاقة" },
  giantexcavatorpit: { en: "Giant Excavator Pit", de: "Riesige Baggergrube", fr: "Grand trou d’excavation", it: "Grande Fossa di Scavo", es: "Excavadora gigante", 'es-419': "Excavadora gigante", 'pt-BR': "Tubo de escavador Gigante", 'pt-PT': "Tubo de escavador Gigante", ru: "Гигантский экскаватор", uk: "Гігантський екскаватор", pl: "Giant Excavator Pit", tr: "Devasa Kazıcı Çukuru", nl: "Reusachtige Graafmachineput", cs: "Giant Excavator Pit", da: "Kæmpe Gravemaskinegrav", fi: "Jättikaivinkonekuoppa", sv: "Gigantisk Grävmaskinsgrop", nb: "Gigantisk Gravemaskingrop", el: "Γιγάντιος Λάκκος Εκσκαφέα", ja: "巨大採掘場", ko: "거대 굴착기", 'zh-CN': "巨型挖掘机坑", 'zh-TW': "巨型挖掘機坑", vi: "Hố Máy Xúc Khổng Lồ", ar: "حفرة الحفّار العملاقة" },
  radtown: { en: "Radtown", de: "Radtown", ru: "Рэдтаун", uk: "Радтаун", nl: "Radtown", da: "Radtown", fi: "Radtown", nb: "Radtown", el: "Radtown", ja: "ラッドタウン", ko: "라드타운", 'zh-CN': "辐射镇", 'zh-TW': "輻射鎮", vi: "Radtown", ar: "رادتاون" },
  arcticresearchbase: { en: "Arctic Research Base", de: "Arktische Forschungsbasis", fr: "Base de recherche Arctique", it: "Base di Ricerca Artica", es: "Base de investigación polar", 'es-419': "Base de investigación polar", 'pt-BR': "Base de Investigação do Árctico", 'pt-PT': "Base de Investigação do Árctico", ru: "Арктическая научная станция", uk: "Арктична дослідна база", pl: "Arktyczna baza badawcza", tr: "Arktik Araştırma Üssü", nl: "Arctische Onderzoeksbasis", cs: "Arktická výzkumná základna", da: "Arktisk Forskningsbase", fi: "Arktinen tutkimusasema", sv: "Arktisk Forskningsbas", nb: "Arktisk Forskningsbase", el: "Αρκτική Ερευνητική Βάση", ja: "北極研究基地", ko: "북극 연구 기지", 'zh-CN': "北极研究基地", 'zh-TW': "北極研究基地", vi: "Căn Cứ Nghiên Cứu Bắc Cực", ar: "قاعدة الأبحاث القطبية" },
  ferryterminal: { en: "Ferry Terminal", de: "Fährterminal", fr: "Terminal Maritime", it: "Ferry Terminal", es: "Terminal del Ferry", 'es-419': "Terminal del Ferry", 'pt-BR': "Terminal de Ferry", 'pt-PT': "Terminal de Ferry", ru: "Паромный терминал", uk: "Паромний термінал", pl: "Ferry Terminal", tr: "Feribot Terminali", nl: "Veerterminal", cs: "Ferry Terminal", da: "Færgeterminal", fi: "Lauttaterminaali", sv: "Ferry Terminal", nb: "Fergeterminal", el: "Σταθμός Πορθμείου", ja: "フェリーターミナル", ko: "여객선 터미널", 'zh-CN': "渡轮码头", 'zh-TW': "渡輪碼頭", vi: "Bến Phà", ar: "محطة العبّارات" },
  lighthouse: { en: "Lighthouse", de: "Leuchtturm", fr: "Phare", it: "Faro", es: "Faro", 'es-419': "Faro", 'pt-BR': "Farol", 'pt-PT': "Farol", ru: "Маяк", uk: "Маяк", pl: "Lighthouse", tr: "Deniz feneri", nl: "Vuurtoren", cs: "Lighthouse", da: "Fyrtårn", fi: "Majakka", sv: "Fyren", nb: "Fyrtårn", el: "Φάρος", ja: "灯台", ko: "등대", 'zh-CN': "灯塔", 'zh-TW': "燈塔", vi: "Hải Đăng", ar: "المنارة" },
  oilrig: { en: "Oil Rig", de: "Ölbohrinsel", fr: "Oil Rig", it: "Piattaforma Petrolifera", es: "Petro", 'es-419': "Petro", 'pt-BR': "Plataforma de Petróleo", 'pt-PT': "Plataforma de Petróleo", ru: "Нефтяная вышка", uk: "Нафтова вишка", pl: "Oil Rig", tr: "Sondaj Kulesi", nl: "Boorplatform", cs: "Oil Rig", da: "Borerig", fi: "Öljynporauslautta", sv: "Oljeplattform", nb: "Oljerigg", el: "Πλατφόρμα Πετρελαίου", ja: "石油リグ", ko: "석유 굴착지", 'zh-CN': "石油钻井平台", 'zh-TW': "石油鑽井平台", vi: "Giàn Khoan Dầu", ar: "منصة النفط" },
  largeoilrig: { en: "Large Oil Rig", de: "Große Ölbohrinsel", fr: "Grande Oil Rig", it: "Grande Piattaforma Petrolifera", es: "Petro Grande", 'es-419': "Petro Grande", 'pt-BR': "Plataforma de Petróleo Grande", 'pt-PT': "Plataforma de Petróleo Grande", ru: "Большая нефтяная вышка", uk: "Велика нафтова вишка", pl: "Large Oil Rig", tr: "Büyük sondaj kulesi", nl: "Groot Boorplatform", cs: "Large Oil Rig", da: "Stor Borerig", fi: "Suuri öljynporauslautta", sv: "Stora Oljeplattformen", nb: "Stor Oljerigg", el: "Μεγάλη Πλατφόρμα Πετρελαίου", ja: "大型石油リグ", ko: "대형 석유 굴착지", 'zh-CN': "大型石油钻井平台", 'zh-TW': "大型石油鑽井平台", vi: "Giàn Khoan Dầu Lớn", ar: "منصة النفط الكبيرة" },
  sewerbranch: { en: "Sewer Branch", de: "Kanalisationszweig", fr: "Égouts", it: "Rete Fognaria", es: "Rama de alcantarillado", 'es-419': "Rama de alcantarillado", 'pt-BR': "Ramo de Esgoto", 'pt-PT': "Ramo de Esgoto", ru: "Канализационный отвод", uk: "Каналізаційне відгалуження", pl: "Sewer Branch", tr: "Kanalizasyon", nl: "Rioolaftakking", cs: "Sewer Branch", da: "Kloakforgrening", fi: "Viemärihaara", sv: "Avloppsgren", nb: "Kloakkgren", el: "Διακλάδωση Υπονόμου", ja: "下水道支線", ko: "하수 분기점", 'zh-CN': "下水道支管", 'zh-TW': "下水道支管", vi: "Nhánh Cống", ar: "فرع المجاري" },
  sewer: { en: "Sewer Branch", de: "Kanalisationszweig", fr: "Égouts", it: "Rete Fognaria", es: "Rama de alcantarillado", 'es-419': "Rama de alcantarillado", 'pt-BR': "Ramo de Esgoto", 'pt-PT': "Ramo de Esgoto", ru: "Канализационный отвод", uk: "Каналізаційне відгалуження", pl: "Sewer Branch", tr: "Kanalizasyon", nl: "Rioolaftakking", cs: "Sewer Branch", da: "Kloakforgrening", fi: "Viemärihaara", sv: "Avloppsgren", nb: "Kloakkgren", el: "Διακλάδωση Υπονόμου", ja: "下水道支線", ko: "하수 분기점", 'zh-CN': "下水道支管", 'zh-TW': "下水道支管", vi: "Nhánh Cống", ar: "فرع المجاري" },
  missilesilo: { en: "Missile Silo", de: "Raketensilo", fr: "Silo à missile", it: "Missile Silo", es: "Silo misilístico", 'es-419': "Silo misilístico", 'pt-BR': "Silo de Mísseis", 'pt-PT': "Silo de Mísseis", ru: "Ракетная пусковая шахта", uk: "Ракетна шахта", pl: "Missile Silo", tr: "Füze Silosu", nl: "Raketsilo", cs: "Missile Silo", da: "Missilsilo", fi: "Ohjussiilo", sv: "Missile Silo", nb: "Missilsilo", el: "Σιλό Πυραύλων", ja: "ミサイルサイロ", ko: "미사일 격납고", 'zh-CN': "导弹发射井", 'zh-TW': "導彈發射井", vi: "Hầm Tên Lửa", ar: "صومعة الصواريخ" },
  swamp: { en: "Swamp", de: "Sumpf", ru: "Болото", uk: "Болото", nl: "Moeras", da: "Sump", fi: "Suo", nb: "Sump", el: "Βάλτος", ja: "沼地", ko: "늪", 'zh-CN': "沼泽", 'zh-TW': "沼澤", vi: "Đầm Lầy", ar: "المستنقع" },
  cave: { en: "Cave", de: "Höhle", ru: "Пещера", uk: "Печера", nl: "Grot", da: "Hule", fi: "Luola", nb: "Hule", el: "Σπηλιά", ja: "洞窟", ko: "동굴", 'zh-CN': "洞穴", 'zh-TW': "洞穴", vi: "Hang Động", ar: "الكهف" },
  undergroundtunnels: { en: "Underground Tunnels", de: "Tunnelsystem", ru: "Подземные тоннели", uk: "Підземні тунелі", nl: "Ondergrondse Tunnels", da: "Underjordiske Tunneler", fi: "Maanalaiset tunnelit", nb: "Underjordiske Tunneler", el: "Υπόγειες Σήραγγες", ja: "地下トンネル", ko: "지하 터널", 'zh-CN': "地下隧道", 'zh-TW': "地下隧道", vi: "Đường Hầm Ngầm", ar: "الأنفاق تحت الأرض" },
  underwaterlab: { en: "Underwater Lab", de: "Unterwasserlabor", fr: "Laboratoire sous-marin", it: "Laboratorio Sottomarino", es: "Laboratorio submarino", 'es-419': "Laboratorio submarino", 'pt-BR': "Laboratório Subaquático", 'pt-PT': "Laboratório Subaquático", ru: "Подводная лаборатория", uk: "Підводна лабораторія", pl: "Podwodne Labolatorium", tr: "Su altı laboratuvarı", nl: "Onderwaterlab", cs: "Podvodní laboratoř", da: "Undervandslaboratorium", fi: "Vedenalainen laboratorio", sv: "Undervattenslaboratorier", nb: "Undervannslaboratorium", el: "Υποβρύχιο Εργαστήριο", ja: "水中ラボ", ko: "해저 실험실", 'zh-CN': "水下实验室", 'zh-TW': "水下實驗室", vi: "Phòng Thí Nghiệm Dưới Nước", ar: "المختبر تحت الماء" },
  traintunnel: { en: "Train Tunnel", de: "Zugtunnel", ru: "Железнодорожный тоннель", uk: "Залізничний тунель", nl: "Treintunnel", da: "Togtunnel", fi: "Junatunneli", nb: "Togtunnel", el: "Σήραγγα Τρένου", ja: "列車トンネル", ko: "기차 터널", 'zh-CN': "火车隧道", 'zh-TW': "火車隧道", vi: "Đường Hầm Tàu", ar: "نفق القطار" },
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
