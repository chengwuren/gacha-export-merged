// 旧版单游戏数据的识别与转换(纯函数,不依赖 electron,便于单测)
// 旧原神:行是数组 [time, name, item_type, rank(int), gacha_type, id]
// 旧星铁/绝区零:行是对象,池 key 在各游戏 poolKeys 内

const detectDataGame = (data, games) => {
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
  const candidates = games.filter(g => keys.every(k => g.gacha.poolKeys.includes(k)))
  if (!candidates.length) return null
  const exact = candidates.filter(g => Number(g.gacha.rankMax) === maxRank)
  if (exact.length === 1) return exact[0].id
  const fits = candidates.filter(g => Number(g.gacha.rankMax) >= maxRank)
  return (fits[0] || candidates[0]).id
}

const normalizeGenshinRow = (item) => {
  const [time, name, item_type, rank_type, gacha_type, id] = item
  return { id, item_id: '', item_type, name, rank_type: String(rank_type), time, gacha_id: gacha_type, gacha_type, count: '1' }
}

module.exports = { detectDataGame, normalizeGenshinRow }
