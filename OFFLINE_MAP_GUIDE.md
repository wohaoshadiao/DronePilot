# DronePilot 离线地图使用指南

## 概述

DronePilot 支持离线地图功能，可以在没有网络连接的情况下显示地图。离线地图使用标准的 XYZ 瓦片格式存储。

## 目录结构

```
dronepilot/
├── public/
│   └── tiles/              # 离线瓦片地图目录
│       ├── 14/             # 缩放级别 14
│       │   └── 2809/       # X 坐标
│       │       └── 6541.png  # Y 坐标瓦片
│       ├── 15/             # 缩放级别 15
│       └── 16/             # 缩放级别 16
└── scripts/
    ├── download-tiles.js        # 完整下载脚本
    └── download-tiles-quick.js  # 快速测试脚本
```

## 已下载的地图数据

**当前下载状态：**
- ✅ 中心点：洛杉矶 (34.0522, -118.2437)
- ✅ 缩放级别：14-16
- ✅ 覆盖半径：2 公里
- ✅ 瓦片总数：115 个
- ✅ 使用地图：CartoDB Dark Matter

## 快速开始

### 1. 查看已下载的地图

```bash
# 查看瓦片目录
ls -la public/tiles/

# 统计瓦片数量
find public/tiles -name "*.png" | wc -l
```

### 2. 下载更多地图区域

**方式一：使用快速测试脚本（推荐用于测试）**
```bash
node scripts/download-tiles-quick.js
```

**方式二：使用完整下载脚本（更大范围）**
```bash
node scripts/download-tiles.js
```

### 3. 自定义下载范围

编辑 `scripts/download-tiles-quick.js` 或 `scripts/download-tiles.js`：

```javascript
const CONFIG = {
  // 修改中心点坐标
  center: { lat: 34.0522, lon: -118.2437 },

  // 修改缩放级别范围
  minZoom: 14,  // 最小缩放级别
  maxZoom: 16,  // 最大缩放级别

  // 修改覆盖半径（公里）
  radiusKm: 2,  // 下载半径

  // 可选：更换地图样式
  tileUrl: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  // 其他选项：
  // OpenStreetMap: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  // CartoDB Light: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
}
```

## 地图样式选择

### 可用的免费地图源：

1. **CartoDB Dark Matter**（当前使用）
   - URL: `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`
   - 特点：深色主题，适合夜间使用

2. **OpenStreetMap**
   - URL: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
   - 特点：标准地图，细节丰富

3. **CartoDB Light**
   - URL: `https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`
   - 特点：浅色主题，适合白天使用

4. **Esri World Imagery**（卫星图）
   - URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
   - 特点：卫星影像

## 估算下载数据量

### 瓦片数量计算

- 缩放级别 14：约 9 个瓦片（2km 半径）
- 缩放级别 15：约 25 个瓦片
- 缩放级别 16：约 81 个瓦片
- **总计约 115 个瓦片**

### 存储空间

- 每个瓦片约 10-20 KB
- 115 个瓦片约需 **1.5 MB** 存储空间

### 更大范围示例

| 半径 | 缩放级别 | 瓦片数 | 存储空间 |
|------|---------|--------|----------|
| 2 km | 14-16   | ~115   | ~1.5 MB  |
| 5 km | 14-16   | ~400   | ~6 MB    |
| 10 km| 14-17   | ~2000  | ~30 MB   |
| 20 km| 10-17   | ~10000 | ~150 MB  |

## 前端集成

### 代码实现

离线地图已自动集成到前端：

```javascript
// src/renderer/src/App.vue

const initMap = () => {
  // 使用本地离线瓦片地图
  const tileUrl = import.meta.env.DEV
    ? 'http://localhost:5173/tiles/{z}/{x}/{y}.png'  // 开发模式
    : './tiles/{z}/{x}/{y}.png'  // 生产模式

  L.tileLayer(tileUrl, {
    maxZoom: 20,
    minZoom: 14,
    errorTileUrl: '',  // 瓦片不存在时显示空白
  }).addTo(map)
}
```

