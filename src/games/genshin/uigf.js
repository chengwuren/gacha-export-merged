// 原神 UIGF v4 导入/导出
// 说明:上游 genshin-wish-export 在 item_id 缺失时会请求外部服务按名称反查,
// 合并版简化为直接使用 API 返回的 item_id,缺失则导出为空字符串。
const { dialog, app } = require('electron')
const fs = require('fs-extra')
const path = require('path')
const { getData, saveData, changeCurrent } = require('../../main/getData')
const config = require('../../main/config')
const { name, version } = require('../../../package.json')
const i18n = require('../../main/i18n')
const { mergeData } = require('../../main/utils/mergeData')
const { sendMsg } = require('../../main/utils')

const getTimeString = () => {
  return new Date().toLocaleString('sv').replace(/[- :]/g, '').slice(0, -2)
}

const exportUIGF = async (uids) => {
  const { dataMap, current } = await getData()
  const result = {
    info: {
      export_timestamp: Math.ceil(Date.now() / 1000),
      export_app: `${name}`,
      export_app_version: `v${version}`,
      version: "v4.0"
    },
    hk4e: []
  }
  let fulldata = []
  uids.forEach(uid => {
    fulldata.push(dataMap.get(uid))
  })
  if (!fulldata.length) {
    throw new Error('数据为空')
  }
  fulldata.forEach(data => {
    const listTemp = []
    for (let [type, arr] of data.result) {
      arr.forEach(log => {
        listTemp.push({
          gacha_id: log.gacha_id,
          gacha_type: log.gacha_type,
          item_id: log.item_id || '',
          count: log.count,
          time: log.time,
          name: log.name,
          item_type: log.item_type,
          rank_type: log.rank_type,
          id: log.id
        })
      })
    }
    listTemp.sort((a, b) => Number(BigInt(a.id || 0) - BigInt(b.id || 0)))
    result.hk4e.push({
      uid: data.uid,
      timezone: data.region_time_zone,
      lang: data.lang,
      list: listTemp
    })
  })
  const filePath = dialog.showSaveDialogSync({
    defaultPath: path.join(app.getPath('downloads'), fulldata.length > 1 ? `UIGF_${getTimeString()}` : `UIGF_${fulldata[0].uid}_${getTimeString()}`),
    filters: [
      { name: i18n.uigf.fileType, extensions: ['json'] }
    ]
  })
  if (filePath) {
    await fs.ensureFile(filePath)
    await fs.writeFile(filePath, JSON.stringify(result))
  }
}

const parseData = (uidData, dataMap) => {
  const resultTemp = []
  const isNew = !Boolean(dataMap.has(uidData.uid))

  let targetLang
  if (!isNew) targetLang = dataMap.get(uidData.uid).lang
  else targetLang = uidData.lang

  uidData.list.forEach(recordEntry => {
    resultTemp.push({
      gacha_id: recordEntry.gacha_id ?? recordEntry.gacha_type,
      gacha_type: recordEntry.gacha_type,
      item_id: recordEntry.item_id || '',
      count: recordEntry.count ?? "1",
      time: recordEntry.time,
      name: recordEntry.name,
      item_type: recordEntry.item_type,
      rank_type: recordEntry.rank_type,
      id: recordEntry.id
    })
  })
  const resultTempGrouped = resultTemp.reduce((acc, curr) => {
    if (!acc[curr.gacha_type]) {
      acc[curr.gacha_type] = []
    }
    acc[curr.gacha_type].push(curr)
    return acc
  }, {})
  const resultTempMap = new Map(Object.entries(resultTempGrouped))
  const resultMap = { result: resultTempMap, uid: uidData.uid }
  let data
  const mergedData = mergeData(dataMap.get(uidData.uid), resultMap)
  if (isNew) {
    data = { result: mergedData, time: Date.now(), uid: uidData.uid, lang: targetLang, region_time_zone: uidData.timezone, deleted: false }
  } else {
    data = { result: mergedData, time: Date.now(), uid: dataMap.get(uidData.uid).uid, lang: targetLang, region_time_zone: dataMap.get(uidData.uid).region_time_zone, deleted: dataMap.get(uidData.uid).deleted }
  }

  saveData(data)
  changeCurrent(uidData.uid)
  dataMap.set(uidData.uid, data)
}

const importData = async (jsonData) => {
  if (!('info' in jsonData && 'version' in jsonData.info)) {
    sendMsg('UIGF格式错误')
    return false
  }
  if (jsonData.info.version !== 'v4.0' && jsonData.info.version !== 'v4.1') {
    sendMsg('不支持此版本UIGF')
    return false
  }
  const { dataMap } = getData()
  jsonData.hk4e.forEach(uidData => {
    parseData(uidData, dataMap)
  })
  return true
}

module.exports = { uigfKey: 'hk4e', exportUIGF, importData }
