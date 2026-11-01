#!/usr/bin/env node
// 全链路 E2E:合成三游戏数据 → 启动 dev 应用 → CDP 驱动真实界面跑场景
// 用法:node tools/e2e-test.mjs  (会自动管理 dev 进程;结束后恢复原 userData)
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const userData = path.join(root, 'dist', 'userData')
const backup = path.join(root, 'dist', `userData.bak-${Date.now()}`)
let pageTarget = null
let ws = null
let msgId = 0
const pendingMsgs = new Map()
const consoleErrors = []
const failures = []

const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}`)
  if (!cond) failures.push(label)
}

const killElectron = () => {
  try { execSync('taskkill /IM electron.exe /F /T', { stdio: 'ignore' }) } catch (e) {}
  try {
    execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match 'dev-runner' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`, { stdio: 'ignore' })
  } catch (e) {}
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ---------- 合成数据 ----------
const pad = (n) => String(n).padStart(19, '0')
let idSeed = 1000000000000000000n
const rec = (game, name, itemType, rank, pool, daysAgo) => {
  idSeed += 1n
  const d = new Date(Date.now() - daysAgo * 86400000)
  const time = d.toISOString().slice(0, 19).replace('T', ' ')
  return { id: pad(idSeed), item_id: '', item_type: itemType, name, rank_type: String(rank), time, gacha_id: pool, gacha_type: pool, count: '1' }
}
const names = {
  genshin: { char: ['钟离', '胡桃', '行秋'], weapon: ['护摩之杖', '匣里灭辰', '弹弓'] },
  starrail: { char: ['三月七', '丹恒', '娜塔莎'], weapon: ['于夜色中', '今日亦有和平', '俱利鼓'] },
  zzz: { char: ['艾莲', '朱鸢', '安比'], weapon: ['深海访客', '拘缚者', '贵重金属'], bang: ['鲨鱼布', '巴特勒', '企鹅布'] }
}
const typeWords = {
  genshin: { char: '角色', weapon: '武器' },
  starrail: { char: '角色', weapon: '光锥' },
  zzz: { char: '代理人', weapon: '音擎', bang: '邦布' }
}
const makeAccount = (game, uid, pools) => {
  const gachaType = JSON.parse(fs.readFileSync(path.join(root, 'src', 'games', game, 'gachaType.json'), 'utf8'))
  const zhList = (Array.isArray(gachaType) ? gachaType : Object.entries(gachaType)).find(([l]) => l === 'zh-cn')[1]
  const result = pools.map(({ pool, items }) => [pool, items])
  return {
    result,
    typeMap: zhList.filter(t => pools.some(p => p.pool === t.key)).map(t => [t.key, t.name]),
    time: Date.now(), uid: String(uid), lang: 'zh-cn', region: 'prod_gf_cn', region_time_zone: 8
  }
}
// 每游戏两个账号;账号2 的卡池少一些,用于验证账号切换
const poolsFor = (game, small) => {
  const w = typeWords[game]
  const mk = (pool, kinds) => {
    const items = []
    kinds.forEach(([rank, kind, cnt], idx) => {
      for (let i = 0; i < cnt; i++) items.push(rec(game, names[game][kind][i % 3], w[kind], rank, pool, idx * 3 + i))
    })
    return { pool, items }
  }
  if (game === 'starrail') return small
    ? [mk('11', [[5, 'char', 2], [4, 'char', 4]])]
    : [mk('11', [[5, 'char', 2], [4, 'char', 6]]), mk('12', [[5, 'weapon', 1], [4, 'weapon', 5]]), mk('1', [[5, 'char', 1], [4, 'weapon', 4], [3, 'weapon', 8]]), mk('2', [[5, 'char', 1], [4, 'char', 3], [3, 'weapon', 6]])]
  if (game === 'zzz') return small
    ? [mk('2', [[4, 'char', 2]])]
    : [mk('2', [[4, 'char', 4], [3, 'char', 8]]), mk('3', [[4, 'weapon', 3], [3, 'weapon', 7]]), mk('1', [[4, 'char', 2], [3, 'weapon', 6]]), mk('5', [[4, 'bang', 3], [3, 'bang', 5]]), mk('102', [[4, 'char', 1]]), mk('103', [[4, 'weapon', 1]])]
  return small
    ? [mk('301', [[5, 'char', 2]])]
    : [mk('301', [[5, 'char', 2], [4, 'char', 7]]), mk('302', [[5, 'weapon', 1], [4, 'weapon', 5]]), mk('500', [[5, 'char', 1], [4, 'char', 3]]), mk('200', [[4, 'weapon', 6], [3, 'weapon', 9]]), mk('100', [[4, 'char', 2], [3, 'weapon', 8]])]
}
const writeData = (game, uid, pools) => {
  const dir = path.join(userData, game)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `gacha-list-${uid}.json`), JSON.stringify(makeAccount(game, uid, pools)))
}

