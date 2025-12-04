<script setup>
import { reactive, onMounted, onUnmounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { wgs84ToGcj02 } from './utils/coordTransform'

// 状态管理
let telemetry = reactive({
  latitude: 39.9042, // WGS-84 坐标（北京天安门）
  longitude: 116.4074,
  altitude: 10.0,
  heading: 0,
  speed: 0,
  battery: 0,
  roll: 0,
  pitch: 0,
  yaw: 0,
  // 电池详细信息
  batteryVoltages: [0, 0, 0, 0], // 单位：V
  batteryCurrent: 0, // 单位：mA
  batteryConsumed: 0, // 已消耗 mAh
  batteryTemp: 0 // 温度 °C
})

const menuItems = reactive([
  {
    title: 'Flight Control',
    icon: 'airplane-outline',
    isOpen: true,
    children: ['Manual Flight', 'Tap to Fly', 'Smart Oblique', 'Panorama']
  },
  {
    title: 'Mission Plan',
    icon: 'map-outline',
    isOpen: false,
    children: ['Waypoint Route', 'Mapping Mission', 'Linear Inspection']
  },
  {
    title: 'Data Library',
    icon: 'cloud-outline',
    isOpen: false,
    children: ['Media Files', 'Flight Logs']
  }
])

const statusPanelOpen = ref(false) // 右侧状态面板展开状态
const selectedMapSource = ref('amap') // 地图源选择: 'amap' | 'osm'
const showVideoFeed = ref(false) // 视频窗口显示状态

// 串口连接相关
const serialPorts = ref([])
const selectedPort = ref('')
const selectedBaudRate = ref(115200)
const isConnected = ref(false)
const connectionStatus = ref('未连接')
const firmwareOS = ref('') // 固件操作系统信息
const baudRateOptions = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]
const showConnectionDropdown = ref(false) // 控制下拉框显示

// Map 相关
let map = null
let droneMarker = null
let trajectoryPolyline = null
const pathHistory = []
let amapLayer = null // 高德地图层
let osmLayer = null // OSM 地图层
let offlineLayer = null // 离线地图层

// 切换菜单
const toggleMenu = (index) => {
  menuItems[index].isOpen = !menuItems[index].isOpen
}

const toggleStatusPanel = () => {
  statusPanelOpen.value = !statusPanelOpen.value
}

const toggleVideoFeed = () => {
  showVideoFeed.value = !showVideoFeed.value
}

// 切换连接下拉框
const toggleConnectionDropdown = () => {
  showConnectionDropdown.value = !showConnectionDropdown.value
}

// 获取串口列表
const refreshSerialPorts = async () => {
  if (window.electron && window.electron.listSerialPorts) {
    const ports = await window.electron.listSerialPorts()
    serialPorts.value = ports
    if (ports.length > 0 && !selectedPort.value) {
      selectedPort.value = ports[0].path
    }
  }
}

// 连接串口
const connectSerial = async () => {
  if (!selectedPort.value) {
    connectionStatus.value = '请选择串口'
    return
  }

  connectionStatus.value = '正在连接...'

  if (window.electron && window.electron.connectSerial) {
    const result = await window.electron.connectSerial(selectedPort.value, selectedBaudRate.value)
    if (result.status === 'success') {
      isConnected.value = true
      connectionStatus.value = '已连接'
    } else {
      isConnected.value = false
      connectionStatus.value = '连接失败: ' + result.msg
    }
  }
}

// 断开连接
const disconnectSerial = async () => {
  if (window.electron && window.electron.disconnectSerial) {
    await window.electron.disconnectSerial()
    isConnected.value = false
    connectionStatus.value = '已断开'
    firmwareOS.value = '' // 清空固件信息
  }
}

// 切换地图源
const switchMapSource = (source) => {
  if (!map || selectedMapSource.value === source) return

  selectedMapSource.value = source

  // 移除当前在线地图层
  if (amapLayer && map.hasLayer(amapLayer)) {
    map.removeLayer(amapLayer)
  }
  if (osmLayer && map.hasLayer(osmLayer)) {
    map.removeLayer(osmLayer)
  }

  // 添加选择的地图层
  if (source === 'amap' && amapLayer) {
    amapLayer.addTo(map)
  } else if (source === 'osm' && osmLayer) {
    osmLayer.addTo(map)
  }

  // 离线图层始终在顶层
  if (offlineLayer && !map.hasLayer(offlineLayer)) {
    offlineLayer.addTo(map)
  }
}