### 自动回退机制

如果需要在线地图作为备选，可以添加：

```javascript
const tileUrl = import.meta.env.DEV
  ? 'http://localhost:5173/tiles/{z}/{x}/{y}.png'
  : './tiles/{z}/{x}/{y}.png'

const layer = L.tileLayer(tileUrl, {
  maxZoom: 20,
  minZoom: 14,
  errorTileUrl: '',
}).addTo(map)

// 如果加载失败，切换到在线地图
layer.on('tileerror', () => {
  console.warn('离线瓦片加载失败，尝试在线地图')
  L.tileLayer('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    maxZoom: 20
  }).addTo(map)
})
```

## 下载注意事项

### 1. 下载限制

- 大多数瓦片服务器有速率限制
- 脚本已内置 50-100ms 延迟
- 建议分批下载大范围区域

### 2. User-Agent

脚本已设置合适的 User-Agent：
```javascript
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
```

### 3. 使用条款

请遵守各地图服务提供商的使用条款：
- OpenStreetMap: [使用政策](https://operations.osmfoundation.org/policies/tiles/)
- CartoDB: [使用条款](https://carto.com/legal/)

## 常见问题

### Q: 如何下载其他城市的地图？

A: 修改脚本中的 `center` 坐标：
```javascript
center: { lat: 39.9042, lon: 116.4074 },  // 北京
// 或
center: { lat: 31.2304, lon: 121.4737 },  // 上海
```

### Q: 下载速度慢怎么办？

A: 可以修改 `delay` 参数，但要注意：
```javascript
delay: 20,  // 更快，但可能被封禁
delay: 100, // 安全，但较慢
```

### Q: 如何删除不需要的地图？

A: 直接删除对应的瓦片目录：
```bash
# 删除缩放级别 14
rm -rf public/tiles/14

# 删除所有瓦片
rm -rf public/tiles/*
```

### Q: 打包后地图无法显示？

A: 确保在 `electron-builder.yml` 中包含 `public/tiles`:
```yaml
files:
  - "**/*"
  - "public/tiles/**/*"
```

## 性能优化

### 1. 使用合适的缩放级别

- 级别 10-13：大范围浏览
- 级别 14-16：正常飞行（推荐）
- 级别 17-19：详细查看

### 2. 预加载策略

```javascript
L.tileLayer(tileUrl, {
  keepBuffer: 5,      // 保留更多瓦片在内存中
  updateWhenIdle: true, // 地图停止移动时才更新
})
```

## 生产部署

### 1. 打包前准备

```bash
# 确保瓦片已下载
ls public/tiles/

# 检查瓦片数量
find public/tiles -name "*.png" | wc -l
```

### 2. 构建应用

```bash
npm run build

# 打包（根据目标平台选择）
npm run build:linux
npm run build:win
npm run build:mac
```

### 3. 验证打包结果

打包后的应用应该包含：
```
dist/
└── linux-unpacked/
    └── resources/
        └── app.asar（包含 tiles 目录）
```

## 进阶功能

### 混合在线/离线模式

```javascript
// 优先使用离线地图，缺失时自动使用在线地图
const offlineLayer = L.tileLayer('./tiles/{z}/{x}/{y}.png', {
  errorTileUrl: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
})
```

### 地图缓存管理

```javascript
// 清理旧的缓存瓦片
function clearOldTiles() {
  const tilesDir = path.join(__dirname, '../public/tiles')
  // 实现清理逻辑
}
```

## 总结

- ✅ 离线地图已成功集成
- ✅ 支持标准 XYZ 瓦片格式
- ✅ 提供快速下载脚本
- ✅ 自动适配开发/生产环境
- ✅ 可自定义下载范围和样式

需要帮助？查看 [Leaflet 文档](https://leafletjs.com/reference.html) 或提交 Issue。
