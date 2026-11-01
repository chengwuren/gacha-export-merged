const config = require('./config')
const isPlainObject = require('lodash/isPlainObject')
const { getGame } = require('../games')

const addProp = (obj, key) => {
  if (isPlainObject(obj[key])) {
    return obj[key]
  } else if (typeof obj[key] === 'undefined') {
    let temp = {}
    obj[key] = temp
    return temp
  }
}

const parseData = (data) => {
  const result = {}
  for (let key in data) {
    let temp = result
    const arr = key.split('.')
    arr.forEach((prop, index) => {
      if (index === arr.length - 1) {
        temp[prop] = data[key]
      } else {
        temp = addProp(temp, prop)
      }
    })
  }
  return result
}

const assignData = (objA, objB) => {
  const temp = { ...objA }
  for (let key in objB) {
    if (objB[key]) {
      temp[key] = objB[key]
    }
  }
  return temp
}

// 每个游戏一套 i18n(语言包随游戏放在 games/<id>/i18n/),按需构建并缓存
const i18nCache = new Map()
const getI18nMap = (game = getGame()) => {
  if (i18nCache.has(game.id)) {
    return i18nCache.get(game.id)
  }
  const raw = game.i18nMap
  const i18nMap = new Map()
  for (let key in raw) {
    let temp = {}
    if (key === 'zh-tw') {
      temp = assignData(raw['zh-cn'], raw[key])
    } else {
      temp = assignData(raw['zh-cn'], assignData(raw['en-us'], raw[key]))
    }
    i18nMap.set(key, parseData(temp))
  }
  i18nCache.set(game.id, i18nMap)
  return i18nMap
}

// 当前游戏没有该语言包时回退 en-us,再回退 zh-cn
const getLangData = () => {
  const i18nMap = getI18nMap()
  return i18nMap.get(config.lang) || i18nMap.get('en-us') || i18nMap.get('zh-cn')
}

const parseText = (text, data) => {
  return text.replace(/(\${.+?})/g, function (...args) {
    const key = args[0].slice(2, args[0].length - 1)
    if (data[key]) return data[key]
    return args[0]
  })
}

const mainProps = [
  'symbol', 'ui', 'log', 'excel', 'uigf'
]

const i18n = new Proxy({}, {
  get (obj, prop) {
    if (prop === 'data') {
      return getLangData()
    } else if (mainProps.includes(prop)) {
      return getLangData()[prop]
    } else if (prop === 'parse') {
      return parseText
    }
    return obj[prop]
  }
})

module.exports = i18n
