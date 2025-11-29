# 高德地图多地区下载指南

## 概述

DronePilot 提供了便捷的多地区高德地图瓦片下载工具，支持预先下载多个城市/地区的离线地图。

## 快速开始

### 方式一：使用 npm 命令（推荐）

```bash
# 下载北京地图（默认）
npm run download:map

# 下载所有预定义城市
npm run download:map:all

# 下载指定城市
npm run download:map:beijing
npm run download:map:shanghai

# 下载多个城市
node scripts/download-amap-regions.js beijing shanghai guangzhou
```

### 方式二：直接运行脚本

```bash
# 下载单个城市
node scripts/download-amap-regions.js beijing

# 下载多个城市
node scripts/download-amap-regions.js beijing shanghai shenzhen

# 下载所有城市
node scripts/download-amap-regions.js all
```

## 预定义城市列表

当前支持以下城市（默认下载半径 10km）：

| 代码       | 城市   | 中心坐标                    | 默认半径 |
|-----------|--------|----------------------------|---------|
| beijing   | 北京   | 39.9042, 116.4074          | 10 km   |
| shanghai  | 上海   | 31.2304, 121.4737          | 10 km   |
| guangzhou | 广州   | 23.1291, 113.2644          | 10 km   |
| shenzhen  | 深圳   | 22.5431, 114.0579          | 10 km   |
| chengdu   | 成都   | 30.5728, 104.0668          | 10 km   |
| hangzhou  | 杭州   | 30.2741, 120.1551          | 10 km   |
| xian      | 西安   | 34.3416, 108.9398          | 10 km   |
| wuhan     | 武汉   | 30.5928, 114.3055          | 10 km   |
| nanjing   | 南京   | 32.0603, 118.7969          | 10 km   |
| chongqing | 重庆   | 29.5630, 106.5516          | 10 km   |

## 自定义城市

编辑 `scripts/download-amap-regions.js` 文件，在 `REGIONS` 对象中添加新城市：

```javascript
const REGIONS = {
  // ... 现有城市 ...

  // 添加新城市
  tianjin: {
    name: '天津',
    center: { lat: 39.0842, lon: 117.2010 },
    radiusKm: 8  // 可自定义下载半径
  }
}
```

## 配置说明

### 全局配置

在 `scripts/download-amap-regions.js` 中可以修改以下配置：

```javascript
const CONFIG = {
  // 缩放级别范围
  minZoom: 14,  // 最小缩放级别
  maxZoom: 17,  // 最大缩放级别

  // 地图样式
  // style=7: 标准地图
  // style=6: 卫星图
  // style=8: 标注地图
  tileUrl: 'http://webrd01.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}',

  // 下载延迟（防止被限流）
  delay: 100,  // 毫秒

  // 输出目录
  outputDir: path.join(__dirname, '../src/renderer/tiles-amap')
}
```

### 修改下载半径

编辑 `REGIONS` 中对应城市的 `radiusKm` 值：

```javascript
beijing: {
  name: '北京',
  center: { lat: 39.9042, lon: 116.4074 },
  radiusKm: 15  // 修改为 15km
}
```

## 估算下载数据

### 瓦片数量计算

不同半径和缩放级别的瓦片数量：

| 半径  | 缩放 14-17 | 缩放 14-18 | 估算大小 |
|------|-----------|-----------|---------|
| 5km  | ~600      | ~2,000    | ~10 MB  |
| 10km | ~2,400    | ~8,000    | ~40 MB  |
| 15km | ~5,400    | ~18,000   | ~90 MB  |
| 20km | ~9,600    | ~32,000   | ~160 MB |

### 下载所有预定义城市

- 10 个城市 × 10km 半径
- 缩放级别 14-17
- 总瓦片数：约 24,000
- 总大小：约 400 MB
- 估算时间：约 40-60 分钟（延迟 100ms）

## 下载进度示例

