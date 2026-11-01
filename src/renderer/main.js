import { createApp } from 'vue'
import App from './App.vue'
import './index.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { IconInstaller } from './utils'
const { ipcRenderer } = require('electron')

const app = createApp(App)
// 渲染层任何异常都上报到主进程 log.txt,不允许静默冻死渲染队列
app.config.errorHandler = (err, instance, info) => {
  console.error(err, info)
  try { ipcRenderer.send('RENDERER_LOG', `${info}: ${err && err.stack}`) } catch (e) {}
}
app.use(ElementPlus)
IconInstaller(app)
app.mount('#app')
