// 校验:每个游戏的语言包,在 zh-cn → en-us → 当前语言 的回退链合并后,
// 必须覆盖该游戏界面实际用到的全部键(防止再出现"空菜单"问题)
const { games } = require('./index')

const COMMON_KEYS = [
  'ui.button.load', 'ui.button.update', 'ui.button.files', 'ui.button.excel', 'ui.button.uigf', 'ui.button.import',
  'ui.button.option', 'ui.button.setting', 'ui.button.url', 'ui.button.copyUrl', 'ui.button.startProxy',
  'ui.button.solution', 'ui.button.cacheFolder',
  'ui.hint.init', 'ui.hint.lastUpdate', 'ui.hint.failed',
  'ui.select.newAccount',
  'ui.urlDialog.title', 'ui.urlDialog.hint', 'ui.urlDialog.placeholder',
  'ui.common.ok', 'ui.common.cancel',
  'ui.win.title', 'symbol.colon',
  'ui.uigf.title', 'ui.about.title', 'ui.about.license',
  'ui.extra.urlCopied', 'ui.extra.findCacheFolder', 'ui.extra.cacheClean',
  'ui.setting.language', 'ui.setting.languageHint', 'ui.setting.logType', 'ui.setting.auto', 'ui.setting.cnServer', 'ui.setting.seaServer',
  'ui.setting.logTypeHint', 'ui.setting.autoUpdate', 'ui.setting.fetchFullHistory', 'ui.setting.fetchFullHistoryHint',
  'ui.setting.proxyMode', 'ui.setting.proxyModeHint', 'ui.setting.closeProxy', 'ui.setting.closeProxyHint',
  'ui.setting.idVersion', 'ui.setting.dataManagerHint',
  'ui.common.data', 'ui.common.dataManage', 'ui.common.updateTime', 'ui.common.status', 'ui.common.deleted',
  'ui.common.normal', 'ui.common.action', 'ui.common.restore', 'ui.common.delete',
  'excel.header.time', 'excel.header.name', 'excel.header.type', 'excel.header.rank',
  'excel.header.total', 'excel.header.pity', 'excel.header.remark',
  'excel.customFont', 'excel.filePrefix', 'excel.fileType'
]

// 由 features 决定的键
const FEATURE_KEYS = (game) => {
  const keys = []
  if (game.features.hideNovice) keys.push('ui.setting.hideNovice', 'ui.data.no5star')
  if (game.features.hideStandard) keys.push('ui.setting.hideStandard')
  if (game.features.copyApiUrl) keys.push('ui.button.copyApiUrl')
  return keys
}

// GachaDetail/PieChart 按游戏不同
const DATA_KEYS = {
  genshin: [
    'ui.data.total', 'ui.data.times', 'ui.data.sum', 'ui.data.no5star', 'ui.data.character', 'ui.data.weapon',
    'ui.data.star5', 'ui.data.star4', 'ui.data.star3', 'ui.data.history', 'ui.data.average',
    'ui.data.chara5', 'ui.data.weapon5', 'ui.data.chara4', 'ui.data.weapon4', 'ui.data.weapon3'
  ],
  starrail: [
    'ui.data.total', 'ui.data.times', 'ui.data.sum', 'ui.data.no5star', 'ui.data.character', 'ui.data.weapon',
    'ui.data.star5', 'ui.data.star4', 'ui.data.star3', 'ui.data.history', 'ui.data.average',
    'ui.data.chara5', 'ui.data.weapon5', 'ui.data.chara4', 'ui.data.weapon4', 'ui.data.weapon3'
  ],
  zzz: [
    'ui.data.total', 'ui.data.times', 'ui.data.sum', 'ui.data.no4star', 'ui.data.character', 'ui.data.weapon', 'ui.data.bang',
    'ui.data.star4', 'ui.data.star3', 'ui.data.star2', 'ui.data.history', 'ui.data.average',
    'ui.data.bang4', 'ui.data.chara4', 'ui.data.weapon4', 'ui.data.bang3', 'ui.data.chara3', 'ui.data.weapon3', 'ui.data.weapon2'
  ]
}

describe.each(['genshin', 'starrail', 'zzz'])('语言包键覆盖: %s', (id) => {
  const game = games[id]
  const raw = game.i18nMap

  const effective = (lang) => {
    // 与 main/i18n.js 的回退链完全一致:zh-cn 为底,en-us 次之,当前语言最高,且跳过假值(上游语言包存在空串)
    const assign = (a, b) => { const t = { ...a }; for (const k in b) { if (b[k]) t[k] = b[k] } return t }
    return assign(raw['zh-cn'], assign(raw['en-us'], raw[lang] || {}))
  }

  test.each(Object.keys(raw))('语言 %s 覆盖全部必需键', (lang) => {
    const merged = effective(lang)
    const required = [...COMMON_KEYS, ...DATA_KEYS[id], ...FEATURE_KEYS(game)]
    const missing = required.filter(k => !merged[k])
    expect(missing).toEqual([])
  })

  test('必需键值非空字符串', () => {
    const merged = effective('en-us')
    const required = [...COMMON_KEYS, ...DATA_KEYS[id], ...FEATURE_KEYS(game)]
    const empty = required.filter(k => typeof merged[k] !== 'string' || !merged[k].trim())
    expect(empty).toEqual([])
  })
})