```
🗺️  开始下载: 北京
============================================================
中心点: 39.9042, 116.4074
下载半径: 10 km
============================================================

📍 缩放级别 14:
   范围: X[13411-13419], Y[6137-6145]
   总瓦片数: 81
   进度: 81/81 (已下载: 81)
   ✅ 完成: 81/81

📍 缩放级别 15:
   范围: X[26823-26838], Y[12275-12290]
   总瓦片数: 256
   进度: 256/256 (已下载: 256)
   ✅ 完成: 256/256

...

============================================================
📊 总体统计:
   ✅ 成功下载: 2,437
   ⏭️  跳过已存在: 0
   ❌ 失败: 0
   ⏱️  总耗时: 245.3 秒
============================================================
✨ 下载完成！
```

## 使用场景

### 场景一：准备演示

```bash
# 下载演示城市（北京）
npm run download:map:beijing
```

### 场景二：多地区作业

```bash
# 下载作业相关的多个城市
node scripts/download-amap-regions.js beijing tianjin shijiazhuang
```

### 场景三：全国覆盖

```bash
# 下载所有预定义城市
npm run download:map:all
```

### 场景四：离线部署

1. 在有网络环境下载所有地图：
```bash
npm run download:map:all
```

2. 将 `src/renderer/tiles-amap/` 目录打包

3. 在离线环境部署时解压到相应位置

## 断点续传

下载工具支持自动断点续传：

- 已下载的瓦片会被跳过
- 中断后重新运行命令，会从未下载的瓦片继续
- 进度显示会标注"跳过已存在"

## 注意事项

### 1. 网络限制

- 高德地图有访问频率限制
- 建议保持默认延迟（100ms）
- 过快下载可能导致 IP 被暂时封禁

### 2. 存储空间

- 下载前确保有足够磁盘空间
- 查看预估大小表格进行规划

### 3. 坐标系统

- 高德地图使用 GCJ-02（火星坐标系）
- 前端已自动集成 WGS-84 → GCJ-02 转换
- GPS 坐标会自动偏移到正确位置

### 4. 地图样式

当前默认：标准地图（style=7）

可选样式：
- `style=6`: 卫星图（暗色，适合夜间）
- `style=7`: 标准地图（当前使用）
- `style=8`: 标注地图（仅路网和地名）

### 5. 使用条款

请遵守高德地图服务条款：
- 仅用于个人学习和项目开发
- 不得商业使用或大规模传播
- 建议注明地图来源

## 故障排查

### 问题一：下载失败

```
❌ 失败: z14/x13411/y6137.png - HTTP 403
```

**解决方案**：
1. 检查网络连接
2. 增加延迟时间（修改 `CONFIG.delay`）
3. 等待一段时间后重试
4. 更换网络环境

### 问题二：瓦片不显示

**检查清单**：
1. 确认瓦片已下载到 `src/renderer/tiles-amap/`
2. 检查目录结构：`tiles-amap/14/13411/6137.png`
3. 查看浏览器控制台是否有加载错误
4. 确认 App.vue 中的瓦片 URL 正确

### 问题三：部分区域空白

**原因**：
- 对应区域的瓦片不存在（如海洋区域）
- 下载半径不够覆盖目标区域

**解决方案**：
- 增大 `radiusKm` 值
- 下载相邻城市的地图

## 高级用法

### 自定义下载脚本

基于 `download-amap-regions.js` 创建自定义脚本：

```javascript
// scripts/download-my-area.js
const REGIONS = {
  myarea: {
    name: '我的区域',
    center: { lat: 30.0000, lon: 120.0000 },
    radiusKm: 5
  }
}

// 直接下载，不需要命令行参数
selectedRegions = ['myarea']
```

### 批量下载脚本

```bash
#!/bin/bash
# download-cities.sh

cities=("beijing" "shanghai" "guangzhou" "shenzhen")

for city in "${cities[@]}"
do
  echo "开始下载: $city"
  npm run download:map $city
  echo "完成: $city"
  echo "等待 60 秒..."
  sleep 60
done
```

### 自动化部署

```bash
# 在 CI/CD 中预先下载地图
npm run download:map:all

# 打包应用（包含离线地图）
npm run build:linux
```

## 总结

- ✅ 支持 10 个预定义城市
- ✅ 支持自定义城市和半径
- ✅ 支持断点续传
- ✅ 支持多地图样式
- ✅ 自动跳过已下载瓦片
- ✅ 详细的下载进度显示
- ✅ 简单的 npm 命令集成

需要帮助？查看 `scripts/download-amap-regions.js` 源码或提交 Issue。
