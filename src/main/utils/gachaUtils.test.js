const { convertTimeZone } = require('./gachaUtils')

describe('convertTimeZone 时区换算', () => {
  test('+8 → UTC', () => {
    expect(convertTimeZone('2024-01-01 08:00:00', 8, 0)).toBe('2024-01-01 00:00:00')
  })

  test('+8 → 美服(-5),跨天', () => {
    expect(convertTimeZone('2024-01-01 08:00:00', 8, -5)).toBe('2023-12-31 19:00:00')
  })

  test('相同偏移原样返回', () => {
    expect(convertTimeZone('2024-06-15 23:30:59', 8, 8)).toBe('2024-06-15 23:30:59')
  })

  test('补零宽度正确', () => {
    expect(convertTimeZone('2024-11-02 01:02:03', -5, 8)).toBe('2024-11-02 14:02:03')
  })
})
