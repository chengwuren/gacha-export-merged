import * as IconComponents from '@element-plus/icons-vue'

const toSet = (list) => new Set(list || [])

// 按当前游戏的物品类型词表生成判断函数
const getTypeHelpers = (gameInfo) => {
  const itemTypes = gameInfo?.renderer?.itemTypes || {}
  const weaponTypeNames = toSet(itemTypes.weapon)
  const characterTypeNames = toSet(itemTypes.character)
  const bangbooTypeNames = toSet(itemTypes.bangboo)
  return {
    isCharacter: (name) => characterTypeNames.has(name),
    isWeapon: (name) => weaponTypeNames.has(name),
    isBangboo: (name) => bangbooTypeNames.has(name)
  }
}

const IconInstaller = (app) => {
  Object.values(IconComponents).forEach(component => {
    app.component(component.name, component)
  })
}

export {
  getTypeHelpers,
  IconInstaller,
}
