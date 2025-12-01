<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isAuthenticated = ref(false)
const password = ref('')
const errorMessage = ref('')
const mavlinkData = ref([])
const maxDataEntries = 100 // 最多显示100条数据

// 验证密码
const handlePasswordSubmit = async () => {
  if (!password.value.trim()) {
    errorMessage.value = '请输入密码'
    return
  }

  try {
    const result = await window.electron.verifyPassword(password.value)
    if (result) {
      isAuthenticated.value = true
      errorMessage.value = ''
      // 窗口变大
      setTimeout(() => {
        const currentWindow = window
        if (currentWindow) {
          // 通过IPC让主进程调整窗口大小
          window.resizeTo(900, 700)
        }
      }, 100)
    } else {
      errorMessage.value = '密码错误'
      password.value = ''
    }
  } catch (error) {
    errorMessage.value = '验证失败: ' + error.message
  }
}

// 处理MAVLink原始数据
const handleMavlinkRawData = (data) => {
  const entry = {
    id: Date.now(),
    timestamp: new Date(data.timestamp).toLocaleTimeString(),
    ...data
  }

  mavlinkData.value.unshift(entry)

  // 限制数据条目数量
  if (mavlinkData.value.length > maxDataEntries) {
    mavlinkData.value.pop()
  }
}

// 格式化16进制显示
const toHex = (num) => {
  return '0x' + num.toString(16).toUpperCase().padStart(2, '0')
}

onMounted(() => {
  if (window.electron && window.electron.onMavlinkRawData) {
    window.electron.onMavlinkRawData(handleMavlinkRawData)
  }
})

onUnmounted(() => {
  if (window.electron && window.electron.removeMavlinkRawListener) {
    window.electron.removeMavlinkRawListener()
  }
})
</script>

<template>
  <div class="advanced-container">
    <!-- 密码验证界面 -->
    <div v-if="!isAuthenticated" class="password-panel">
      <div class="password-card">
        <div class="lock-icon">
          <ion-icon name="lock-closed-outline"></ion-icon>
        </div>
        <h2>高级模式</h2>
        <p class="subtitle">Advanced Mode - MAVLink Inspector</p>
        <form @submit.prevent="handlePasswordSubmit">
          <div class="input-group">
            <label>请输入密码</label>
            <input
              v-model="password"
              type="password"
              placeholder="Password"
              autofocus
              class="password-input"
            />
          </div>
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          <button type="submit" class="submit-button">
            验证 / Verify
          </button>
        </form>
        <div class="hint">
          默认密码: admin123
        </div>
      </div>
    </div>

    <!-- MAVLink数据显示界面 -->
    <div v-else class="data-panel">
      <div class="panel-header">
        <div class="header-left">
          <ion-icon name="analytics-outline"></ion-icon>
          <span>MAVLink 原始数据帧</span>
        </div>
        <div class="status-badge">
          <div class="status-dot"></div>
          <span>实时接收中</span>
        </div>
      </div>

      <div class="data-container">
        <div v-if="mavlinkData.length === 0" class="no-data">
          <ion-icon name="wifi-outline"></ion-icon>
          <p>等待接收 MAVLink 数据...</p>
        </div>

        <div v-for="item in mavlinkData" :key="item.id" class="data-frame">
          <div class="frame-header">
            <span class="frame-time">{{ item.timestamp }}</span>
            <span class="frame-type">MSG ID: {{ item.msgid }}</span>
          </div>
          <div class="frame-body">
            <div class="frame-field">
              <span class="field-label">Start Sign:</span>
              <span class="field-value hex">{{ toHex(item.magic) }}</span>
            </div>
            <div class="frame-field">
              <span class="field-label">Length:</span>
              <span class="field-value">{{ item.len }}</span>
            </div>
            <div class="frame-field">
              <span class="field-label">Incompat Flags:</span>
              <span class="field-value hex">{{ toHex(item.incompat_flags) }}</span>
            </div>
            <div class="frame-field">
              <span class="field-label">Compat Flags:</span>
              <span class="field-value hex">{{ toHex(item.compat_flags) }}</span>
            </div>
            <div class="frame-field">
              <span class="field-label">Seq:</span>
              <span class="field-value">{{ item.seq }}</span>
            </div>
            <div class="frame-field">
              <span class="field-label">Sys ID:</span>
              <span class="field-value">{{ item.sysid }}</span>
            </div>
            <div class="frame-field">
              <span class="field-label">Comp ID:</span>
              <span class="field-value">{{ item.compid }}</span>
            </div>
            <div class="frame-field">
              <span class="field-label">Msg ID:</span>
              <span class="field-value">{{ item.msgid }}</span>
            </div>
            <div class="frame-field full-width">
              <span class="field-label">Payload:</span>
              <div class="payload-content">
                <pre>{{ JSON.stringify(item.payload, null, 2) }}</pre>
              </div>
            </div>
            <div class="frame-field">
              <span class="field-label">Checksum:</span>
              <span class="field-value hex">{{ toHex(item.checksum) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.advanced-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

/* 密码验证界面 */
.password-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.password-card {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  padding: 40px;
  width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  text-align: center;
}

.lock-icon {
  font-size: 48px;
  color: #3b82f6;
  margin-bottom: 20px;
}

.password-card h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #fff;
}

.subtitle {
  margin: 0 0 30px 0;
  font-size: 13px;
  color: #94a3b8;
  font-weight: 400;
}

.input-group {
  margin-bottom: 20px;
  text-align: left;
}

.input-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
}

.password-input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.password-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message {
  padding: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 15px;
}

.submit-button {
  width: 100%;
  padding: 12px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-button:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.submit-button:active {
  transform: translateY(0);
}

.hint {
  margin-top: 20px;
  font-size: 12px;
  color: #64748b;
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

/* MAVLink数据显示界面 */
.data-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 20px 25px;
  background: rgba(15, 23, 42, 0.9);
  border-bottom: 1px solid rgba(59, 130, 246, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  color: #3b82f6;
}

.header-left ion-icon {
  font-size: 24px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 20px;
  font-size: 12px;
  color: #10b981;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.data-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
}

.no-data ion-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.data-frame {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.data-frame:hover {
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.frame-header {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.frame-time {
  font-family: monospace;
  font-size: 13px;
  color: #94a3b8;
}

.frame-type {
  font-size: 12px;
  color: #3b82f6;
  font-weight: 600;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
}

.frame-body {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.frame-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.frame-field.full-width {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.field-value {
  font-family: monospace;
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}

.field-value.hex {
  color: #10b981;
}

.payload-content {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 12px;
  margin-top: 4px;
}

.payload-content pre {
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
}

/* 滚动条样式 */
.data-container::-webkit-scrollbar {
  width: 8px;
}

.data-container::-webkit-scrollbar-track {
  background: rgba(15, 15, 15, 0.5);
  border-radius: 4px;
}

.data-container::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.data-container::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.5);
}
</style>