// ---------- CDP ----------
const evalJS = async (expr) => {
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (res?.exceptionDetails) throw new Error('eval: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text))
  return res?.result?.value
}
const send = (method, params) => new Promise(res => {
  const i = ++msgId
  pendingMsgs.set(i, res)
  ws.send(JSON.stringify({ id: i, method, params }))
})
const state = () => evalJS(`(() => { const s = document.querySelector('#app').__vue_app__._instance.setupState.state
  return JSON.stringify({ gameId: s.gameId, status: s.status, lang: s.config ? s.config.lang : null, gameName: s.gameInfo && s.gameInfo.name, current: String(s.current), dataMapSize: s.dataMap ? s.dataMap.size : -1 }) })()`).then(JSON.parse)
const domRing = () => evalJS(`JSON.stringify([...document.querySelectorAll('img.rounded-full')].filter(i => i.className.includes('ring')).map(i => i.alt))`).then(JSON.parse)
const blockCount = () => evalJS(`document.querySelectorAll('.grid > div').length`)
const setLang = async (lang) => {
  await evalJS(`require('electron').ipcRenderer.invoke('SAVE_CONFIG', ['lang', '${lang}'])`)
  await evalJS(`(async () => { document.querySelector('#app').__vue_app__._instance.setupState.state.i18n = await require('electron').ipcRenderer.invoke('I18N_DATA') })()`)
}
const applyConfigToView = async () => {
  await evalJS(`(async () => { document.querySelector('#app').__vue_app__._instance.setupState.state.config = await require('electron').ipcRenderer.invoke('GET_CONFIG') })()`)
}
const switchGame = (id) => evalJS(`document.querySelector('#app').__vue_app__._instance.setupState.changeGame('${id}')`)
const GAME_ALT = { genshin: '原神', starrail: '崩坏：星穹铁道', zzz: '绝区零' }
const refreshData = async () => {
  await evalJS(`(async () => {
    const s = document.querySelector('#app').__vue_app__._instance.setupState
    const d = await require('electron').ipcRenderer.invoke('READ_DATA')
    s.state.dataMap = d.dataMap
    s.state.current = d.current
    if (d.dataMap.get(d.current) && s.state.status !== 'loading') s.state.status = 'loaded'
  })()`)
}

const waitApp = async () => {
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch('http://127.0.0.1:9223/json')).json()
      const page = targets.find(t => t.type === 'page' && t.url.includes('localhost:9080') && !/DevTools/i.test(t.title))
      if (page) {
        pageTarget = page
        ws = new WebSocket(page.webSocketDebuggerUrl)
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
        ws.addEventListener('message', ev => {
          const m = JSON.parse(ev.data)
          if (m.id && pendingMsgs.has(m.id)) { pendingMsgs.get(m.id)(m.result); pendingMsgs.delete(m.id) }
          if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text)
          if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map(a => (a.value || a.description || '') + '').join(' ').split('\n')[0])
        })
        await send('Runtime.enable')
        for (let i = 0; i < 30; i++) {
          const ready = await evalJS(`!!document.querySelector('#app').__vue_app__`)
          if (ready) return
          await sleep(500)
        }
      }
    } catch (e) {}
    await sleep(2000)
  }
  throw new Error('dev 应用 120s 内未就绪')
}

