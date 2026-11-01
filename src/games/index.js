// 游戏注册表:所有游戏差异集中在此目录,主流程只依赖这里的接口
const detectLocale = require('./detectLocale')
const genshin = require('./genshin/game')
const starrail = require('./starrail/game')
const zzz = require('./zzz/game')

const games = { genshin, starrail, zzz }

let currentGameId = 'starrail'

const getGame = () => games[currentGameId]
const getGameId = () => currentGameId
const setGame = (id) => {
  if (games[id]) {
    currentGameId = id
  }
  return getGame()
}

// 完整游戏对象列表(主进程内部用)
const allGames = () => Object.values(games)

// 传给渲染层的精简信息(不含函数/正则)
const gameList = () => Object.values(games).map(game => ({
  id: game.id,
  name: game.name,
  features: game.features
}))

// 当前游戏给渲染层用的完整信息
const getGameInfo = (game = getGame()) => ({
  id: game.id,
  name: game.name,
  features: game.features,
  renderer: game.renderer,
  idJsonVersion: game.idJson?.version || '',
  // 统一转成 [locale, [{key,name}...]] 数组对的形状
  gachaType: Array.isArray(game.gachaTypeJson) ? game.gachaTypeJson : Object.entries(game.gachaTypeJson)
})

module.exports = { games, getGame, getGameId, setGame, allGames, gameList, getGameInfo, detectLocale }
