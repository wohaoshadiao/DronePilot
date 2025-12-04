import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { SerialPort } from 'serialport'
import { MavLinkPacketSplitter, MavLinkPacketParser, MavLinkProtocolV2, minimal, common } from 'node-mavlink'
import WebSocket from 'ws'

let mainWindow = null
let serialPort = null
let wsClient = null
let packetDebugCount = 0 // 用于限制调试日志数量
 
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

  // 1. 获取可用串口列表
  ipcMain.handle('list-serial-ports', async () => {
    try {
      const ports = await SerialPort.list()
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        productId: port.productId,
        vendorId: port.vendorId
      }))
    } catch (error) {
      console.error('获取串口列表失败:', error)
      return []
    }
  })

  // 2. 连接到串口设备
  ipcMain.handle('connect-serial', async (_event, portPath, baudRate = 115200) => {
    try {
      // 如果已有连接，先断开
      if (serialPort && serialPort.isOpen) {
        serialPort.close()
      }

      // 重置调试计数器
      packetDebugCount = 0

      // 创建串口连接
      serialPort = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      })

      // 创建MAVLink解析器
      const reader = serialPort
        .pipe(new MavLinkPacketSplitter())
        .pipe(new MavLinkPacketParser())

      // 监听MAVLink消息
      reader.on('data', (packet) => {
        handleMavlinkPacket(packet)
      })

      serialPort.on('error', (err) => {
        console.error('<------串口错误------>', err)
        mainWindow.webContents.send('serial-error', err.message)
      })

      serialPort.on('close', () => {
        console.log('<------串口已关闭------>')
        mainWindow.webContents.send('serial-disconnected')
      })

      return { status: 'success', msg: `已连接到 ${portPath}` }
    } catch (error) {
      console.error('连接串口失败:', error)
      return { status: 'error', msg: error.message }
    }
  })

  // 3. 断开串口连接
  ipcMain.handle('disconnect-serial', async () => {
    try {
      if (serialPort && serialPort.isOpen) {
        serialPort.close()
        serialPort = null
        mavlinkParser = null
        return { status: 'success', msg: '已断开连接' }
      }
      return { status: 'success', msg: '无活动连接' }
    } catch (error) {
      return { status: 'error', msg: error.message }
    }
  })

  // 4. 处理MAVLink数据包
  function handleMavlinkPacket(packet) {
    try {

      // 根据消息ID手动解析消息
      const msgid = packet.header.msgid
      let message = null

      // 定义遥测数据结构
      const telemetryData = {}

      // 根据消息ID解析对应的消息类型
      switch (msgid) {
        case 0: // HEARTBEAT
          message = packet.protocol.data(packet.payload, minimal.Heartbeat)

          // 获取autopilot类型并映射到操作系统
          const autopilot = message.autopilot
          let firmwareOS = ''

          // MAV_AUTOPILOT 枚举值
          // 3 = MAV_AUTOPILOT_ARDUPILOTMEGA (ArduPilot)
          // 12 = MAV_AUTOPILOT_PX4
          if (autopilot === 3) {
            firmwareOS = 'ChibiOS' // ArduPilot 使用 ChibiOS
          } else if (autopilot === 12) {
            firmwareOS = 'NuttX' // PX4 使用 NuttX
          }

          // 发送固件信息到渲染进程
          if (firmwareOS) {
            mainWindow.webContents.send('firmware-info', { os: firmwareOS, autopilot })
          }

          break

        case 30: // ATTITUDE
          message = packet.protocol.data(packet.payload, common.Attitude)
          telemetryData.attitude = {
            type: 'ATTITUDE',
            timestamp: Date.now(),
            roll: message.roll,
            pitch: message.pitch,
            yaw: message.yaw,
            rollspeed: message.rollspeed,
            pitchspeed: message.pitchspeed,
            yawspeed: message.yawspeed
          }
          // console.log('✓ 已处理 ATTITUDE - Roll:', message.roll, 'Pitch:', message.pitch, 'Yaw:', message.yaw)
          break

        case 33: // GLOBAL_POSITION_INT
          message = packet.protocol.data(packet.payload, common.GlobalPositionInt)
          telemetryData.position = {
            type: 'GLOBAL_POSITION_INT',
            timestamp: Date.now(),
            latitude: message.lat,
            longitude: message.lon,
            altitude: message.alt,
            relative_alt: message.relativeAlt,
            vx: message.vx,
            vy: message.vy,
            vz: message.vz,
            heading: message.hdg
          }
          // console.log('✓ 已处理 GLOBAL_POSITION_INT')
          break

        case 74: // VFR_HUD
          message = packet.protocol.data(packet.payload, common.VfrHud)
          telemetryData.vfr_hud = {
            type: 'VFR_HUD',
            timestamp: Date.now(),
            airspeed: message.airspeed,
            groundspeed: message.groundspeed,
            heading: message.heading,
            throttle: message.throttle,
            alt: message.alt,
            climb: message.climb
          }
          // console.log('✓ 已处理 VFR_HUD')
          break

        case 147: // BATTERY_STATUS
          message = packet.protocol.data(packet.payload, common.BatteryStatus)
          telemetryData.battery = {
            type: 'BATTERY_STATUS',
            timestamp: Date.now(),
            battery_remaining: message.batteryRemaining,
            voltages: message.voltages,
            current_battery: message.currentBattery,
            current_consumed: message.currentConsumed,
            energy_consumed: message.energyConsumed,
            battery_function: message.batteryFunction,
            battery_type: message.type,
            temperature: message.temperature
          }
          // console.log('✓ 已处理 BATTERY_STATUS')
          break

        case 1: // SYS_STATUS
          message = packet.protocol.data(packet.payload, common.SysStatus)
          telemetryData.sys_status = {
            type: 'SYS_STATUS',
            timestamp: Date.now(),
            voltage_battery: message.voltageBattery,
            current_battery: message.currentBattery,
            battery_remaining: message.batteryRemaining
          }
          // console.log('✓ 已处理 SYS_STATUS')
          break

        default:
          // 忽略其他消息类型
          break
      }

      // 发送数据到渲染进程
      if (Object.keys(telemetryData).length > 0) {
        // console.log('📤 发送数据到渲染进程:', Object.keys(telemetryData))
        mainWindow.webContents.send('mavlink-data', telemetryData)
      }
    } catch (error) {
      console.error('处理MAVLink数据包失败:', error)
    }
  }

    // 6. WebSocket连接 - 用于接收IMU数据
  ipcMain.handle('connect-websocket', async (_event, wsUrl) => {
    try {
      // 如果已有连接，先断开
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.close()
      }

      wsClient = new WebSocket(wsUrl)

      wsClient.on('open', () => {
        console.log('WebSocket已连接:', wsUrl)
        mainWindow.webContents.send('websocket-connected')
      })

      wsClient.on('message', (data) => {
        try {
          // 解析IMU数据
          const imuData = JSON.parse(data.toString())

          // 发送IMU数据到渲染进程
          mainWindow.webContents.send('imu-data', imuData)
        } catch (error) {
          console.error('解析IMU数据失败:', error)
        }
      })

      wsClient.on('error', (error) => {
        console.error('WebSocket错误:', error)
        mainWindow.webContents.send('websocket-error', error.message)
      })

      wsClient.on('close', () => {
        console.log('WebSocket已断开')
        mainWindow.webContents.send('websocket-disconnected')
      })

      return { status: 'success', msg: `正在连接到 ${wsUrl}` }
    } catch (error) {
      console.error('连接WebSocket失败:', error)
      return { status: 'error', msg: error.message }
    }
  })

  // 6. 断开WebSocket连接
  ipcMain.handle('disconnect-websocket', async () => {
    try {
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.close()
        wsClient = null
        return { status: 'success', msg: '已断开WebSocket连接' }
      }
      return { status: 'success', msg: '无活动WebSocket连接' }
    } catch (error) {
      return { status: 'error', msg: error.message }
    }
  })

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
