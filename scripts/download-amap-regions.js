const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

// 预定义的城市/地区配置
const REGIONS = {
  beijing: {
    name: '北京',
    center: { lat: 39.9042, lon: 116.4074 },
    radiusKm: 10
  },
  shanghai: {
    name: '上海',
    center: { lat: 31.2304, lon: 121.4737 },
    radiusKm: 10
  },
  guangzhou: {
    name: '广州',
    center: { lat: 23.1291, lon: 113.2644 },
    radiusKm: 10
  },
  shenzhen: {
    name: '深圳',
    center: { lat: 22.5431, lon: 114.0579 },
    radiusKm: 10
  },
  chengdu: {
    name: '成都',
    center: { lat: 30.5728, lon: 104.0668 },
    radiusKm: 10
  },
  hangzhou: {
    name: '杭州',
    center: { lat: 30.2741, lon: 120.1551 },
    radiusKm: 10
  },
  xian: {
    name: '西安',
    center: { lat: 34.3416, lon: 108.9398 },
    radiusKm: 10
  },
  wuhan: {
    name: '武汉',
    center: { lat: 30.5928, lon: 114.3055 },
    radiusKm: 10
  },
  nanjing: {
    name: '南京',
    center: { lat: 32.0603, lon: 118.7969 },
    radiusKm: 10
  },
  chongqing: {
    name: '重庆',
    center: { lat: 29.5630, lon: 106.5516 },
    radiusKm: 10
  }
}

// 全局配置
const CONFIG = {
  // 缩放级别
  minZoom: 14,
  maxZoom: 17,

  // 高德地图瓦片服务器 URL
  // style=7: 标准地图
  // style=6: 卫星图（当前使用）
  // style=8: 标注地图
  tileUrl: 'http://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',

  // 输出目录
  outputDir: path.join(__dirname, '../src/renderer/tiles-amap'),

  // 下载延迟（毫秒）
  delay: 100,

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

// 下载单个地区
async function downloadRegion(regionKey, region) {
  console.log(`\n🗺️  开始下载: ${region.name}`)
  console.log('=' .repeat(60))
  console.log(`中心点: ${region.center.lat}, ${region.center.lon}`)
  console.log(`下载半径: ${region.radiusKm} km`)
  console.log('=' .repeat(60))

  let regionDownloaded = 0
  let regionSkipped = 0
  let regionFailed = 0

  for (let zoom = CONFIG.minZoom; zoom <= CONFIG.maxZoom; zoom++) {
    const bounds = calculateTileBounds(region.center, zoom, region.radiusKm)
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
          regionSkipped++
          process.stdout.write(`\r   进度: ${processed}/${totalTiles} (跳过已存在)`)
          continue
        }

        try {
          const success = await downloadTile(url, outputPath)
          if (success) {
            downloaded++
            regionDownloaded++
          }

          // 显示进度
          process.stdout.write(`\r   进度: ${processed}/${totalTiles} (已下载: ${downloaded})`)

          // 延迟
          await sleep(CONFIG.delay)
        } catch (error) {
          regionFailed++
          console.error(`\n   ❌ 失败: z${zoom}/x${x}/y${y}.png - ${error.message}`)
        }
      }
    }

    console.log(`\r   ✅ 完成: ${downloaded}/${totalTiles}`)
  }

  return {
    downloaded: regionDownloaded,
    skipped: regionSkipped,
    failed: regionFailed
  }
}

// 主下载函数
async function downloadAllRegions() {
  console.log('🗺️  DronePilot 高德地图多地区下载器')
  console.log('=' .repeat(60))
  console.log(`缩放级别: ${CONFIG.minZoom}-${CONFIG.maxZoom}`)
  console.log(`输出目录: ${CONFIG.outputDir}`)
  console.log(`待下载地区数: ${Object.keys(REGIONS).length}`)
  console.log('=' .repeat(60))

  // 让用户选择要下载的地区
  console.log('\n可用地区:')
  Object.entries(REGIONS).forEach(([key, region], index) => {
    console.log(`  ${index + 1}. ${key} - ${region.name} (半径: ${region.radiusKm}km)`)
  })
  console.log(`  ${Object.keys(REGIONS).length + 1}. all - 下载所有地区`)

  // 从命令行参数获取选择
  const args = process.argv.slice(2)
  let selectedRegions = []

  if (args.length === 0) {
    console.log('\n使用方法:')
    console.log('  下载单个地区: node download-amap-regions.js beijing')
    console.log('  下载多个地区: node download-amap-regions.js beijing shanghai')
    console.log('  下载所有地区: node download-amap-regions.js all')
    console.log('\n默认下载: 北京')
    selectedRegions = ['beijing']
  } else if (args[0] === 'all') {
    selectedRegions = Object.keys(REGIONS)
  } else {
    selectedRegions = args.filter((key) => REGIONS[key])
    if (selectedRegions.length === 0) {
      console.error('\n❌ 错误: 无效的地区代码')
      process.exit(1)
    }
  }

  console.log(`\n将下载以下地区: ${selectedRegions.map((k) => REGIONS[k].name).join(', ')}`)
  console.log('\n开始下载...\n')

  const startTime = Date.now()
  let totalDownloaded = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const regionKey of selectedRegions) {
    const region = REGIONS[regionKey]
    const stats = await downloadRegion(regionKey, region)
    totalDownloaded += stats.downloaded
    totalSkipped += stats.skipped
    totalFailed += stats.failed
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n' + '='.repeat(60))
  console.log('📊 总体统计:')
  console.log(`   ✅ 成功下载: ${totalDownloaded}`)
  console.log(`   ⏭️  跳过已存在: ${totalSkipped}`)
  console.log(`   ❌ 失败: ${totalFailed}`)
  console.log(`   ⏱️  总耗时: ${duration} 秒`)
  console.log('='.repeat(60))
  console.log('✨ 下载完成！')
  console.log('\n提示：')
  console.log('  1. 瓦片已保存至: src/renderer/tiles-amap/')
  console.log('  2. 可以修改 REGIONS 配置添加更多城市')
  console.log('  3. 可以修改 radiusKm 调整下载范围')
}

// 运行
downloadAllRegions().catch(console.error)
