// UIGF 导入/导出调度器:具体实现按游戏放在 games/<id>/uigf.js
// 导入时按文件内的 hk4e/hkrpg/nap 键分发,支持一个文件里包含多个游戏的数据
const { ipcMain, dialog } = require('electron')
const fs = require('fs-extra')
const { getData } = require('./getData')
const { getGame } = require('../games')
const { sendMsg } = require('./utils')
const i18n = require('./i18n')

const gameModules = {
  genshin: require('../games/genshin/uigf'),
  starrail: require('../games/starrail/uigf'),
  zzz: require('../games/zzz/uigf')
}

const exportUIGF = async (uids) => {
  await gameModules[getGame().id].exportUIGF(uids)
}

const importUIGF = async () => {
  const filepath = await dialog.showOpenDialogSync({
    properties: ['openFile'],
    filters: [
      { name: i18n.uigf.fileType, extensions: ['json'] }
    ]
  })
  if (!filepath) return
  try {
    const jsonData = fs.readJsonSync(filepath[0])
    let imported = false
    for (const mod of Object.values(gameModules)) {
      if (Array.isArray(jsonData[mod.uigfKey])) {
        const ok = await mod.importData(jsonData)
        if (ok) imported = true
      }
    }
    if (!imported) {
      sendMsg('UIGF格式错误')
      console.error('UIGF格式错误')
      return
    }
    return {
      dataMap: getData().dataMap,
      current: getData().current
    }
  } catch (error) {
    sendMsg(error, 'ERROR')
    console.error(error)
  }
}

ipcMain.handle('EXPORT_UIGF_JSON', async (event, uids) => {
  await exportUIGF(uids)
})

ipcMain.handle('IMPORT_UIGF_JSON', async () => {
  return await importUIGF()
})
