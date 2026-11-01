const { games, allGames, getGameInfo, gameList, setGame, getGame } = require('./index')

const gameIds = ['genshin', 'starrail', 'zzz']

describe('游戏注册表', () => {
  test('注册了三个游戏且 id 唯一', () => {
    expect(Object.keys(games).sort()).toEqual(gameIds)
    expect(new Set(gameList().map(g => g.id)).size).toBe(3)
  })

  test('uigfKey 与 UIGF 文件顶层键对应且互不重复', () => {
    const keys = allGames().map(g => g.uigfKey)
    expect(keys.sort()).toEqual(['hk4e', 'hkrpg', 'nap'])
  })

  test('setGame/getGame 切换与容错', () => {
    const before = getGame().id
    expect(setGame('zzz').id).toBe('zzz')
    expect(getGame().id).toBe('zzz')
    setGame('not-exist')
    expect(getGame().id).toBe('zzz')
    setGame(before)
  })

  test('gameList 只暴露 id/name/features,getGameInfo 含渲染层所需', () => {
    const item = gameList()[0]
    expect(Object.keys(item).sort()).toEqual(['features', 'id', 'name'])
    const info = getGameInfo()
    expect(info).toHaveProperty('renderer.order')
    expect(info).toHaveProperty('renderer.rankMax')
    expect(info).toHaveProperty('renderer.itemTypes')
    expect(info).toHaveProperty('renderer.hidePools')
    expect(Array.isArray(info.gachaType)).toBe(true)
  })
})

describe.each(gameIds)('游戏配置完整性: %s', (id) => {
  const game = games[id]

  test('必填字段齐全', () => {
    expect(game.id).toBe(id)
    expect(typeof game.name).toBe('string')
    expect(typeof game.getGachaType).toBe('function')
    expect(game.gachaTypeJson).toBeDefined()
    expect(game.i18nMap['zh-cn']).toBeDefined()
    expect(game.i18nMap['en-us']).toBeDefined()
    // API
    for (const k of ['domain', 'domainOs', 'osHostHints', 'recordPath', 'gachaTypeParam', 'probe', 'serverTimeZoneMap']) {
      expect(game.api).toHaveProperty(k)
    }
    expect(Array.isArray(game.api.osHostHints)).toBe(true)
    // 日志
    for (const k of ['baseDir', 'gameDirs', 'logFile', 'dataDirRegex', 'dataDirAppend', 'urlRegex']) {
      expect(game.log).toHaveProperty(k)
    }
    expect(game.log.dataDirRegex instanceof RegExp).toBe(true)
    expect(game.log.urlRegex instanceof RegExp).toBe(true)
    expect(Array.isArray(game.log.gameDirs)).toBe(true)
    // 卡池 / Excel / 渲染层
    expect(Array.isArray(game.gacha.probeTypes)).toBe(true)
    expect(game.gacha.rankMax).toMatch(/^\d$/)
    expect(Object.keys(game.excel.rankColor).length).toBeGreaterThan(0)
    expect(typeof game.excel.boldNot).toBe('string')
    expect(['number', 'i18n']).toContain(game.excel.rankDisplay)
    expect(game.renderer.order.length).toBeGreaterThan(0)
  })

  test('卡池键自洽: probeTypes/order/hidePools ⊆ poolKeys', () => {
    const { poolKeys, probeTypes } = game.gacha
    probeTypes.forEach(k => expect(poolKeys).toContain(k))
    game.renderer.order.forEach(k => expect(poolKeys).toContain(k))
    game.renderer.hidePools.forEach(({ key }) => expect(poolKeys).toContain(key))
  })

  test('gachaTypeJson 每个语言都有效且池键 ⊆ poolKeys,zh-cn/en-us 必须存在', () => {
    const locales = Array.isArray(game.gachaTypeJson)
      ? game.gachaTypeJson.map(([locale]) => locale)
      : Object.keys(game.gachaTypeJson)
    expect(locales).toContain('zh-cn')
    expect(locales).toContain('en-us')
    locales.forEach(locale => {
      const list = game.getGachaType(locale)
      expect(list.length).toBeGreaterThan(0)
      list.forEach(({ key, name }) => {
        expect(game.gacha.poolKeys).toContain(key)
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)
      })
    })
  })

  test('excel.rankColor 连续且覆盖到 rankMax(SR/原神从 3 星起,zzz 从 2 星起)', () => {
    const max = Number(game.gacha.rankMax)
    const colorKeys = Object.keys(game.excel.rankColor).map(Number).sort((a, b) => a - b)
    expect(colorKeys[colorKeys.length - 1]).toBe(max)
    colorKeys.forEach((k, i) => { if (i) expect(k).toBe(colorKeys[i - 1] + 1) })
    expect(Object.values(game.excel.rankColor).every(c => /^ff[0-9a-f]{6}$/i.test(c))).toBe(true)
  })

  test('excel.boldNot 是有效星级', () => {
    expect(Number(game.excel.boldNot)).toBeGreaterThanOrEqual(2)
    expect(Number(game.excel.boldNot)).toBeLessThanOrEqual(Number(game.gacha.rankMax))
  })
})

describe('各游戏特有配置', () => {
  test('SR/ZZZ 有 idJson(version + zh-cn),genshin 无', () => {
    for (const id of ['starrail', 'zzz']) {
      expect(typeof games[id].idJson.version).toBe('string')
      expect(games[id].idJson['zh-cn']).toBeDefined()
    }
    expect(games.genshin.idJson).toBeNull()
  })

  test('zzz 的 serverTimeZoneMap 覆盖五大区', () => {
    const m = games.zzz.api.serverTimeZoneMap
    for (const region of ['prod_gf_cn', 'prod_gf_jp', 'prod_gf_us', 'prod_gf_eu', 'prod_gf_sg']) {
      expect(m.get(region)).toBeDefined()
    }
    expect(games.starrail.api.serverTimeZoneMap).toBeNull()
    expect(games.genshin.api.serverTimeZoneMap).toBeNull()
  })

  test('SR 的部分卡池走 getLdGachaLog,其余走 getGachaLog', () => {
    expect(games.starrail.api.recordPathFor('21')).toBe('getLdGachaLog')
    expect(games.starrail.api.recordPathFor('22')).toBe('getLdGachaLog')
    expect(games.starrail.api.recordPathFor('11')).toBe('getGachaLog')
    expect(games.zzz.api.recordPathFor).toBeNull()
    expect(games.genshin.api.recordPathFor).toBeNull()
  })

  test('genshin 的 langNormalize 去掉非中文语言的后缀', () => {
    expect(games.genshin.langNormalize('en-us')).toBe('en')
    expect(games.genshin.langNormalize('zh-cn')).toBe('zh-cn')
    expect(games.genshin.langNormalize('zh-tw')).toBe('zh-tw')
    expect(games.starrail.langNormalize).toBeUndefined()
    expect(games.zzz.langNormalize).toBeUndefined()
  })

  test('特性开关与各游戏实际一致', () => {
    expect(games.starrail.features.hideNovice).toBe(true)
    expect(games.starrail.features.hideStandard).toBe(false)
    expect(games.zzz.features.hideStandard).toBe(true)
    expect(games.zzz.features.copyApiUrl).toBe(true)
    expect(games.genshin.features.hideNovice).toBe(true)
  })
})
