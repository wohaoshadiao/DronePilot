import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// 注意：后续可以集成真实的 MAVLink 库
// import { MAVLinkModule } from 'node-mavlink'

let mainWindow = null
let advancedModeWindow = null
let mavlinkRawData = [] // 存储原始MAVLink数据
 
function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
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

  // 2. 高级模式窗口
  ipcMain.on('open-advanced-mode', () => {
    if (advancedModeWindow) {
      advancedModeWindow.focus()
      return
    }

    advancedModeWindow = new BrowserWindow({
      width: 500,
      height: 300,
      show: false,
      autoHideMenuBar: true,
      resizable: false,
      parent: mainWindow,
      modal: false,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    advancedModeWindow.on('ready-to-show', () => {
      advancedModeWindow.show()
    })

    advancedModeWindow.on('closed', () => {
      advancedModeWindow = null
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      advancedModeWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/advanced.html')
    } else {
      advancedModeWindow.loadFile(join(__dirname, '../renderer/advanced.html'))
    }
  })

  // 验证密码
  ipcMain.handle('verify-password', async (_event, password) => {
    // 简单的密码验证，实际应用中应该更安全
    const correctPassword = 'admin123'
    return password === correctPassword
  })

  // 发送原始MAVLink数据到高级模式窗口
  function sendRawDataToAdvancedWindow(rawData) {
    if (advancedModeWindow && !advancedModeWindow.isDestroyed()) {
      advancedModeWindow.webContents.send('mavlink-raw-data', rawData)
    }
  }

  // 3. 启动 MAVLink 数据模拟器
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

      // 构建原始MAVLink数据帧用于高级模式显示
      const rawDataFrame = {
        timestamp: Date.now(),
        magic: 0xFD, // MAVLink 2.0
        len: 33, // 假设payload长度
        incompat_flags: 0,
        compat_flags: 0,
        seq: Math.floor(Date.now() / 100) % 256,
        sysid: 1,
        compid: 1,
        msgid: 33, // GLOBAL_POSITION_INT
        payload: {
          time_boot_ms: Date.now() % 1000000,
          lat: parseInt(mavlinkData.latitude),
          lon: parseInt(mavlinkData.longitude),
          alt: parseInt(mavlinkData.altitude),
          relative_alt: parseInt(mavlinkData.relative_alt),
          vx: mavlinkData.vx,
          vy: mavlinkData.vy,
          vz: mavlinkData.vz,
          hdg: parseInt(mavlinkData.heading)
        },
        checksum: 0x0000 // 简化处理
      }

      // 发送原始数据到高级模式窗口
      sendRawDataToAdvancedWindow(rawDataFrame)
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