// ---------- 场景 ----------
try {
  console.log('== 准备:备份数据目录、写入合成数据 ==')
  killElectron()
  await sleep(1500)
  if (fs.existsSync(userData)) fs.renameSync(userData, backup)
  writeData('starrail', 900000001, poolsFor('starrail'))
  writeData('starrail', 900000002, poolsFor('starrail', true))
  writeData('zzz', 900000011, poolsFor('zzz'))
  writeData('zzz', 900000012, poolsFor('zzz', true))
  writeData('genshin', 900000021, poolsFor('genshin'))
  writeData('genshin', 900000022, poolsFor('genshin', true))

  console.log('== 启动 dev 应用 ==')
  spawn('cmd.exe', ['/d', '/s', '/c', 'yarn dev'], { cwd: root, detached: true, stdio: 'ignore' }).unref()
  await waitApp()
  await sleep(1500)

  console.log('== S1 星铁默认加载 ==')
  let s = await state()
  ok(s.gameId === 'starrail' && s.status === 'loaded', `默认星铁 loaded (gameId=${s.gameId}, status=${s.status})`)
  ok(s.dataMapSize === 2, `两账号载入 (size=${s.dataMapSize})`)
  ok((await domRing())[0] === '崩坏：星穹铁道', '图标选中正确')
  const blocksSR = await blockCount()
  ok(blocksSR === 4, `四卡池渲染 (blocks=${blocksSR})`)
  ok(await evalJS(`document.querySelectorAll('.grid canvas').length`) >= 4, '饼图 canvas 已绘制')
  ok((await evalJS(`document.title`)).includes('崩坏'), '标题含游戏名')

  console.log('== S2 新手池隐藏开关 ==')
  await evalJS(`require('electron').ipcRenderer.invoke('SAVE_CONFIG', ['hideNovice', true])`)
  await applyConfigToView()
  await sleep(300)
  const visibleBlocks = () => evalJS(`document.querySelectorAll('.grid > div > div:not(.hidden)').length`)
  ok(await visibleBlocks() === 3, `隐藏后可见 3 池 (visible=${await visibleBlocks()})`)
  await evalJS(`require('electron').ipcRenderer.invoke('SAVE_CONFIG', ['hideNovice', false])`)
  await applyConfigToView()
  await sleep(300)
  ok(await visibleBlocks() === 4, `恢复后可见 4 池 (visible=${await visibleBlocks()})`)

  console.log('== S3 账号切换(星铁)==')
  await evalJS(`require('electron').ipcRenderer.invoke('CHANGE_UID', '900000002')`)
  await evalJS(`(async () => { document.querySelector('#app').__vue_app__._instance.setupState.state.current = '900000002' })()`)
  await sleep(600)
  s = await state()
  ok(s.current === '900000002' && (await blockCount()) === 1, `切到账号2 (current=${s.current}, blocks=${await blockCount()})`)
  await evalJS(`require('electron').ipcRenderer.invoke('CHANGE_UID', '900000001')`)
  await evalJS(`(async () => { document.querySelector('#app').__vue_app__._instance.setupState.state.current = '900000001' })()`)
  await sleep(600)

  console.log('== S4 删除/恢复账号 ==')
  await evalJS(`require('electron').ipcRenderer.invoke('DELETE_DATA', '900000001', true)`)
  await refreshData()
  await sleep(500)
  s = await state()
  ok(s.dataMapSize === 2 && s.status === 'loaded', `删除后标记 deleted (dataMap size=${s.dataMapSize})`)
  ok(await evalJS(`(() => { const s = document.querySelector('#app').__vue_app__._instance.setupState; let n = 0; for (const [k, v] of s.state.dataMap) if (v.deleted) n++; return n })()`) === 1, 'deleted 标记生效')
  ok(await evalJS(`(() => { const c = document.querySelector('#app').__vue_app__._instance.setupState; let n = 0; for (const [k, v] of c.state.dataMap) if (!v.deleted) n++; return n })()`) === 1, '界面数据源只剩 1 个有效账号')
  await evalJS(`require('electron').ipcRenderer.invoke('DELETE_DATA', '900000001', false)`)
  await refreshData()
  await sleep(400)

  console.log('== S5 切到绝区零 ==')
  await switchGame('zzz')
  await sleep(1200)
  s = await state()
  ok(s.gameId === 'zzz' && s.status === 'loaded' && s.dataMapSize === 2, `zzz 加载 (status=${s.status}, size=${s.dataMapSize})`)
  ok((await domRing())[0] === '绝区零', '图标选中正确')
  ok(await blockCount() === 6, `六卡池渲染 (blocks=${await blockCount()})`)

  console.log('== S6 切到原神 ==')
  await switchGame('genshin')
  await sleep(1200)
  s = await state()
  ok(s.gameId === 'genshin' && s.status === 'loaded', `genshin 加载 (status=${s.status})`)
  ok((await domRing())[0] === '原神', '图标选中正确')
  ok(await blockCount() === 5, `五卡池渲染 (blocks=${await blockCount()})`)

  console.log('== S7 语言切换与回退 ==')
  await setLang('en-us')
  await sleep(500)
  const enLoad = await evalJS(`(() => { const s = document.querySelector('#app').__vue_app__._instance.setupState.state; return s.i18n.ui.button.load })()`)
  ok(typeof enLoad === 'string' && enLoad.length > 0 && enLoad !== '加载数据', `英文文案已切换 (${enLoad})`)
  await setLang('ja-jp')
  await sleep(500)
  const jaLoad = await evalJS(`document.querySelector('#app').__vue_app__._instance.setupState.state.i18n.ui.button.load`)
  ok(typeof jaLoad === 'string' && jaLoad.length > 0, `原神日语回退可用 (${jaLoad})`)
  await switchGame('zzz')
  await sleep(1000)
  const zzzJa = await evalJS(`document.querySelector('#app').__vue_app__._instance.setupState.state.i18n.ui.button.load`)
  ok(typeof zzzJa === 'string' && zzzJa.length > 0, `zzz 无日语包时回退英文 (${zzzJa})`)
  await setLang('zh-cn')
  await switchGame('genshin')
  await sleep(1000)

  console.log('== S8 快速连切抗竞态 ==')
  for (const g of ['zzz', 'starrail', 'genshin', 'zzz', 'genshin', 'starrail', 'zzz', 'genshin', 'starrail', 'genshin']) {
    switchGame(g)
    await sleep(80)
  }
  await sleep(2500)
  s = await state()
  const ring = await domRing()
  ok(ring[0] === GAME_ALT[s.gameId], `终态一致 (state=${s.gameId}, dom=${ring[0]})`)
  ok(s.status === 'loaded' && s.dataMapSize === 2, `终态数据完好 (status=${s.status})`)
  ok(await blockCount() === 5, `终态渲染完好 (blocks=${await blockCount()})`)

  console.log('== S9 渲染层零异常 ==')
  ok(consoleErrors.length === 0, `console/异常计数 = ${consoleErrors.length}${consoleErrors.length ? ' → ' + consoleErrors.slice(0, 3).join(' | ') : ''}`)

  console.log(failures.length ? `\n结果: ${failures.length} 项失败` : '\n结果: 全部通过 ✓')
  process.exitCode = failures.length ? 1 : 0
} catch (e) {
  console.error('E2E 执行异常:', e.message)
  process.exitCode = 1
} finally {
  try { ws && ws.close() } catch (e) {}
  killElectron()
  await sleep(1200)
  try {
    if (fs.existsSync(backup)) {
      fs.rmSync(userData, { recursive: true, force: true })
      fs.renameSync(backup, userData)
      console.log('原 userData 已恢复')
    }
  } catch (e) { console.error('恢复 userData 失败:', e.message) }
}
