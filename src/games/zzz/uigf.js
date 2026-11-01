// 绝区零 UIGF v4 导入/导出(移植自 zzz-signal-search-export 的 UIGFJson.js)
const { dialog, app } = require('electron')
const fs = require('fs-extra')
const path = require('path')
const { getData, saveData, changeCurrent, convertTimeZone } = require('../../main/getData')
const config = require('../../main/config')
const { name, version } = require('../../../package.json')
const i18n = require('../../main/i18n')
const { mergeData } = require('../../main/utils/mergeData')
const { sendMsg } = require('../../main/utils')
const idJson = require('./idJson.json')

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
    nap: []
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
          item_id: log.item_id,
          count: log.count,
          time: log.time,
          name: log.name,
          item_type: log.item_type,
          rank_type: log.rank_type,
          id: log.id
        })
      })
    }
    listTemp.sort((a, b) => Number(BigInt(a.id) - BigInt(b.id)))
    result.nap.push({
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

  let region_time_zone
  if (!isNew) region_time_zone = dataMap.get(uidData.uid).region_time_zone
  else region_time_zone = uidData.timezone

  let targetLang
  if (!isNew) targetLang = dataMap.get(uidData.uid).lang
  else targetLang = uidData.lang
  if(!idJson[targetLang] && (!uidData.list[0].name || !uidData.list[0].item_type || !uidData.list[0].rank_type)) targetLang = config.lang

  let idTargetLangJson = idJson[targetLang]

  uidData.list.forEach(recordEntry => {
    let rank_type
    if (idTargetLangJson?.[recordEntry.item_id].rank_type) rank_type = String(idTargetLangJson[recordEntry.item_id].rank_type)
    else rank_type = recordEntry.rank_type
    resultTemp.push({
      gacha_id: recordEntry.gacha_id,
      gacha_type: recordEntry.gacha_type,
      item_id: recordEntry.item_id,
      count: recordEntry.count ?? "1",
      time: convertTimeZone(recordEntry.time, uidData.timezone, region_time_zone),
      name: idTargetLangJson?.[recordEntry.item_id].name ?? recordEntry.name,
      item_type: idTargetLangJson?.[recordEntry.item_id].item_type ?? recordEntry.item_type,
      rank_type: rank_type,
      id: recordEntry.id
    })
  })
  const resultTempGrouped = resultTemp.reduce((acc, curr) => {
    if (!acc[curr.gacha_type]) {
      acc[curr.gacha_type] = []
    }
    acc[curr.gacha_type].push(curr)
    return acc;
  }, {})
  const resultTempMap = new Map(Object.entries(resultTempGrouped))
  const resultMap = { result: resultTempMap, uid: uidData.uid}
  let data
  const mergedData = mergeData(dataMap.get(uidData.uid), resultMap)
  if (isNew) {
    data = { result: mergedData, time: Date.now(), uid: uidData.uid, lang: targetLang, region_time_zone: uidData.timezone, deleted: false }
  } else {
    data = { result: mergedData, time: Date.now(), uid: dataMap.get(uidData.uid).uid, lang: targetLang, region_time_zone: dataMap.get(uidData.uid).region_time_zone, deleted: dataMap.get(uidData.uid).deleted }
  }

  saveData(data, '')
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
  jsonData.nap.forEach(uidData => {
    parseData(uidData, dataMap)
  })
  return true
}

module.exports = { uigfKey: 'nap', exportUIGF, importData }
