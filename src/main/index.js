import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// 注意：后续可以集成真实的 MAVLink 库
// import { MAVLinkModule } from 'node-mavlink'

function createWindow() {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // === MAVLink 地面站核心逻辑 ===

  // 1. 设置 IPC 通用消息监听
  ipcMain.handle('connect-device', async (event, deviceId) => {
    console.log(`正在连接设备: ${deviceId}...`)
    // 这里可以添加真实的串口或TCP连接逻辑
    return { status: 'success', msg: '设备已连接' }
  })

  // 2. 启动 MAVLink 数据模拟器
  function startMavlinkSimulator() {
    // 固定位置（北京天安门）
    const latitude = 39.9042
    const longitude = 116.4074
    let altitude = 120
    let heading = 0
    let groundSpeed = 0 // 悬停，速度为0
    let battery = 92
    let roll = 0
    let pitch = 0
    let yaw = 0

    // 每 100ms 发送一次模拟的 MAVLink 数据
    setInterval(() => {
      // 模拟轻微的姿态变化（悬停时的微小抖动）
      roll = (Math.random() - 0.5) * 0.05 // ±0.05 弧度
      pitch = (Math.random() - 0.5) * 0.05
      yaw = (Math.random() - 0.5) * 0.02

      // 模拟轻微的高度变化
      altitude = 120 + (Math.random() - 0.5) * 0.5

      // 慢速电池消耗
      if (Math.random() < 0.005) {
        battery = Math.max(0, battery - 0.1)
      }

      // 模拟的 MAVLink 数据包
      const mavlinkData = {
        type: 'GLOBAL_POSITION_INT',
        timestamp: Date.now(),
        latitude: (latitude * 1e7).toFixed(0), // MAVLink uses lat/lon * 1e7
        longitude: (longitude * 1e7).toFixed(0),
        altitude: (altitude * 1000).toFixed(0), // mm
        relative_alt: (altitude * 1000).toFixed(0),
        vx: 0,
        vy: 0,
        vz: 0,
        heading: (heading * 100).toFixed(0) // centidegrees
      }

      const attitudeData = {
        type: 'ATTITUDE',
        timestamp: Date.now(),
        roll: roll,
        pitch: pitch,
        yaw: yaw,
        rollspeed: 0,
        pitchspeed: 0,
        yawspeed: 0
      }

      const vfrHudData = {
        type: 'VFR_HUD',
        timestamp: Date.now(),
        airspeed: groundSpeed,
        groundspeed: groundSpeed,
        heading: heading.toFixed(0),
        throttle: 50,
        alt: altitude,
        climb: 0
      }

      const batteryData = {
        type: 'BATTERY_STATUS',
        timestamp: Date.now(),
        battery_remaining: battery.toFixed(0),
        voltages: [16800, 16700, 16750, 16800, 0, 0, 0, 0, 0, 0], // 单位：mV
        current_battery: 850, // 当前电流 850mA
        current_consumed: 1250, // 已消耗电量 1250mAh
        energy_consumed: -1,
        battery_function: 0,
        battery_type: 1, // LiPo
        temperature: 350 // 温度 35.0°C (单位：0.01度)
      }

      // 通过 IPC 发送给渲染进程1
      mainWindow.webContents.send('mavlink-data', {
        position: mavlinkData,
        attitude: attitudeData,
        vfr_hud: vfrHudData,
        battery: batteryData
      })
    }, 100) // 10 Hz1
  }

  // 启动模拟器
  startMavlinkSimulator()

  // === 核心逻辑结束 ===

  // HMR 相关代码
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ... 底部 app.whenReady() 等代码保持原样
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
  // ...
})
