const fs = require('fs-extra')
const util = require('util')
const path = require('path')
const { URL } = require('url')
const { app, ipcMain, shell } = require('electron')
const { sleep, request, sendMsg, readJSON, saveJSON, detectLocale, getCacheText, userDataPath, userPath, localIp, langMap } = require('./utils')
const config = require('./config')
const i18n = require('./i18n')
const { enableProxy, disableProxy } = require('./module/system-proxy')
const mitmproxy = require('./module/node-mitmproxy')
const { mergeData } =  require('./utils/mergeData')
const { getGame, getGameId, allGames } = require('../games')

// 每个游戏独立的数据容器:gameId → Map(uid → data)
const dataMaps = new Map()
const currentDataMap = () => {
  const id = getGameId()
  if (!dataMaps.has(id)) {
    dataMaps.set(id, new Map())
  }
  return dataMaps.get(id)
}

const gameDataPath = () => path.join(userDataPath, getGameId())

const saveData = async (data) => {
  const obj = Object.assign({}, data)
  obj.result = [...obj.result]
  await config.save()
  await saveJSON(`gacha-list-${data.uid}.json`, obj, gameDataPath())
}

const convertTimeZone = (dateTimeStr, fromTimeZoneOffset, toTimeZoneOffset) => {
  let date = new Date(dateTimeStr.replace(' ', 'T') + 'Z');
  let utcDate = new Date(date.getTime() - fromTimeZoneOffset * 60 * 60 * 1000);
  let targetDate = new Date(utcDate.getTime() + toTimeZoneOffset * 60 * 60 * 1000);
  let year = targetDate.getUTCFullYear();
  let month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  let day = String(targetDate.getUTCDate()).padStart(2, '0');
  let hours = String(targetDate.getUTCHours()).padStart(2, '0');
  let minutes = String(targetDate.getUTCMinutes()).padStart(2, '0');
  let seconds = String(targetDate.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 旧版单游戏应用把 gacha-list-*.json 直接放在 userData 根目录,这里按内容识别归属游戏后搬运
const detectDataGame = (data) => {
  if (!data || !Array.isArray(data.result) || !data.result.length) return null
  const keys = data.result.map(r => r[0])
  const rows = data.result.flatMap(r => r[1] || [])
  if (!rows.length) return null
  // 旧原神的数据行是数组
  if (Array.isArray(rows[0])) {
    return 'genshin'
  }
  const ranks = rows.map(r => Number(r.rank_type)).filter(Boolean)
  const maxRank = ranks.length ? Math.max(...ranks) : 0
  const games = allGames()
  const candidates = games.filter(g => keys.every(k => g.gacha.poolKeys.includes(k)))
  if (!candidates.length) return null
  const exact = candidates.filter(g => Number(g.gacha.rankMax) === maxRank)
  if (exact.length === 1) return exact[0].id
  const fits = candidates.filter(g => Number(g.gacha.rankMax) >= maxRank)
  return (fits[0] || candidates[0]).id
}

const findDataFiles = async (dataPath, fileMap) => {
  const files = await readdir(dataPath)
  if (files?.length) {
    for (let name of files) {
      if (/^gacha-list-\d+\.json$/.test(name) && !fileMap.has(name)) {
        fileMap.set(name, dataPath)
      }
    }
  }
}

// 旧原神数组行 → 统一对象格式
const normalizeGenshinRow = (item) => {
  const [time, name, item_type, rank_type, gacha_type, id] = item
  return { id, item_id: '', item_type, name, rank_type: String(rank_type), time, gacha_id: gacha_type, gacha_type, count: '1' }
}

const collectDataFiles = async () => {
  await fs.ensureDir(gameDataPath())
  const fileMap = new Map()
  // 先归位根目录里的旧版数据文件
  try {
    const legacy = await readdir(userDataPath)
    if (legacy?.length) {
      for (let name of legacy) {
        if (!/^gacha-list-\d+\.json$/.test(name) || fileMap.has(name)) continue
        const data = await readJSON(userDataPath, name)
        const gameId = detectDataGame(data)
        if (gameId) {
          try {
            await fs.move(path.join(userDataPath, name), path.join(userDataPath, gameId, name), { overwrite: false })
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  await findDataFiles(gameDataPath(), fileMap)
  return fileMap
}

const readedGames = new Set()
const readdir = util.promisify(fs.readdir)
const readData = async () => {
  if (readedGames.has(getGameId())) return
  readedGames.add(getGameId())
  const fileMap = await collectDataFiles()
  const dataMap = currentDataMap()
  for (let [name, dataPath] of fileMap) {
    try {
      const data = await readJSON(dataPath, name)
      if (data.result && Array.isArray(data.result)) {
        // 兼容旧原神数组格式
        const sample = data.result[0]?.[1]?.[0]
        if (Array.isArray(sample)) {
          data.result = data.result.map(([key, rows]) => [key, rows.map(normalizeGenshinRow)])
        }
      }
      data.typeMap = new Map(data.typeMap)
      data.result = new Map(data.result)
      data.result.forEach((value, key) => {
        value.forEach(item => {
          if (!('count' in item)) {
            item.count = "1";
          }
        });
      });
      if (data.uid) {
        dataMap.set(data.uid, data)
      }
    } catch (e) {
      sendMsg(e, 'ERROR')
    }
  }
  if ((!config.current && dataMap.size) || (config.current && dataMap.size && !dataMap.has(config.current))) {
    await changeCurrent(dataMap.keys().next().value)
  }
}

const deleteData = async (uid, action) => {
  const data = currentDataMap().get(uid)
  if (data) {
    data.deleted = action
    await saveData(data)
  }
}

const changeCurrent = async (uid) => {
  config.current = uid
  if (!config.uidByGame) config.uidByGame = {}
  config.uidByGame[getGameId()] = uid
  await config.save()
}

const detectGameLocale = async (userPath) => {
  let list = []
  const lang = app.getLocale()
  const game = getGame()
  game.log.gameDirs.forEach(str => {
    try {
      const pathname = path.join(userPath, '/' + game.log.baseDir + '/', str, game.log.logFile)
      fs.accessSync(pathname, fs.constants.F_OK)
      list.push(pathname)
    } catch (e) {}
  })
  if (config.logType) {
    if (config.logType === 2) {
      list.reverse()
    }
    list = list.slice(0, 1)
  } else if (lang !== 'zh-CN') {
    list.reverse()
  }
  return list
}

const getLatestUrl = (list) => {
  return list[list.length - 1]
}

let cacheFolder = null
const readLog = async () => {
  const text = i18n.log
  const game = getGame()
  try {
    let userPath
    if (!process.env.WINEPREFIX) {
      userPath = app.getPath('home')
    } else {
      userPath = path.join(process.env.WINEPREFIX, 'drive_c/users', process.env.USER)
    }
    const logPaths = await detectGameLocale(userPath)
    if (!logPaths.length && game.log.cloudLogPath) {
      // 云原神:直接读 SDK 日志
      try {
        const cacheText = await fs.readFile(path.join(userPath, game.log.cloudLogPath), 'utf8')
        const urlMch = cacheText.match(game.log.urlRegex)
        if (urlMch) {
          return urlMch[urlMch.length - 1]
        }
      } catch (e) {}
    }
    if (!logPaths.length) {
      sendMsg(text.file.notFound)
      return false
    }
    const promises = logPaths.map(async logpath => {
      const logText = await fs.readFile(logpath, 'utf8')
      if (game.log.directUrlRegex) {
        const url = logText.match(game.log.directUrlRegex)
        if (url) {
          return getLatestUrl(url)
        }
      }
      const gamePathMch = logText.match(game.log.dataDirRegex)
      if (gamePathMch) {
        const [cacheText, cacheFile] = await getCacheText(gamePathMch[0] + game.log.dataDirAppend)
        const urlMch = cacheText.match(game.log.urlRegex)
        if (urlMch) {
          cacheFolder = cacheFile.replace(/Cache_Data[/\\]data_2$/, '')
          return getLatestUrl(urlMch)
        }
      }
    })
    const result = await Promise.all(promises)
    for (let url of result) {
      if (url) {
        return url
      }
    }
    sendMsg(text.url.notFound)
    return false
  } catch (e) {
    sendMsg(text.file.readFailed)
    return false
  }
}

const getGachaLog = async ({ key, page, name, retryCount, url, endId, gen }) => {
  const text = i18n.log
  try {
    const param = getGame().api.gachaTypeParam
    const res = await request(`${url}&${param}=${key}&page=${page}&size=${20}${endId ? '&end_id=' + endId : ''}`)
    if (res?.data?.list) {
      return res?.data
    }
    throw new Error(res?.message || res)
  } catch (e) {
    // 切换游戏后立即停止重试
    if (gen !== undefined && gen !== fetchGeneration) {
      throw new Error('FETCH_ABORTED')
    }
    if (retryCount) {
      sendMsg(i18n.parse(text.fetch.retry, { name, page, count: 6 - retryCount }))
      await sleep(5)
      retryCount--
      return await getGachaLog({ key, page, name, retryCount, url, endId, gen })
    } else {
      sendMsg(i18n.parse(text.fetch.retryFailed, { name, page }))
      throw e
    }
  }
}

const getGachaLogs = async ({ name, key }, queryString, gen) => {
  const text = i18n.log
  const game = getGame()
  let page = 1
  let list = []
  let res = null
  let logs = []
  let uid = ''
  let region = ''
  let region_time_zone = ''
  // 原神上游首页不带 end_id(数值 0 为假值);SR/ZZZ 上游固定传 end_id=0
  let endId = game.gacha.endIdInit ?? '0'
  const recordPath = game.api.recordPathFor ? game.api.recordPath + game.api.recordPathFor(key) : game.api.recordPath + 'getGachaLog'
  const url = `${apiDomain}${recordPath}?${queryString}`
  do {
    // 每一页都检查代际号:切换游戏后 1 页内立即中止(全量历史可能要拉几分钟)
    if (gen !== undefined && gen !== fetchGeneration) {
      throw new Error('FETCH_ABORTED')
    }
    await sleep(0.3)
    sendMsg(i18n.parse(text.fetch.current, { name, page }))
    res = await getGachaLog({ key, page, name, url, endId, retryCount: 5, gen })
    logs = res?.list || []
    if (!uid && logs.length) {
      uid = logs[0].uid
    }
    if (!region) {
      region = res.region
    }
    if (!region_time_zone) {
      region_time_zone = res.region_time_zone
    }
    list.push(...logs)
    page += 1

    if (logs.length) {
      endId = logs[logs.length - 1].id
    }

    // 分页安全上限(1000 页 = 2 万条/池),防止 API 异常时死循环
    if (page > 1000) {
      sendMsg(`分页超过上限,已中断(${name})`, 'ERROR')
      break
    }

    if (!config.fetchFullHistory && logs.length && uid && currentDataMap().has(uid)) {
      const result = currentDataMap().get(uid).result
      if (result.has(key)) {
        const arr = result.get(key)
        if (arr.length) {
          const localLatestId = arr[arr.length - 1].id
          if (localLatestId) {
            let shouldBreak = false
            logs.forEach(item => {
              if (item.id === localLatestId) {
                shouldBreak = true
              }
            })
            if (shouldBreak) {
              break
            }
          }
        }
      }
    }
  } while (logs.length > 0)
  return { list, uid, region, region_time_zone }
}

const checkResStatus = (res) => {
  const text = i18n.log
  if (res.retcode !== 0) {
    let message = res.message
    if (res.message === 'authkey timeout') {
      message = text.fetch.authTimeout
      sendMsg(true, 'AUTHKEY_TIMEOUT')
    }
    sendMsg(message)
    throw new Error(message)
  }
  sendMsg(false, 'AUTHKEY_TIMEOUT')
  return res
}

const tryGetUid = async (queryString) => {
  const game = getGame()
  const url = `${apiDomain}${game.api.recordPath}getGachaLog?${queryString}`
  try {
    for (let key of game.gacha.probeTypes) {
      const res = await request(`${url}&${game.api.gachaTypeParam}=${key}&page=1&size=6`)
      if (res.data.list && res.data.list.length) {
        return res.data.list[0].uid
      }
    }
  } catch (e) {}
  return config.current
}

const fixAuthkey = (url) => {
  const mr = url.match(/authkey=([^&]+)/)
  if (mr && mr[1] && mr[1].includes('=') && !mr[1].includes('%')) {
    return url.replace(/authkey=([^&]+)/, `authkey=${encodeURIComponent(mr[1])}`)
  }
  return url
}

let apiDomain = ''
const getQuerystring = (url) => {
  const text = i18n.log
  const game = getGame()
  const { searchParams, host } = new URL(fixAuthkey(url))
  if (game.api.osHostHints.some(hint => host.includes(hint))) {
    apiDomain = game.api.domainOs
  } else {
    apiDomain = game.api.domain
  }
  const authkey = searchParams.get('authkey')
  if (!authkey) {
    sendMsg(text.url.lackAuth)
    return false
  }
  searchParams.delete('page')
  searchParams.delete('size')
  searchParams.delete('gacha_type')
  searchParams.delete('real_gacha_type')
  searchParams.delete('end_id')
  return searchParams
}

const proxyServer = (port) => {
  return new Promise((rev) => {
    mitmproxy.createProxy({
      sslConnectInterceptor: (req, cltSocket, head) => {
        if (/webstatic([^\.]{2,10})?\.(mihoyo|hoyoverse)\.com/.test(req.url)) {
          return true
        }
      },
      requestInterceptor: (rOptions, req, res, ssl, next) => {
        next()
        if (/webstatic([^\.]{2,10})?\.(mihoyo|hoyoverse)\.com/.test(rOptions.hostname)) {
          if (/authkey=[^&]+/.test(rOptions.path)) {
            rev(`${rOptions.protocol}//${rOptions.hostname}${rOptions.path}`)
          }
        }
      },
      responseInterceptor: (req, res, proxyReq, proxyRes, ssl, next) => {
        next()
      },
      getPath: () => path.join(userPath, 'node-mitmproxy'),
      port
    })
  })
}

let proxyServerPromise
const useProxy = async () => {
  const text = i18n.log
  const ip = localIp()
  const port = config.proxyPort
  sendMsg(i18n.parse(text.proxy.hint, { ip, port }))
  await enableProxy('127.0.0.1', port)
  if (!proxyServerPromise) {
    proxyServerPromise = proxyServer(port)
  }
  const url = await proxyServerPromise
  await disableProxy()
  return url
}

const getUrlFromConfig = () => {
  if (config.urls.size) {
    if (config.current && config.urls.has(config.current)) {
      const url = config.urls.get(config.current)
      return url
    }
  }
}

const tryRequest = async (url, retry = false) => {
  const game = getGame()
  const queryString = getQuerystring(url)
  if (!queryString) return false
  const gachaTypeUrl = `${apiDomain}${game.api.recordPath}${game.api.probe.path}?${queryString}${game.api.probe.query || ''}`
  try {
    const res = await request(gachaTypeUrl)
    checkResStatus(res)
  } catch (e) {
    if (e.code === 'ERR_PROXY_CONNECTION_FAILED' && !retry) {
      await disableProxy()
      return await tryRequest(url, true)
    }
    sendMsg(e.message.replace(url, '***'), 'ERROR')
    throw e
  }
}

const getUrl = async () => {
  let url = await readLog()
  if (!url && config.proxyMode) {
    url = await useProxy()
  }
  return url
}

// 取数代际号:切换游戏或发起新取数时 +1,使在途 fetch 每页自行中止
let fetchGeneration = 0
const bumpFetchGeneration = () => ++fetchGeneration

const fetchData = async (urlOverride) => {
  const text = i18n.log
  const game = getGame()
  // 每次新取数作废所有旧取数(防止多游戏并发拉取)
  const gen = ++fetchGeneration
  await readData()
  let url = urlOverride
  if (!url) {
    url = await getUrl()
  }
  if (!url) {
    const message = text.url.notFound2
    sendMsg(message)
    throw new Error(message)
  }

  await tryRequest(url)

  const searchParams = getQuerystring(url)
  if (!searchParams) {
    const message = text.url.incorrect
    sendMsg(message)
    throw new Error(message)
  }
  let queryString = searchParams.toString()
  const vUid = await tryGetUid(queryString)
  const dataMap = currentDataMap()
  let localLang = dataMap.has(vUid) ? dataMap.get(vUid).lang : ''
  if (localLang && game.langNormalize) {
    localLang = game.langNormalize(localLang)
  }
  if (localLang) {
    searchParams.set('lang', localLang)
  }
  queryString = searchParams.toString()
  const gachaType = await game.getGachaType(searchParams.get('lang'))
  if (!gachaType || !gachaType.length) {
    const message = `未获取到卡池定义(${game.id}/${searchParams.get('lang')})`
    sendMsg(message, 'ERROR')
    throw new Error(message)
  }

  const result = new Map()
  const typeMap = new Map()
  const lang = searchParams.get('lang')
  let originUid = ''
  let originRegion = ''
  let localTimeZone
  for (const type of gachaType) {
    if (gen !== fetchGeneration) {
      throw new Error('FETCH_ABORTED')
    }
    const { list, uid, region, region_time_zone } = await getGachaLogs(type, queryString, gen)
    if (game.api.serverTimeZoneMap) {
      const tz = game.api.serverTimeZoneMap.get(region)
      if (!tz) {
        const message = '不支持此服务器'
        sendMsg(message, 'ERROR')
        throw new Error(message)
      }
      if (localTimeZone === undefined) {
        localTimeZone = dataMap.get(uid)?.region_time_zone
        if (localTimeZone === undefined) {
          localTimeZone = tz
        }
      }
      list.forEach(item => {
        item.time = convertTimeZone(item.time, tz, localTimeZone)
      })
    } else {
      if (localTimeZone === undefined) {
        localTimeZone = dataMap.get(uid)?.region_time_zone
        if (localTimeZone === undefined) {
          localTimeZone = region_time_zone
        }
      }
    }
    const logs = list.map((item) => {
      const { id, item_id, item_type, name, rank_type, time, gacha_id, gacha_type, count} = item
      return { id, item_id, item_type, name, rank_type, time, gacha_id, gacha_type, count }
    })
    logs.reverse()
    typeMap.set(type.key, type.name)
    result.set(type.key, logs)
    if (!originUid) {
      originUid = uid
    }
    if (!originRegion) {
      originRegion = region
    }
  }
  const data = { result, typeMap, time: Date.now(), uid: originUid, lang, region: originRegion, region_time_zone: localTimeZone }
  const localData = dataMap.get(originUid)
  const mergedResult = mergeData(localData, data)
  data.result = mergedResult
  dataMap.set(originUid, data)
  await changeCurrent(originUid)
  await saveData(data)
}

let proxyStarted = false
const fetchDataByProxy = async () => {
  if (proxyStarted) return
  proxyStarted = true
  const url = await useProxy()
  await fetchData(url)
}

ipcMain.handle('FETCH_DATA', async (event, param) => {
  try {
    if (param === 'proxy') {
      await fetchDataByProxy()
    } else {
      await fetchData(param)
    }
    return {
      dataMap: currentDataMap(),
      current: config.current
    }
  } catch (e) {
    if (e && e.message === 'FETCH_ABORTED') {
      return false
    }
    sendMsg(e, 'ERROR')
    console.error(e)
  }
  return false
})

ipcMain.handle('READ_DATA', async () => {
  await readData()
  return {
    dataMap: currentDataMap(),
    current: config.current
  }
})

ipcMain.handle('CHANGE_UID', (event, uid) => {
  changeCurrent(uid)
})

ipcMain.handle('GET_CONFIG', () => {
  return config.value()
})

ipcMain.handle('LANG_MAP', () => {
  return langMap
})

ipcMain.handle('SAVE_CONFIG', (event, [key, value]) => {
  config[key] = value
  config.save()
})

ipcMain.handle('DISABLE_PROXY', async () => {
  await disableProxy()
})

ipcMain.handle('I18N_DATA', () => {
  return i18n.data
})

ipcMain.handle('OPEN_CACHE_FOLDER', () => {
  if (cacheFolder) {
    shell.openPath(cacheFolder)
  }
})

exports.getData = () => {
  return {
    dataMap: currentDataMap(),
    current: config.current
  }
}

exports.getApiUrl = async () => {
  const url = await getUrl()
  if (!url) return null
  const searchParams = getQuerystring(url)
  if (!searchParams) return null
  return `${apiDomain}${getGame().api.recordPath}getGachaLog?${searchParams.toString()}`
}

exports.getUrl = getUrl
exports.deleteData = deleteData
exports.saveData = saveData
exports.changeCurrent = changeCurrent
exports.convertTimeZone = convertTimeZone
exports.getGachaType = (lang) => getGame().getGachaType(lang)
exports.readData = readData
exports.currentDataMap = currentDataMap
exports.bumpFetchGeneration = bumpFetchGeneration
