const { clipboard, ipcMain } = require('electron')
const { getUrl, deleteData, getApiUrl, readData, getData, bumpFetchGeneration } = require('./getData')
const config = require('./config')
const i18n = require('./i18n')
const { getGameInfo, gameList, setGame } = require('../games')

// 渲染层异常上报,写入 log.txt 便于诊断
ipcMain.on('RENDERER_LOG', (event, text) => {
  require('./utils').sendMsg(String(text), 'RENDERER_ERROR')
})

ipcMain.handle('COPY_URL', async () => {
  const url = await getUrl()
  if (url) {
    clipboard.writeText(url)
    return true
  }
  return false
})

ipcMain.handle('COPY_API_URL', async () => {
  const apiUrl = await getApiUrl()
  if (apiUrl) {
    clipboard.writeText(apiUrl)
    return true
  }
  return false
})

ipcMain.handle('DELETE_DATA', async (event, uid, action) => {
  await deleteData(uid, action)
})

ipcMain.handle('GAMES_LIST', () => {
  return gameList()
})

ipcMain.handle('GET_GAME_INFO', () => {
  return getGameInfo()
})

ipcMain.handle('SET_GAME', async (event, id) => {
  // 中止在途取数,避免切游戏后旧数据写串
  bumpFetchGeneration()
  const game = setGame(id)
  config.currentGame = game.id
  // 恢复该游戏上次选中的 uid
  config.current = (config.uidByGame && config.uidByGame[game.id]) || 0
  await config.save()
  await readData()
  // i18n 一并带回:渲染层必须一次性原子切换游戏状态,避免"新游戏数据 + 旧游戏语言包"的混合渲染
  return {
    ...getData(),
    game: getGameInfo(),
    i18n: i18n.data
  }
})
