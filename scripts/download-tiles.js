const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

// 配置参数
const CONFIG = {
  // 中心点坐标（洛杉矶，与你的模拟数据一致）
  center: { lat: 34.0522, lon: -118.2437 },

  // 缩放级别范围（建议下载 10-17 级）
  minZoom: 10,
  maxZoom: 17,

  // 瓦片服务器 URL（使用免费的 OpenStreetMap）
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  // 备用：CartoDB Dark Matter
  // tileUrl: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',

  // 输出目录
  outputDir: path.join(__dirname, '../public/tiles'),

  // 下载延迟（毫秒，避免被服务器封禁）
  delay: 100,

  // User-Agent
  userAgent: 'DronePilot-OfflineMap/1.0'
}

// 经纬度转瓦片坐标
function lonLatToTile(lon, lat, zoom) {
  const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom))
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))
  return { x, y }
}

// 计算下载范围
function calculateTileBounds(center, zoom, radiusKm = 5) {
  // 1 度纬度 ≈ 111 km
  const latDelta = radiusKm / 111
  const lonDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180))

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
        'User-Agent': CONFIG.userAgent
      }
    }

    protocol.get(url, options, (response) => {
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
        // 瓦片不存在，跳过
        resolve(false)
      } else {
        reject(new Error(`HTTP ${response.statusCode}`))
      }
    }).on('error', reject)
  })
}

// 延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 主下载函数
async function downloadTiles() {
  console.log('🚁 DronePilot 离线地图下载器')
  console.log('=' .repeat(50))
  console.log(`中心点: ${CONFIG.center.lat}, ${CONFIG.center.lon}`)
  console.log(`缩放级别: ${CONFIG.minZoom}-${CONFIG.maxZoom}`)
  console.log(`输出目录: ${CONFIG.outputDir}`)
  console.log('=' .repeat(50))

  let totalDownloaded = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (let zoom = CONFIG.minZoom; zoom <= CONFIG.maxZoom; zoom++) {
    const bounds = calculateTileBounds(CONFIG.center, zoom, 5)
    const totalTiles = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1)

    console.log(`\n📍 缩放级别 ${zoom}:`)
    console.log(`   范围: X[${bounds.minX}-${bounds.maxX}], Y[${bounds.minY}-${bounds.maxY}]`)
    console.log(`   总瓦片数: ${totalTiles}`)

    let downloaded = 0

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        const url = CONFIG.tileUrl
          .replace('{z}', zoom)
          .replace('{x}', x)
          .replace('{y}', y)

        const outputPath = path.join(CONFIG.outputDir, `${zoom}`, `${x}`, `${y}.png`)

        // 检查文件是否已存在
        if (fs.existsSync(outputPath)) {
          totalSkipped++
          continue
        }

        try {
          const success = await downloadTile(url, outputPath)
          if (success) {
            downloaded++
            totalDownloaded++

            // 显示进度
            if (downloaded % 10 === 0) {
              process.stdout.write(`\r   下载进度: ${downloaded}/${totalTiles} (${((downloaded/totalTiles)*100).toFixed(1)}%)`)
            }
          }

          // 延迟，避免请求过快
          await sleep(CONFIG.delay)
        } catch (error) {
          totalFailed++
          console.error(`\n   ❌ 下载失败: ${url}`, error.message)
        }
      }
    }

    console.log(`\r   ✅ 完成: ${downloaded}/${totalTiles}`)
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 下载统计:')
  console.log(`   ✅ 成功下载: ${totalDownloaded}`)
  console.log(`   ⏭️  跳过: ${totalSkipped}`)
  console.log(`   ❌ 失败: ${totalFailed}`)
  console.log('='.repeat(50))
  console.log('✨ 下载完成！')
}

// 运行
downloadTiles().catch(console.error)
