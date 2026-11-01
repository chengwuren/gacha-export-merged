// 崩坏:星穹铁道 —— 基于 biuuu/star-rail-warp-export 提取的游戏差异配置
const detectLocale = require('../detectLocale')
const gachaTypeJson = require('./gachaType.json')

module.exports = {
  id: 'starrail',
  name: '崩坏：星穹铁道',
  uigfKey: 'hkrpg',
  api: {
    domain: 'https://public-operation-hkrpg.mihoyo.com',
    domainOs: 'https://public-operation-hkrpg-sg.hoyoverse.com',
    osHostHints: ['webstatic-sea', 'hkrpg-api-os', 'api-os-takumi', 'hoyoverse.com'],
    recordPath: '/common/hkrpg_gacha_record/api/',
    gachaTypeParam: 'gacha_type',
    // 部分卡池走独立端点(SR 专属逻辑),无此需要时为 null
    recordPathFor: (key) => ['21', '22'].includes(key) ? 'getLdGachaLog' : 'getGachaLog',
    // region → UTC 偏移(小时);null 表示使用 API 返回的 region_time_zone
    serverTimeZoneMap: null,
    // authkey 有效性探测:SR/ZZZ 用 getGachaLog 拉一条常驻池记录
    probe: { path: 'getGachaLog', query: '&page=1&size=5&gacha_type=1&end_id=0' }
  },
  log: {
    baseDir: 'AppData/LocalLow',
    // 注意:目录名是全角冒号(Windows 不允许半角冒号)
    gameDirs: ['/miHoYo/崩坏：星穹铁道/', '/Cognosphere/Star Rail/'],
    logFile: 'Player.log',
    // 从日志里定位游戏安装目录
    dataDirRegex: /\w:\/.*?\/StarRail_Data\//i,
    dataDirAppend: '',
    // 从缓存中提取抽卡记录 URL
    urlRegex: /https[^?]+?\?[^?]+?&auth_appid=webview_gacha&.+?authkey=.+?&game_biz=hkrpg_/g,
    // 日志里直接包含完整 URL 时使用(zzz 特有),无则为 null
    directUrlRegex: null,
    // 云游戏日志路径(原神云游戏特有),无则为 null
    cloudLogPath: null
  },
  gacha: {
    probeTypes: ['11', '12', '1', '2'],
    poolKeys: ['11', '12', '1', '2', '21', '22'],
    rankMax: '5'
  },
  excel: {
    rankColor: { 3: 'ff8e8e8e', 4: 'ffa256e1', 5: 'ffbd6932' },
    boldNot: '3',
    rankDisplay: 'number',
    useRawDataSheet: true
  },
  features: {
    hideNovice: true,
    hideStandard: false,
    copyApiUrl: false
  },
  renderer: {
    order: ['11', '12', '21', '22', '1', '2'],
    rankMax: '5',
    itemTypes: {
      weapon: ['光锥', '光錐', 'Lichtkegel', 'Light Cone', 'Conos de luz', 'cônes de lumière', '光円錐', '광추', 'Cones de Luz', 'Световые конусы', 'Nón Ánh Sáng', 'Cône de lumière'],
      character: ['角色', 'Figur', 'Character', 'Personajes', 'Personnages', 'Karakter', 'キャラクター', '캐릭터', 'Personagens', 'Персонажи', 'ตัวละคร', 'Nhân Vật', 'Personnage'],
      bangboo: null
    },
    hidePools: [{ key: '2', configKey: 'hideNovice' }]
  },
  // getGachaType(lang) → [{key, name}...]
  getGachaType: (lang) => {
    const locale = detectLocale(lang)
    return new Map(gachaTypeJson).get(locale || lang) || []
  },
  gachaTypeJson,
  idJson: require('./idJson.json'),
  i18nMap: {
    'zh-cn': require('./i18n/简体中文.json'),
    'zh-tw': require('./i18n/繁體中文.json'),
    'de-de': require('./i18n/Deutsch.json'),
    'en-us': require('./i18n/English.json'),
    'es-es': require('./i18n/Español.json'),
    'fr-fr': require('./i18n/Français.json'),
    'id-id': require('./i18n/Indonesia.json'),
    'ja-jp': require('./i18n/日本語.json'),
    'ko-kr': require('./i18n/한국어.json'),
    'pt-pt': require('./i18n/Português.json'),
    'ru-ru': require('./i18n/Pусский.json'),
    'th-th': require('./i18n/ภาษาไทย.json'),
    'vi-vn': require('./i18n/Tiếng Việt.json')
  }
}
