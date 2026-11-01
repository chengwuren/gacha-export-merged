const { app, BrowserWindow, ipcMain } = require('electron')
const { initWindow } = require('./utils')
const { disableProxy, proxyStatus } = require('./module/system-proxy')
const config = require('./config')
const { setGame } = require('../games')
require('./getData')
require('./bridge')
require('./excel')
require('./UIGFJson')
const { getUpdateInfo } = require('./update/index')

const isDev = !app.isPackaged
let win = null

// 开发模式留一个渲染层调试端口,界面真·无响应时可远程抓调用栈
if (isDev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9223')
}

function createWindow() {
  win = initWindow()
  win.setMenuBarVisibility(false)
  isDev ? win.loadURL(`http://localhost:${process.env.PORT}`) : win.loadFile('dist/electron/renderer/index.html')
  if (isDev) {
    win.webContents.openDevTools({ mode: 'undocked', activate: true })
  }
}

const isFirstInstance = app.requestSingleInstanceLock()

if (!isFirstInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    // 恢复上次使用的游戏(config 异步加载,这里才可靠)
    if (config.currentGame) {
      setGame(config.currentGame)
    }
    createWindow()
  })

  ipcMain.handle('RELAUNCH', async () => {
    app.relaunch()
    app.exit(0)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  app.on('will-quit', (e) => {
    if (proxyStatus.started) {
      disableProxy()
    }
    if (getUpdateInfo().status === 'moving') {
      e.preventDefault()
      setTimeout(() => {
        app.quit()
      }, 3000)
    }
  })

  app.on('quit', () => {
    if (proxyStatus.started) {
      disableProxy()
    }
  })
}