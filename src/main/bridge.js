const { clipboard, ipcMain } = require('electron')
const { getUrl, deleteData, getApiUrl, readData, getData, bumpFetchGeneration } = require('./getData')
const config = require('./config')
const { getGameInfo, gameList, setGame } = require('../games')

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
  return {
    ...getData(),
    game: getGameInfo()
  }
})
