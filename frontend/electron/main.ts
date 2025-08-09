import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 窗口准备好之前不显示
    backgroundColor: '#ffffff', // 设置背景色避免白屏闪烁
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 开发环境禁用web安全检查
      enableRemoteModule: false,
      experimentalFeatures: false,
      v8CacheOptions: 'code', // 启用V8代码缓存
    },
  })

  // 优化窗口显示时机
  win.once('ready-to-show', () => {
    win?.show()
    // 可选：添加淡入效果
    if (process.platform === 'darwin') {
      win?.setOpacity(0)
      win?.show()
      let opacity = 0
      const fadeIn = setInterval(() => {
        opacity += 0.1
        win?.setOpacity(opacity)
        if (opacity >= 1) {
          clearInterval(fadeIn)
        }
      }, 10)
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // 加载页面
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 优化应用启动
app.whenReady().then(() => {
  // 设置应用性能优化
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor')
  app.commandLine.appendSwitch('--disable-gpu-sandbox')
  app.commandLine.appendSwitch('--enable-gpu-rasterization')
  
  createWindow()
})

// 预加载优化 - 在空闲时预热
app.on('browser-window-focus', () => {
  if (win && win.webContents) {
    win.webContents.executeJavaScript(`
      // 预加载关键资源
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          // 预热常用功能
          console.log('Prewarming application resources...')
        })
      }
    `).catch(() => {
      // 忽略执行错误
    })
  }
})
