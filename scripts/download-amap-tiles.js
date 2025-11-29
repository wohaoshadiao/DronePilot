const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

// 高德地图配置
const CONFIG = {
  // 中心点坐标（洛杉矶 - WGS84）
  // 注意：高德地图主要覆盖中国区域，这里用北京作为示例
  center: { lat: 39.9042, lon: 116.4074 }, // 北京天安门

  // 缩放级别
  minZoom: 14,
  maxZoom: 17,

  // 高德地图瓦片服务器 URL
  // style=7: 标准地图
  // style=6: 卫星图
  // style=8: 标注地图
  tileUrl: 'http://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',

  // 输出目录
  outputDir: path.join(__dirname, '../src/renderer/tiles-amap'),

  // 下载延迟（毫秒）
  delay: 100,

  // 下载半径（公里）
  radiusKm: 3,

  // User-Agent
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

// 经纬度转瓦片坐标
function lonLatToTile(lon, lat, zoom) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom))
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
      Math.pow(2, zoom)
  )
  return { x, y }
}

// 计算下载范围
function calculateTileBounds(center, zoom, radiusKm) {
  const latDelta = radiusKm / 111
  const lonDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180))

  const minTile = lonLatToTile(center.lon - lonDelta, center.lat + latDelta, zoom)
  const maxTile = lonLatToTile(center.lon + lonDelta, center.lat - latDelta, zoom)

  return {
    minX: Math.min(minTile.x, maxTile.x),
    maxX: Math.max(minTile.x, maxTile.x),
    minY: Math.min(minTile.y, maxTile.y),
    maxY: Math.max(minTile.y, maxTile.y)
  }
}

// 下载单个瓦片
function downloadTile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http

    const options = {
      headers: {
        'User-Agent': CONFIG.userAgent,
        Referer: 'https://www.amap.com/',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    }

    protocol
      .get(url, options, (response) => {
        if (response.statusCode === 200) {
          const dir = path.dirname(outputPath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }

          const fileStream = fs.createWriteStream(outputPath)
          response.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close()
            resolve(true)
          })
        } else if (response.statusCode === 404) {
          resolve(false)
        } else {
          reject(new Error(`HTTP ${response.statusCode}`))
        }
      })
      .on('error', reject)
  })
}

// 延迟函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 主下载函数
async function downloadTiles() {
  console.log('🗺️  DronePilot 高德地图离线瓦片下载器')
  console.log('=' .repeat(60))
  console.log(`中心点: ${CONFIG.center.lat}, ${CONFIG.center.lon}`)
  console.log(`缩放级别: ${CONFIG.minZoom}-${CONFIG.maxZoom}`)
  console.log(`下载半径: ${CONFIG.radiusKm} km`)
  console.log(`输出目录: ${CONFIG.outputDir}`)
  console.log('=' .repeat(60))

  let totalDownloaded = 0
  let totalSkipped = 0
  let totalFailed = 0
  const startTime = Date.now()

  for (let zoom = CONFIG.minZoom; zoom <= CONFIG.maxZoom; zoom++) {
    const bounds = calculateTileBounds(CONFIG.center, zoom, CONFIG.radiusKm)
    const totalTiles = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1)

    console.log(`\n📍 缩放级别 ${zoom}:`)
    console.log(`   范围: X[${bounds.minX}-${bounds.maxX}], Y[${bounds.minY}-${bounds.maxY}]`)
    console.log(`   总瓦片数: ${totalTiles}`)

    let downloaded = 0
    let processed = 0

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        processed++
        const url = CONFIG.tileUrl.replace('{z}', zoom).replace('{x}', x).replace('{y}', y)

        const outputPath = path.join(CONFIG.outputDir, `${zoom}`, `${x}`, `${y}.png`)

        // 检查文件是否已存在
        if (fs.existsSync(outputPath)) {
          totalSkipped++
          process.stdout.write(`\r   进度: ${processed}/${totalTiles} (跳过已存在)`)
          continue
        }

        try {
          const success = await downloadTile(url, outputPath)
          if (success) {
            downloaded++
            totalDownloaded++
          }

          // 显示进度
          process.stdout.write(`\r   进度: ${processed}/${totalTiles} (已下载: ${downloaded})`)

          // 延迟
          await sleep(CONFIG.delay)
        } catch (error) {
          totalFailed++
          console.error(`\n   ❌ 失败: z${zoom}/x${x}/y${y}.png - ${error.message}`)
        }
      }
    }

    console.log(`\r   ✅ 完成: ${downloaded}/${totalTiles}`)
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n' + '='.repeat(60))
  console.log('📊 下载统计:')
  console.log(`   ✅ 成功下载: ${totalDownloaded}`)
  console.log(`   ⏭️  跳过已存在: ${totalSkipped}`)
  console.log(`   ❌ 失败: ${totalFailed}`)
  console.log(`   ⏱️  耗时: ${duration} 秒`)
  console.log('='.repeat(60))
  console.log('✨ 下载完成！')
  console.log('\n提示：')
  console.log('  1. 高德地图主要覆盖中国区域')
  console.log('  2. 如需其他区域，请使用 CartoDB 或 OpenStreetMap')
  console.log('  3. 可修改 style 参数切换地图样式：')
  console.log('     - style=7: 标准地图')
  console.log('     - style=6: 卫星图')
  console.log('     - style=8: 标注地图')
}

// 运行
downloadTiles().catch(console.error)