// 初始化地图
const initMap = () => {
  // 将初始坐标转换为 GCJ-02
  const gcjCoord = wgs84ToGcj02(telemetry.longitude, telemetry.latitude)

  map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    minZoom: 3,
    maxZoom: 20
  }).setView(
    [gcjCoord.lat, gcjCoord.lng],
    15
  )

  // 创建高德地图层（卫星图，类似大疆司空2）
  amapLayer = L.tileLayer(
    'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 25,
      minZoom: 3,
      className: 'map-tiles-bright',
      crossOrigin: true
    }
  )

  // 创建 OSM 明亮地图层
  osmLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      minZoom: 3,
      className: 'map-tiles-bright',
      crossOrigin: true
    }
  )

  // 根据选择添加在线地图层
  if (selectedMapSource.value === 'amap') {
    amapLayer.addTo(map)
  } else {
    osmLayer.addTo(map)
  }

  // 离线瓦片作为覆盖层（仅已下载区域）
  offlineLayer = L.tileLayer('/tiles-amap/{z}/{x}/{y}.png', {
    maxZoom: 17,
    minZoom: 14,
    className: 'map-tiles-bright',
    errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // 透明1x1像素
  }).addTo(map)

  // SVG Quadcopter Drone Icon (四旋翼无人机图标)
  const droneIcon = L.divIcon({
    className: '',
    html: `<div class="drone-marker-container">
            <svg id="drone-svg" class="drone-svg" viewBox="0 0 64 64">
              <!-- 四个螺旋桨 -->
              <circle cx="10" cy="10" r="8" fill="#3b82f6" opacity="0.3"/>
              <circle cx="54" cy="10" r="8" fill="#3b82f6" opacity="0.3"/>
              <circle cx="10" cy="54" r="8" fill="#3b82f6" opacity="0.3"/>
              <circle cx="54" cy="54" r="8" fill="#3b82f6" opacity="0.3"/>

              <!-- 机臂 -->
              <line x1="32" y1="32" x2="10" y2="10" stroke="#3b82f6" stroke-width="3"/>
              <line x1="32" y1="32" x2="54" y2="10" stroke="#3b82f6" stroke-width="3"/>
              <line x1="32" y1="32" x2="10" y2="54" stroke="#3b82f6" stroke-width="3"/>
              <line x1="32" y1="32" x2="54" y2="54" stroke="#3b82f6" stroke-width="3"/>

              <!-- 中心机身 -->
              <circle cx="32" cy="32" r="8" fill="#3b82f6"/>
              <circle cx="32" cy="32" r="5" fill="#1e40af"/>

              <!-- 方向指示器 (前方) -->
              <path d="M 32 20 L 28 28 L 36 28 Z" fill="#ef4444"/>
            </svg>
          </div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 25]
  })

  droneMarker = L.marker([gcjCoord.lat, gcjCoord.lng], { icon: droneIcon }).addTo(map)

  // 初始化轨迹线
  trajectoryPolyline = L.polyline([], {
    color: '#3b82f6',
    weight: 3,
    opacity: 0.7,
    smoothFactor: 1,
    lineJoin: 'round'
  }).addTo(map)
}

// 更新地图状态
const updateMapState = () => {
  if (!droneMarker || !map) return

  // 将 WGS-84 GPS 坐标转换为 GCJ-02（高德地图坐标系）
  const gcjCoord = wgs84ToGcj02(telemetry.longitude, telemetry.latitude)
  const newLatLng = L.latLng(gcjCoord.lat, gcjCoord.lng)

  // 更新标记位置和旋转
  droneMarker.setLatLng(newLatLng)
  const iconEl = document.getElementById('drone-svg')
  if (iconEl) iconEl.style.transform = `rotate(${telemetry.heading}deg)`

  // 更新轨迹历史
  pathHistory.push(newLatLng)
  if (pathHistory.length > 300) pathHistory.shift()
  trajectoryPolyline.setLatLngs(pathHistory)

  // 平滑平移
  map.panTo(newLatLng, { animate: true, duration: 0.5, easeLinearity: 0.1 })
}

// 处理 MAVLink 数据
const handleMavlinkData = (data) => {
  // console.log('渲染进程收到数据:', data)

/**
 * parameter: To avoid the map displaying error position data.
 */

  // if (data.position) {
  //   telemetry.latitude = parseFloat(data.position.latitude) / 1e7
  //   telemetry.longitude = parseFloat(data.position.longitude) / 1e7
  //   telemetry.altitude = (parseFloat(data.position.altitude) / 1000).toFixed(1)
  //   // console.log('✓ 更新位置数据')
  // }

  if (data.attitude) {
    telemetry.roll = data.attitude.roll
    telemetry.pitch = data.attitude.pitch
    telemetry.yaw = data.attitude.yaw
    // console.log('✓ 更新姿态角 - Roll:', data.attitude.roll, 'Pitch:', data.attitude.pitch, 'Yaw:', data.attitude.yaw)
  }

  if (data.vfr_hud) {
    telemetry.speed = parseFloat(data.vfr_hud.groundspeed).toFixed(1)
    telemetry.heading = parseFloat(data.vfr_hud.heading)
    // console.log('✓ 更新VFR_HUD数据')
  }

  if (data.battery) {
    telemetry.battery = parseFloat(data.battery.battery_remaining)

    // 电池详细信息
    if (data.battery.voltages) {
      // 将电压从 mV 转换为 V，只取有效的电池单元
      telemetry.batteryVoltages = data.battery.voltages
        .filter(v => v > 0)
        .map(v => (v / 1000).toFixed(2))
    }

    if (data.battery.current_battery !== undefined) {
      telemetry.batteryCurrent = data.battery.current_battery // mA
    }

    if (data.battery.current_consumed !== undefined) {
      telemetry.batteryConsumed = data.battery.current_consumed // mAh
    }

    if (data.battery.temperature !== undefined) {
      telemetry.batteryTemp = (data.battery.temperature / 100).toFixed(1) // 转换为摄氏度
    }
    // console.log('✓ 更新电池数据')
  }

  updateMapState()
}

onMounted(() => {
  initMap()

  // 获取串口列表
  refreshSerialPorts()

  // 监听 MAVLink 数据
  if (window.electron && window.electron.onMavlinkData) {
    window.electron.onMavlinkData(handleMavlinkData)
  }

  // 监听固件信息
  if (window.electron && window.electron.onFirmwareInfo) {
    window.electron.onFirmwareInfo((data) => {
      firmwareOS.value = data.os
      console.log('固件系统:', data.os, '| Autopilot类型:', data.autopilot)
    })
  }

  // 监听串口错误
  if (window.electron && window.electron.onSerialError) {
    window.electron.onSerialError((error) => {
      console.error('串口错误:', error)
      connectionStatus.value = '错误: ' + error
      isConnected.value = false
      firmwareOS.value = '' // 清空固件信息
    })
  }

  // 监听串口断开
  if (window.electron && window.electron.onSerialDisconnected) {
    window.electron.onSerialDisconnected(() => {
      console.log('串口已断开')
      connectionStatus.value = '连接已断开'
      isConnected.value = false
      firmwareOS.value = '' // 清空固件信息
    })
  }
})

onUnmounted(() => {
  // 清理监听器
  if (window.electron) {
    if (window.electron.removeMavlinkListener) {
      window.electron.removeMavlinkListener()
    }
    if (window.electron.removeFirmwareListener) {
      window.electron.removeFirmwareListener()
    }
    if (window.electron.removeSerialListeners) {
      window.electron.removeSerialListeners()
    }
  }
})
</script>

<template>
  <div id="app">
    <aside class="sidebar">
      <div class="brand-area">
        <div class="brand-logo">
          <svg viewBox="0 0 64 64">
            <!-- 外圈 -->
            <circle cx="32" cy="32" r="28" stroke="#3b82f6" stroke-width="2" fill="none" opacity="0.5"/>
            <circle cx="32" cy="32" r="24" stroke="#3b82f6" stroke-width="1" fill="none" opacity="0.3"/>

            <!-- 四旋翼无人机图标 -->
            <!-- 螺旋桨 -->
            <circle cx="18" cy="18" r="5" fill="#3b82f6" opacity="0.6"/>
            <circle cx="46" cy="18" r="5" fill="#3b82f6" opacity="0.6"/>
            <circle cx="18" cy="46" r="5" fill="#3b82f6" opacity="0.6"/>
            <circle cx="46" cy="46" r="5" fill="#3b82f6" opacity="0.6"/>

            <!-- 机臂 -->
            <line x1="32" y1="32" x2="18" y2="18" stroke="#3b82f6" stroke-width="2.5"/>
            <line x1="32" y1="32" x2="46" y2="18" stroke="#3b82f6" stroke-width="2.5"/>
            <line x1="32" y1="32" x2="18" y2="46" stroke="#3b82f6" stroke-width="2.5"/>
            <line x1="32" y1="32" x2="46" y2="46" stroke="#3b82f6" stroke-width="2.5"/>

            <!-- 中心机身 -->
            <circle cx="32" cy="32" r="6" fill="#3b82f6"/>
            <circle cx="32" cy="32" r="4" fill="#1e40af"/>

            <!-- 方向指示 -->
            <path d="M 32 24 L 29 30 L 35 30 Z" fill="#ef4444"/>

            <!-- 装饰性轨迹线 -->
            <path d="M 10 32 Q 20 20, 32 32" stroke="#3b82f6" stroke-width="1" fill="none" opacity="0.3"/>
            <path d="M 32 10 Q 44 20, 54 32" stroke="#3b82f6" stroke-width="1" fill="none" opacity="0.3"/>
          </svg>
        </div>
        <div class="brand-text">
          DRONE PILOT
          <span>Ground Control Station</span>
        </div>
      </div>

      <!-- 紧凑的连接状态显示 -->
      <div class="compact-connection-status">
        <div class="status-row">
          <div class="status-info">
            <!-- 连接状态图标 -->
            <div class="connection-icon" :class="{ connected: isConnected }">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6"/>
                <path d="m5.6 5.6 4.2 4.2m4.4 4.4 4.2 4.2M1 12h6m6 0h6m-16.4.6 4.2-4.2m4.4-4.4 4.2-4.2"/>
              </svg>
            </div>
            <span class="status-text" :class="{ connected: isConnected }">
              {{ connectionStatus }}
              <span v-if="firmwareOS" class="firmware-badge">{{ firmwareOS }}</span>
            </span>
          </div>
          <button class="dropdown-toggle" @click="toggleConnectionDropdown" :class="{ active: showConnectionDropdown }">
            <ion-icon :name="showConnectionDropdown ? 'chevron-up-outline' : 'chevron-down-outline'"></ion-icon>
          </button>
        </div>

        <!-- 可展开的连接配置面板 -->
        <div class="connection-dropdown" v-show="showConnectionDropdown">
          <div class="dropdown-content">
            <div class="control-group">
              <label>串口设备</label>
              <div class="port-select-group">
                <select v-model="selectedPort" :disabled="isConnected" class="control-select">
                  <option value="">选择串口</option>
                  <option v-for="port in serialPorts" :key="port.path" :value="port.path">
                    {{ port.path }} {{ port.manufacturer ? `(${port.manufacturer})` : '' }}
                  </option>
                </select>
                <button @click="refreshSerialPorts" :disabled="isConnected" class="refresh-btn" title="刷新串口列表">
                  <ion-icon name="refresh-outline"></ion-icon>
                </button>
              </div>
            </div>

            <div class="control-group">
              <label>波特率</label>
              <select v-model="selectedBaudRate" :disabled="isConnected" class="control-select">
                <option v-for="rate in baudRateOptions" :key="rate" :value="rate">
                  {{ rate }}
                </option>
              </select>
            </div>

            <button
              @click="isConnected ? disconnectSerial() : connectSerial()"
              :class="['connect-btn', isConnected ? 'connected' : '']"
            >
              <ion-icon :name="isConnected ? 'close-circle-outline' : 'play-circle-outline'"></ion-icon>
              {{ isConnected ? '断开连接' : '连接' }}
            </button>
          </div>
        </div>
      </div>

      <div class="sidebar-divider"></div>

      <div class="menu-container">
        <div v-for="(item, index) in menuItems" :key="index" class="menu-group">
          <div class="menu-header" :class="{ active: item.isOpen }" @click="toggleMenu(index)">
            <div class="header-content">
              <ion-icon :name="item.icon" size="small"></ion-icon>
              <span>{{ item.title }}</span>
            </div>
            <ion-icon
              v-if="item.children"
              name="chevron-down-outline"
              class="chev-icon"
              :class="{ 'rotate-90': item.isOpen }"
            ></ion-icon>
          </div>
          <div class="submenu" v-show="item.isOpen && item.children">
            <span v-for="(child, cIndex) in item.children" :key="cIndex" class="submenu-item">
              {{ child }}
            </span>
          </div>
        </div>
      </div>

      <div class="status-card-container">
        <div class="drone-status-card">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: 600">
            <span>Quadcopter</span><span style="color: #10b981">Ready to Fly</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: var(--text-muted)">
            <span>Battery</span> <span>{{ telemetry.battery.toFixed(0) }}%</span>
          </div>
          <div class="battery-bar">
            <div class="battery-fill" :style="{ width: telemetry.battery + '%' }"></div>
          </div>
        </div>
      </div>
    </aside>

    <main class="map-view">
      <div class="hud-top-bar">
        <div class="metric">
          <span class="label">H.S (m/s)</span><span class="value">{{ telemetry.speed }}</span>
        </div>
        <div class="metric">
          <span class="label">Alt (m)</span><span class="value">{{ telemetry.altitude }}</span>
        </div>
        <div class="metric">
          <span class="label">Head (°)</span
          ><span class="value">{{ Math.round(telemetry.heading) }}</span>
        </div>
      </div>

      <!-- 独立地图控制栏 -->
      <div class="map-control-panel">
        <div class="map-control-header">
          <ion-icon name="map-outline"></ion-icon>
          <span>地图源</span>
        </div>
        <select v-model="selectedMapSource" @change="switchMapSource(selectedMapSource)" class="map-source-select">
          <option value="amap">高德卫星图</option>
          <option value="osm">OpenStreetMap</option>
        </select>
      </div>

      <div class="compass-widget">
        <div class="compass-rose" :style="{ '--heading-rotate': -telemetry.heading + 'deg' }">
          <span class="compass-direction n">N</span>
          <span class="compass-direction e">E</span>
          <span class="compass-direction s">S</span>
          <span class="compass-direction w">W</span>
        </div>
        <span class="compass-heading-display">{{ Math.round(telemetry.heading) }}°</span>
      </div>

      <!-- 视频窗口容器 -->
      <div class="video-container">
        <!-- 相机图标按钮 -->
        <div class="camera-toggle" @click="toggleVideoFeed" :title="showVideoFeed ? '关闭视频' : '打开视频'">
          <img src="/home/warnie/Documents/VSCODE/DronePilot/dronepilot/public/camera.svg" alt="Camera" class="camera-icon" />
        </div>

        <!-- 视频窗口（可折叠） -->
        <div class="video-pip" v-show="showVideoFeed">
          <span>LIVE PAYLOAD FEED</span>
        </div>
      </div>

      <!-- 右侧无人机状态面板 -->
      <!-- 切换按钮 - 独立于面板之外 -->
      <div class="status-panel-toggle" @click="toggleStatusPanel">
        <ion-icon :name="statusPanelOpen ? 'chevron-forward-outline' : 'chevron-back-outline'"></ion-icon>
      </div>

      <div class="drone-status-panel" :class="{ open: statusPanelOpen }">
        <div class="status-panel-content">
          <div class="panel-header">
            <ion-icon name="hardware-chip-outline"></ion-icon>
            <span>数据看板</span>
          </div>

          <!-- 电池状态 -->
          <div class="status-section">
            <div class="section-title">
              <ion-icon name="battery-charging-outline"></ion-icon>
              <span>电池状态</span>
            </div>
            <div class="status-grid">
              <div class="status-item">
                <span class="label">剩余电量</span>
                <span class="value">{{ telemetry.battery.toFixed(0) }}%</span>
              </div>
              <div class="status-item">
                <span class="label">电池节数</span>
                <span class="value">{{ telemetry.batteryVoltages.length }}S</span>
              </div>
              <div class="status-item">
                <span class="label">平均电压</span>
                <span class="value">{{ (telemetry.batteryVoltages.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / telemetry.batteryVoltages.length).toFixed(2) }}V</span>
              </div>
              <div class="status-item">
                <span class="label">当前电流</span>
                <span class="value">{{ (telemetry.batteryCurrent / 1000).toFixed(2) }}A</span>
              </div>
              <div class="status-item">
                <span class="label">已消耗</span>
                <span class="value">{{ telemetry.batteryConsumed }}mAh</span>
              </div>
              <div class="status-item">
                <span class="label">温度</span>
                <span class="value">{{ telemetry.batteryTemp }}°C</span>
              </div>
            </div>

            <!-- 单节电压显示 -->
            <div class="cell-voltages">
              <div class="cell-title">单节电压</div>
              <div class="cell-list">
                <div v-for="(voltage, index) in telemetry.batteryVoltages" :key="index" class="cell-item">
                  <span>S{{ index + 1 }}</span>
                  <span>{{ voltage }}V</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 姿态与位置 -->
          <div class="status-section">
            <div class="section-title">
              <ion-icon name="navigate-circle-outline"></ion-icon>
              <span>IMU姿态</span>
            </div>
            <div class="status-grid">
              <div class="status-item">
                <span class="label">Pitch</span>
                <span class="value">{{ (telemetry.pitch * 180 / Math.PI).toFixed(1) }}°</span>
              </div>
              <div class="status-item">
                <span class="label">Roll</span>
                <span class="value">{{ (telemetry.roll * 180 / Math.PI).toFixed(1) }}°</span>
              </div>
              <div class="status-item">
                <span class="label">Yaw</span>
                <span class="value">{{ (telemetry.yaw * 180 / Math.PI).toFixed(1) }}°</span>
              </div>
              <div class="status-item">
                <span class="label">Compass</span>
                <span class="value">{{ Math.round(telemetry.heading) }}°</span>
              </div>
              <div class="status-item full-width">
                <span class="label">纬度 (Lat)</span>
                <span class="value">{{ telemetry.latitude.toFixed(7) }}</span>
              </div>
              <div class="status-item full-width">
                <span class="label">经度 (Lon)</span>
                <span class="value">{{ telemetry.longitude.toFixed(7) }}</span>
              </div>
              <div class="status-item">
                <span class="label">Attitude</span>
                <span class="value">{{ telemetry.altitude }}m</span>
              </div>
              <div class="status-item">
                <span class="label">Speed</span>
                <span class="value">{{ telemetry.speed }}m/s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="map"></div>
    </main>
  </div>
</template>

<style scoped>
:root {
  --sidebar-bg: #18181b;
  --sidebar-hover: #27272a;
  --accent: #3b82f6;
  --text-muted: #a1a1aa;
}

#app {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100vh;
  width: 100vw;
  background: #000;
  color: #fff;
  overflow: hidden;
}

/* --- SIDEBAR --- */
.sidebar {
  background: var(--sidebar-bg);
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  z-index: 1001;
  user-select: none;
}

.brand-area {
  padding: 20px 20px 12px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: none;
  margin-bottom: 0;
}

.sidebar-divider {
  height: 1px;
  background: #2d2d30;
  margin: 0 0 15px 0;
}

.brand-logo svg {
  width: 48px;
  height: 48px;
  fill: var(--accent);
}

.brand-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
  line-height: 1.2;
}

.brand-text span {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 400;
  margin-top: 2px;
}

/* 紧凑的连接状态 */
.compact-connection-status {
  margin: 0 15px 10px 15px;
  padding: 6px 10px 6px 12px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  position: relative;
  max-width: 200px;
}

.compact-connection-status::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: linear-gradient(180deg, var(--accent) 0%, rgba(59, 130, 246, 0.3) 100%);
  border-radius: 2px 0 0 2px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.connection-icon {
  width: 14px;
  height: 14px;
  color: #6b7280;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.connection-icon svg {
  width: 100%;
  height: 100%;
}

.connection-icon.connected {
  color: #10b981;
  filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.6));
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.6));
  }
  50% {
    filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.8));
  }
}

.status-text {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
  transition: color 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-text.connected {
  color: #10b981;
}

.firmware-badge {
  display: inline-block;
  padding: 3px 6px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(92, 114, 150, 0.4);
  border-radius: 3px;
  font-size: 9px;
  font-weight: 650;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.dropdown-toggle {
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 12px;
  flex-shrink: 0;
}

.dropdown-toggle:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: var(--accent);
  color: var(--accent);
}

.dropdown-toggle.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: var(--accent);
  color: var(--accent);
}

.connection-dropdown {
  margin-top: 8px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 6px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.control-group label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.port-select-group {
  display: flex;
  gap: 6px;
}

.control-select {
  flex: 1;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.control-select:hover:not(:disabled) {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.1);
}

.control-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.control-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-select option {
  background: #1a1a1a;
  color: #fff;
  padding: 8px;
}

.refresh-btn {
  width: 30px;
  height: 30px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--accent);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 16px;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: var(--accent);
  transform: rotate(90deg);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.connect-btn {
  width: 100%;
  padding: 8px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.connect-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.connect-btn:active {
  transform: translateY(0);
}

.connect-btn.connected {
  background: #ef4444;
}

.connect-btn.connected:hover {
  background: #dc2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.connect-btn ion-icon {
  font-size: 16px;
}


.menu-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 15px;
}

.menu-group {
  margin-bottom: 5px;
}

.menu-header {
  padding: 12px 15px;
  cursor: pointer;
  border-radius: 6px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: 0.2s;
  font-weight: 500;
}

.menu-header:hover {
  background: var(--sidebar-hover);
  color: #fff;
}

.menu-header.active {
  background: var(--sidebar-hover);
  color: var(--accent);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chev-icon {
  transition: transform 0.3s ease;
  font-size: 14px;
}

.rotate-90 {
  transform: rotate(180deg);
}

.submenu {
  padding-left: 40px;
  overflow: hidden;
}

.submenu-item {
  padding: 10px 0;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: 0.2s;
  display: block;
}

.submenu-item:hover {
  color: var(--accent);
}

.status-card-container {
  padding: 20px;
}

.drone-status-card {
  background: var(--sidebar-hover);
  padding: 15px;
  border-radius: 8px;
  font-size: 13px;
  border: 1px solid #3f3f46;
  margin-bottom: 20px;
}

.battery-bar {
  height: 6px;
  background: #444;
  margin: 8px 0;
  border-radius: 3px;
  overflow: hidden;
}

.battery-fill {
  height: 100%;
  background: #10b981;
  transition: width 0.5s;
}

/* --- MAP AREA --- */
.map-view {
  position: relative;
  height: 100%;
  width: 100%;
  background: #0f0f0f;
}

#map {
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* HUD */
.hud-top-bar {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(10px);
  padding: 12px 40px;
  border-radius: 8px;
  display: flex;
  gap: 50px;
  z-index: 1000;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric.network-status {
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  padding-left: 30px;
}

.metric .label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.metric .label ion-icon {
  font-size: 16px;
  color: #10b981;
}

.metric .label ion-icon.offline {
  color: #ef4444;
}

.metric .value {
  font-size: 24px;
  font-weight: 700;
  font-family: monospace;
  color: #fff;
  margin-top: 4px;
}

.metric .value.map-status {
  font-size: 12px;
  color: #3b82f6;
  font-weight: 500;
}

/* 独立地图控制面板 */
.map-control-panel {
  position: absolute;
  left: 18px;
  top: 15px;
  background: rgba(29, 28, 53, 0.9);
  backdrop-filter: blur(10px);
  padding: 6px 14px;
  border-radius: 10px;
  z-index: 1000;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  min-width: 180px;
}

.map-control-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--accent);
  margin-bottom: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: relative;
  cursor: pointer;
}

.map-control-header ion-icon {
  font-size: 16px;
  position: relative;
  transition: transform 0.3s ease;
}

.map-control-header:hover ion-icon {
  transform: scale(1.1);
}

/* 涟漪效果 */
.map-control-header::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.3);
  opacity: 0;
  transition: all 0.6s ease;
}

.map-control-header:hover::before {
  opacity: 1;
  animation: ripple 1.5s ease-out infinite;
}

@keyframes ripple {
  0% {
    transform: translateY(-50%) scale(1);
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    transform: translateY(-50%) scale(2.5);
    opacity: 0;
  }
}

.map-source-select {
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.map-source-select:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}

.map-source-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.map-source-select option {
  background: #1a1a1a;
  color: #fff;
  padding: 10px;
}

/* 地图瓦片明亮主题（类似大疆司空2/QGC） */
:deep(.map-tiles-bright) {
  filter: brightness(1.05) contrast(1.08) saturate(1.1);
}

/* Compass Widget */
.compass-widget {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 90px;
  height: 90px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 50%;
  border: 2px solid #333;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  font-family: 'monospace';
  font-weight: bold;
}

.compass-rose {
  position: absolute;
  width: calc(100% - 10px);
  height: calc(100% - 10px);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(var(--heading-rotate, 0deg));
  transition: transform 0.1s linear;
}

.compass-rose::before,
.compass-rose::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1px;
}

.compass-rose::before {
  width: 1px;
  height: 100%;
}

.compass-rose::after {
  width: 100%;
  height: 1px;
}

.compass-direction {
  position: absolute;
  font-size: 11px;
  color: #fff;
}

.compass-direction.n {
  top: 5px;
  color: #ef4444;
}

.compass-direction.e {
  right: 5px;
}

.compass-direction.s {
  bottom: 5px;
}

.compass-direction.w {
  left: 5px;
}

.compass-heading-display {
  position: absolute;
  z-index: 2;
  font-size: 18px;
  color: var(--accent);
  text-shadow: 0 0 5px rgba(59, 130, 246, 0.7);
}

/* Video Container & Camera Toggle */
.video-container {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}

.camera-toggle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 50px;
  height: 50px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(59, 130, 246, 0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  z-index: 1001;
}

.camera-toggle:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.8);
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.camera-icon {
  width: 26px;
  height: 26px;
  filter: invert(1);
  opacity: 0.9;
  transition: opacity 0.3s ease;
}

.camera-toggle:hover .camera-icon {
  opacity: 1;
}

/* Video PiP */
.video-pip {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 320px;
  height: 180px;
  background: #000;
  border: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  font-size: 14px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 右侧无人机状态面板 */
.drone-status-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 350px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(59, 130, 246, 0.3);
  z-index: 1001;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  overflow-y: auto;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
}

.drone-status-panel.open {
  transform: translateX(0);
}

/* 滚动条样式 - 与地图背景一致 */
.drone-status-panel::-webkit-scrollbar {
  width: 8px;
}

.drone-status-panel::-webkit-scrollbar-track {
  background: rgba(15, 15, 15, 0.5);
  border-radius: 4px;
}

.drone-status-panel::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.drone-status-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.5);
}

.status-panel-toggle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 60px;
  background: rgba(59, 130, 246, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-right: none;
  border-radius: 8px 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #fff;
  font-size: 20px;
  box-shadow: -2px 0 10px rgba(59, 130, 246, 0.3);
  z-index: 1002;
}

.status-panel-toggle:hover {
  background: rgba(59, 130, 246, 0.7);
  right: 3px;
  box-shadow: -4px 0 15px rgba(59, 130, 246, 0.5);
  transform: translateY(-50%) scale(1.05);
}

.status-panel-content {
  padding: 20px;
  color: #fff;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.3);
  color: var(--accent);
}

.panel-header ion-icon {
  font-size: 24px;
}

.status-section {
  margin-bottom: 25px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 15px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title ion-icon {
  font-size: 18px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.status-item.full-width {
  grid-column: 1 / -1;
}

.status-item .label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.status-item .value {
  font-size: 16px;
  font-weight: 700;
  font-family: monospace;
  color: #fff;
}

.cell-voltages {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cell-title {
  font-size: 12px;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.cell-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.cell-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  font-size: 13px;
  font-family: monospace;
  font-weight: 600;
  color: #fff;
}

.cell-item span:first-child {
  color: #94a3b8;
}

/* Drone Icon */
:deep(.drone-marker-container) {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

:deep(.drone-svg) {
  width: 50px;
  height: 50px;
  filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
  transition: transform 0.1s linear;
}
</style>
