// 绝区零 —— 基于 earthjasonlin/zzz-signal-search-export 提取的游戏差异配置
const detectLocale = require('../detectLocale')
const gachaTypeJson = require('./gachaType.json')

module.exports = {
  id: 'zzz',
  name: '绝区零',
  uigfKey: 'nap',
  api: {
    domain: 'https://public-operation-nap.mihoyo.com',
    domainOs: 'https://public-operation-nap-sg.hoyoverse.com',
    osHostHints: ['webstatic-sea', 'hoyoverse.com'],
    recordPath: '/common/gacha_record/api/',
    gachaTypeParam: 'real_gacha_type',
    recordPathFor: null,
    // zzz 不返回 region_time_zone,改用 region 映射表
    serverTimeZoneMap: new Map([
      ['prod_gf_cn', 8],
      ['prod_gf_jp', 8],
      ['prod_gf_us', -5],
      ['prod_gf_eu', 1],
      ['prod_gf_sg', 8]
    ]),
    probe: { path: 'getGachaLog', query: '&page=1&size=5&real_gacha_type=1&end_id=0' }
  },
  log: {
    baseDir: 'AppData/LocalLow',
    gameDirs: ['/miHoYo/绝区零/', '/miHoYo/ZenlessZoneZero/'],
    logFile: 'Player.log',
    dataDirRegex: /([A-Z]:\/.*?\/)(?=ZenlessZoneZero_Data)/i,
    dataDirAppend: '/ZenlessZoneZero_Data',
    urlRegex: /https.+?authkey=.+?end_id=/g,
    // zzz 的日志里可能直接有完整 URL
    directUrlRegex: /https:\/\/.*?\/info/g,
    cloudLogPath: null
  },
  gacha: {
    probeTypes: ['2', '3', '1', '5'],
    poolKeys: ['2', '3', '1', '5', '102', '103'],
    rankMax: '4'
  },
  excel: {
    rankColor: { 2: 'ff8e8e8e', 3: 'ffa256e1', 4: 'ffbd6932' },
    boldNot: '2',
    rankDisplay: 'i18n',
    useRawDataSheet: true
  },
  features: {
    hideNovice: false,
    hideStandard: true,
    copyApiUrl: true
  },
  renderer: {
    order: ['2', '3', '5', '102', '103', '1'],
    rankMax: '4',
    itemTypes: {
      weapon: ['音擎', 'W-Engines', '音擎'],
      character: ['代理人', 'Agents', '代理人'],
      bangboo: ['邦布', 'Bangboo', '邦布']
    },
    hidePools: [{ key: '1', configKey: 'hideStandard' }]
  },
  getGachaType: (lang) => {
    const locale = detectLocale(lang)
    return new Map(gachaTypeJson).get(locale || lang) || []
  },
  gachaTypeJson,
  idJson: require('./idJson.json'),
  i18nMap: {
    'zh-cn': require('./i18n/简体中文.json'),
    'zh-tw': require('./i18n/繁體中文.json'),
    'en-us': require('./i18n/English.json')
  }
}
