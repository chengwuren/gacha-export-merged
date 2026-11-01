import { getTypeHelpers } from './utils'

const itemCount = (map, name) => {
  if (!map.has(name)) {
    map.set(name, 1)
  } else {
    map.set(name, map.get(name) + 1)
  }
}

// gameInfo.renderer.order 决定卡池展示顺序
const gachaDetail = (data, gameInfo) => {
  if (!data) return
  const order = gameInfo?.renderer?.order
  if (!order) return
  const { isWeapon, isCharacter, isBangboo } = getTypeHelpers(gameInfo)
  const rankMax = gameInfo?.renderer?.rankMax || '5'
  const topRank = Number(rankMax)
  const detailMap = new Map()
  for (let key of order) {
    if (!data.has(key)) continue
    let value = data.get(key)
    // 各星级计数与分类计数(2~rankMax),zzz 的邦布也纳入
    const ranks = []
    for (let r = 2; r <= topRank; r++) {
      ranks.push(String(r))
    }
    let detail = {
      date: [],
      ssrPos: [], countMio: 0, total: value.length,
    }
    ranks.forEach(r => {
      detail[`count${r}`] = 0
      detail[`count${r}w`] = 0
      detail[`count${r}c`] = 0
      detail[`count${r}b`] = 0
      detail[`weapon${r}`] = new Map()
      detail[`char${r}`] = new Map()
      detail[`bang${r}`] = new Map()
    })
    let lastSSR = 0
    let dateMin = 0
    let dateMax = 0
    value.forEach((item, index) => {
      const { time, name, item_type: type, rank_type: rank } = item
      const timestamp = new Date(time).getTime()
      if (!dateMin) dateMin = timestamp
      if (!dateMax) dateMax = timestamp
      if (dateMin > timestamp) dateMin = timestamp
      if (dateMax < timestamp) dateMax = timestamp
      detail.countMio++
      if (isWeapon(type)) {
        detail[`count${rank}w`]++
        itemCount(detail[`weapon${rank}`], name)
      } else if (isBangboo(type)) {
        detail[`count${rank}b`]++
        itemCount(detail[`bang${rank}`], name)
      } else if (isCharacter(type)) {
        detail[`count${rank}c`]++
        itemCount(detail[`char${rank}`], name)
      }
      detail[`count${rank}`]++
      if (Number(rank) === topRank) {
        detail.ssrPos.push([name, index + 1 - lastSSR, time, key])
        lastSSR = index + 1
        detail.countMio = 0
      }
    })
    detail.date = [dateMin, dateMax]
    if (detail.total) {
      detailMap.set(key, detail)
    }
  }
  return detailMap
}

export default gachaDetail
