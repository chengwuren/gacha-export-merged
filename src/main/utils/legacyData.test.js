const { detectDataGame, normalizeGenshinRow } = require('./legacyData')

// 与 src/games 的注册顺序一致(genshin 在前,影响平局判定)
const games = [
  { id: 'genshin', gacha: { poolKeys: ['301', '302', '400', '500', '200', '100'], rankMax: '5' } },
  { id: 'starrail', gacha: { poolKeys: ['11', '12', '1', '2', '21', '22'], rankMax: '5' } },
  { id: 'zzz', gacha: { poolKeys: ['2', '3', '1', '5', '102', '103'], rankMax: '4' } }
]

const objFile = (keys, rank, extra = {}) => ({
  result: keys.map(k => [k, [{ ...extra, rank_type: String(rank), id: '1' }]])
})

describe('detectDataGame 旧数据归属识别', () => {
  test('空/畸形数据返回 null', () => {
    expect(detectDataGame(null, games)).toBeNull()
    expect(detectDataGame({}, games)).toBeNull()
    expect(detectDataGame({ result: [] }, games)).toBeNull()
    expect(detectDataGame({ result: [['1', []]] }, games)).toBeNull()
  })

  test('数组行识别为旧原神', () => {
    const data = { result: [['301', [['2024-01-01 00:00:00', 'x', '角色', 5, '301', '1']]]] }
    expect(detectDataGame(data, games)).toBe('genshin')
  })

  test('SR 池 + 五星 → starrail', () => {
    expect(detectDataGame(objFile(['11', '12', '1', '2'], 5), games)).toBe('starrail')
  })

  test('SR 池 + 四星上限 → zzz(精确 rankMax 匹配优先)', () => {
    expect(detectDataGame(objFile(['1', '2'], 4), games)).toBe('zzz')
  })

  test('zzz 专属池 → zzz', () => {
    expect(detectDataGame(objFile(['2', '3', '5', '102', '103'], 4), games)).toBe('zzz')
  })

  test('原神池 → genshin', () => {
    expect(detectDataGame(objFile(['301', '302', '500'], 5), games)).toBe('genshin')
  })

  test('未知池返回 null', () => {
    expect(detectDataGame(objFile(['999'], 5), games)).toBeNull()
  })
})

describe('normalizeGenshinRow 旧原神数组转对象', () => {
  test('字段映射与类型归一', () => {
    const row = normalizeGenshinRow(['2024-01-01 08:00:00', '护摩之杖', '武器', 5, '302', '1700000000000000001'])
    expect(row).toEqual({
      id: '1700000000000000001',
      item_id: '',
      item_type: '武器',
      name: '护摩之杖',
      rank_type: '5',
      time: '2024-01-01 08:00:00',
      gacha_id: '302',
      gacha_type: '302',
      count: '1'
    })
  })
})
