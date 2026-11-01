// 纯函数语言检测(不依赖 electron),供注册表和各 game.js 使用,避免循环引用
const localeMap = new Map([
  ['zh-cn', ['zh', 'zh-CN']],
  ['zh-tw', ['zh-TW']],
  ['de-de', ['de-AT', 'de-CH', 'de-DE', 'de']],
  ['en-us', ['en-AU', 'en-CA', 'en-GB', 'en-NZ', 'en-US', 'en-ZA', 'en']],
  ['es-es', ['es', 'es-419']],
  ['fr-fr', ['fr-CA', 'fr-CH', 'fr-FR', 'fr']],
  ['id-id', ['id']],
  ['ja-jp', ['ja']],
  ['ko-kr', ['ko']],
  ['pt-pt', ['pt-BR', 'pt-PT', 'pt']],
  ['ru-ru', ['ru']],
  ['th-th', ['th']],
  ['vi-vn', ['vi']]
])

const detectLocale = (value) => {
  if (!value) return 'zh-cn'
  for (let [key, list] of localeMap) {
    if (value === key || list.includes(value)) {
      return key
    }
  }
  return 'zh-cn'
}

module.exports = detectLocale
