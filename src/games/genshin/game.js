// 原神 —— 基于 biuuu/genshin-wish-export 提取的游戏差异配置
const gachaTypeJson = require('./gachaType.json')

const gachaTypeOrder = ['301', '302', '200', '500', '100']

module.exports = {
  id: 'genshin',
  name: '原神',
  uigfKey: 'hk4e',
  api: {
    domain: 'https://public-operation-hk4e.mihoyo.com',
    domainOs: 'https://public-operation-hk4e-sg.hoyoverse.com',
    osHostHints: ['webstatic-sea', 'hk4e-api-os', 'hoyoverse.com'],
    recordPath: '/gacha_info/api/',
    gachaTypeParam: 'gacha_type',
    recordPathFor: null,
    serverTimeZoneMap: null,
    // 原神用 getConfigList 端点校验 authkey
    probe: { path: 'getConfigList', query: '' }
  },
  log: {
    baseDir: 'AppData/LocalLow',
    gameDirs: ['/miHoYo/原神/', '/miHoYo/Genshin Impact/'],
    logFile: 'output_log.txt',
    dataDirRegex: /\w:\/.+(GenshinImpact_Data|YuanShen_Data)/,
    dataDirAppend: '',
    urlRegex: /https.+?auth_appid=webview_gacha.+?authkey=.+?game_biz=hk4e_\w+/g,
    directUrlRegex: null,
    // 云原神的 SDK 日志
    cloudLogPath: 'AppData/Local/miHoYo/GenshinImpactCloudGame/config/logs/MiHoYoSDK.log'
  },
  gacha: {
    probeTypes: ['301', '302', '500', '200', '100'],
    poolKeys: ['301', '302', '400', '500', '200', '100'],
    rankMax: '5',
    // 原神首页请求不带 end_id(0 为假值不拼接),与上游一致
    endIdInit: 0
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
    order: gachaTypeOrder,
    rankMax: '5',
    itemTypes: {
      weapon: ['武器', 'Weapon', '무기', 'Arma', 'Arme', 'Оружие', 'อาวุธ', 'Vũ Khí', 'Waffe', 'Senjata'],
      character: ['角色', 'Character', '캐릭터', 'キャラクター', 'Personaje', 'Personnage', 'Персонажи', 'ตัวละคร', 'Nhân Vật', 'Figur', 'Karakter', 'Personagem'],
      bangboo: null
    },
    hidePools: [{ key: '100', configKey: 'hideNovice' }]
  },
  // 原神的 gachaType.json 是 {locale: [...]} 对象,且语言匹配规则更宽松
  getGachaType: (language) => {
    const lang = language.startsWith('zh-') || language.includes('-')
      ? language
      : Object.keys(gachaTypeJson).find(key => key.startsWith(language + '-'))
    const list = gachaTypeJson[lang]
    if (!list) return []
    return gachaTypeOrder.map(id => list.find(item => item.key === id)).filter(Boolean)
  },
  // 原神 API 的 lang 参数不带地区后缀(zh 系除外)
  langNormalize: (lang) => {
    if (lang && !lang.startsWith('zh-')) {
      return lang.replace(/-\w+$/, '')
    }
    return lang
  },
  gachaTypeJson,
  idJson: null,
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
