import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 暴露给渲染进程的 API
const api = {
  // 串口相关API
  listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),
  connectSerial: (portPath, baudRate) => ipcRenderer.invoke('connect-serial', portPath, baudRate),
  disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),

  // WebSocket相关API
  connectWebSocket: (wsUrl) => ipcRenderer.invoke('connect-websocket', wsUrl),
  disconnectWebSocket: () => ipcRenderer.invoke('disconnect-websocket'),

  // MAVLink 数据监听
  onMavlinkData: (callback) => {
    ipcRenderer.on('mavlink-data', (event, data) => callback(data))
  },

  // 固件信息监听
  onFirmwareInfo: (callback) => {
    ipcRenderer.on('firmware-info', (event, data) => callback(data))
  },

  // 移除监听器
  removeMavlinkListener: () => {
    ipcRenderer.removeAllListeners('mavlink-data')
  },

  removeFirmwareListener: () => {
    ipcRenderer.removeAllListeners('firmware-info')
  },

  // IMU数据监听
  onImuData: (callback) => {
    ipcRenderer.on('imu-data', (event, data) => callback(data))
  },

  // WebSocket连接状态监听
  onWebSocketConnected: (callback) => {
    ipcRenderer.on('websocket-connected', () => callback())
  },

  onWebSocketDisconnected: (callback) => {
    ipcRenderer.on('websocket-disconnected', () => callback())
  },

  onWebSocketError: (callback) => {
    ipcRenderer.on('websocket-error', (event, error) => callback(error))
  },

  // 串口错误监听
  onSerialError: (callback) => {
    ipcRenderer.on('serial-error', (event, error) => callback(error))
  },

  // 串口断开监听
  onSerialDisconnected: (callback) => {
    ipcRenderer.on('serial-disconnected', () => callback())
  },

  // 移除串口监听器
  removeSerialListeners: () => {
    ipcRenderer.removeAllListeners('serial-error')
    ipcRenderer.removeAllListeners('serial-disconnected')
  },

  // 移除WebSocket监听器
  removeWebSocketListeners: () => {
    ipcRenderer.removeAllListeners('imu-data')
    ipcRenderer.removeAllListeners('websocket-connected')
    ipcRenderer.removeAllListeners('websocket-disconnected')
    ipcRenderer.removeAllListeners('websocket-error')
  }
}

// 使用 contextBridge 暴露
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI, // 默认的
      ...api // 我们自定义的 api
    })
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = { ...electronAPI, ...api }
}
