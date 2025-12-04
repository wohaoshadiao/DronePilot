# DronePilot 无人机地面站

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

一个基于 Electron + Vue 3 开发的跨平台无人机地面站应用，支持 MAVLink 协议、实时遥测数据展示、任务规划和多种地图源。

## ✨ 主要功能

- **实时遥测数据** - 显示无人机位置、高度、速度、姿态、电池等关键飞行参数
- **地图展示** - 支持高德地图、OpenStreetMap 以及离线地图
- **飞行轨迹** - 实时绘制并记录无人机飞行路径
- **飞行控制** - 手动飞行、点飞、智能倾斜摄影、全景拍摄等多种飞行模式
- **任务规划** - 航点航线、测绘任务、线性巡检等任务规划功能
- **数据管理** - 媒体文件管理和飞行日志记录
- **MAVLink 协议** - 支持标准 MAVLink 通信协议
- **跨平台支持** - Windows、macOS、Linux 全平台支持

### 地图界面
这张图片是 `DronePilot` 地面站的初始界面，参考 **大疆司空 2** 的渲染风格以及 `QGC` 地面站的使用逻辑。

![地面站](https://youke1.picui.cn/s1/2025/12/04/6931898ca7ea7.png "DronePilot")

## 🏗️ 技术架构

### 核心框架

- **[Electron](https://www.electronjs.org/)** - 跨平台桌面应用框架
- **[Vue 3](https://vuejs.org/)** - 渐进式 JavaScript 前端框架
- **[Vite](https://vitejs.dev/)** - 新一代前端构建工具
- **[Electron Vite](https://electron-vite.org/)** - Electron + Vite 开发工具

### 主要依赖

- **[Leaflet](https://leafletjs.com/)** - 开源交互式地图库
- **[node-mavlink](https://www.npmjs.com/package/node-mavlink)** - MAVLink 协议解析库
- **[WebSocket (ws)](https://github.com/websockets/ws)** - WebSocket 通信支持
- **[Ionicons](https://ionic.io/ionicons)** - 精美图标库

## 📁 项目结构

```
DronePilot/
├── dronepilot/                 # 主项目目录
│   ├── src/                    # 源代码目录
│   │   ├── main/              # Electron 主进程
│   │   │   └── index.js       # 主进程入口，MAVLink 模拟器和 IPC 通信
│   │   ├── preload/           # 预加载脚本
│   │   │   └── index.js       # 预加载脚本，暴露安全的 API 给渲染进程
│   │   └── renderer/          # 渲染进程（前端界面）
│   │       ├── src/
│   │       │   ├── App.vue           # 主应用组件
│   │       │   ├── main.js           # Vue 应用入口
│   │       │   ├── components/       # Vue 组件
│   │       │   │   └── Versions.vue  # 版本信息组件
│   │       │   └── utils/            # 工具函数
│   │       │       └── coordTransform.js  # 坐标系转换（WGS84 ↔ GCJ02）
│   │       ├── tiles/                # OSM 离线地图瓦片
│   │       └── tiles-amap/           # 高德离线地图瓦片
│   ├── resources/             # 应用资源文件
│   │   └── icon.png          # 应用图标
│   ├── build/                 # 构建配置
│   ├── public/                # 静态资源
│   ├── scripts/               # 实用脚本
│   │   └── download-amap-regions.js  # 地图瓦片下载脚本
│   ├── out/                   # 构建输出目录
│   ├── package.json           # 项目配置文件
│   ├── electron.vite.config.mjs      # Electron Vite 配置
│   ├── electron-builder.yml          # Electron Builder 打包配置
│   ├── MAP_DOWNLOAD_GUIDE.md         # 地图下载指南
│   └── OFFLINE_MAP_GUIDE.md          # 离线地图使用指南
└── interface_prev.html        # 早期界面原型
```

### 主要文件夹说明

| 文件夹                     | 说明                                                            |
| -------------------------- | --------------------------------------------------------------- |
| `src/main/`                | Electron 主进程代码，负责窗口管理、MAVLink 数据模拟、设备连接等 |
| `src/preload/`             | 预加载脚本，在渲染进程中安全地暴露 Node.js API                  |
| `src/renderer/`            | 前端界面代码，包含 Vue 组件、地图展示、遥测数据可视化等         |
| `src/renderer/tiles/`      | OpenStreetMap 离线地图瓦片存储目录                              |
| `src/renderer/tiles-amap/` | 高德地图离线瓦片存储目录                                        |
| `resources/`               | 应用图标等资源文件                                              |
| `scripts/`                 | 地图下载等辅助脚本                                              |
| `build/`                   | Electron Builder 构建资源                                       |
| `out/`                     | Vite 编译后的输出文件                                           |

## 🚀 快速开始

### 环境要求

- Node.js >= 16.x
- npm >= 7.x

### 安装依赖

```bash
cd dronepilot
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
# Windows 平台
npm run build:win

# macOS 平台
npm run build:mac

# Linux 平台
npm run build:linux
```

### 下载离线地图（可选）

```bash
# 下载所有区域离线地图
npm run download:map:all

# 下载北京区域离线地图
npm run download:map:beijing

# 下载上海区域离线地图
npm run download:map:shanghai

# 自定义区域下载
npm run download:map
```

详细的离线地图下载和配置说明，请参阅：
- [MAP_DOWNLOAD_GUIDE.md](dronepilot/MAP_DOWNLOAD_GUIDE.md)
- [OFFLINE_MAP_GUIDE.md](dronepilot/OFFLINE_MAP_GUIDE.md)

## 📖 使用说明

### 界面布局

- **左侧菜单栏** - 飞行控制、任务规划、数据库、设置等功能入口
- **中央地图区** - 实时显示无人机位置、飞行轨迹和任务规划
- **右上角工具栏** - 地图源切换（高德/OSM）、状态面板开关
- **右侧状态面板** - 实时遥测数据、姿态指示器、电池状态等

### 功能模块

#### 1. 飞行控制
- 手动飞行 (Manual Flight)
- 点击飞行 (Tap to Fly)
- 智能倾斜摄影 (Smart Oblique)
- 全景拍摄 (Panorama)

#### 2. 任务规划
- 航点航线 (Waypoint Route)
- 测绘任务 (Mapping Mission)
- 线性巡检 (Linear Inspection)

#### 3. 数据库
- 媒体文件管理 (Media Files)
- 飞行日志 (Flight Logs)

### 地图功能

- **地图源切换** - 支持高德地图和 OpenStreetMap
- **离线地图** - 支持预下载离线地图瓦片，无网络环境下使用
- **坐标系转换** - 自动处理 WGS-84 和 GCJ-02 坐标系转换
- **实时轨迹** - 显示无人机飞行路径

## 🛠️ 开发指南

### 项目命令

```bash
npm run dev              # 启动开发服务器
npm run build            # 构建项目
npm run build:unpack     # 构建但不打包
npm run format           # 格式化代码
npm run lint             # 代码检查
npm start                # 预览构建结果
```

### 代码规范

项目使用以下工具确保代码质量：
- **ESLint** - JavaScript/Vue 代码检查
- **Prettier** - 代码格式化
- **Vue ESLint Plugin** - Vue 特定规则检查

### 推荐 IDE 配置

- [VSCode](https://code.visualstudio.com/)
- [ESLint 扩展](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier 扩展](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Volar 扩展](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## 🔌 MAVLink 协议支持

项目当前包含 MAVLink 数据模拟器，用于开发和测试。如需连接真实无人机：

1. 修改 `src/main/index.js` 中的连接逻辑
2. 配置串口或网络连接参数
3. 使用 `node-mavlink` 库解析 MAVLink 消息

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

在提交 PR 之前，请确保：
1. 代码通过 ESLint 检查
2. 代码已使用 Prettier 格式化
3. 添加必要的注释和文档

## 📮 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 [Issue](https://github.com/wohaoshadiao/dronepilot/issues)
- 发送邮件至：Shuo@warnie.asia

## 🙏 致谢

- [Electron](https://www.electronjs.org/)
- [Vue.js](https://vuejs.org/)
- [Leaflet](https://leafletjs.com/)
- [MAVLink](https://mavlink.io/)

---

⭐ 如果这个项目对你有帮助，欢迎 Star！
