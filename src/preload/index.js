import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 暴露给渲染进程的 API
const api = {
  // 封装 IPC 请求，方便 Vue 调用
  connectDevice: (deviceId) => ipcRenderer.invoke('connect-device', deviceId),

  // MAVLink 数据监听
  onMavlinkData: (callback) => {
    ipcRenderer.on('mavlink-data', (event, data) => callback(data))
  },

  // 移除监听器
  removeMavlinkListener: () => {
    ipcRenderer.removeAllListeners('mavlink-data')
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