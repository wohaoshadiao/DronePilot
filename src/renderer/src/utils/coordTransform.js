/**
 * 坐标系转换工具
 * WGS-84（GPS坐标）→ GCJ-02（火星坐标，高德地图使用）
 */

const PI = Math.PI
const AXIS = 6378245.0 // 长半轴
const OFFSET = 0.00669342162296594323 // 偏心率平方

/**
 * 判断是否在中国境内
 * @param {number} lng 经度
 * @param {number} lat 纬度
 * @returns {boolean}
 */
function isInChina(lng, lat) {
  // 中国境外直接返回
  return lng >= 72.004 && lng <= 137.8347 && lat >= 0.8293 && lat <= 55.8271
}

/**
 * 转换纬度
 * @param {number} lng 经度
 * @param {number} lat 纬度
 * @returns {number}
 */
function transformLat(lng, lat) {
  let ret =
    -100.0 +
    2.0 * lng +
    3.0 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng))
  ret +=
    ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0
  ret +=
    ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0
  ret +=
    ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

/**
 * 转换经度
 * @param {number} lng 经度
 * @param {number} lat 纬度
 * @returns {number}
 */
function transformLng(lng, lat) {
  let ret =
    300.0 +
    lng +
    2.0 * lat +
    0.1 * lng * lng +
    0.1 * lng * lat +
    0.1 * Math.sqrt(Math.abs(lng))
  ret +=
    ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0
  ret +=
    ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0
  ret +=
    ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

/**
 * WGS-84 转 GCJ-02
 * @param {number} wgsLng WGS-84 经度
 * @param {number} wgsLat WGS-84 纬度
 * @returns {{lng: number, lat: number}} GCJ-02 坐标
 */
export function wgs84ToGcj02(wgsLng, wgsLat) {
  // 如果不在中国境内，不进行转换
  if (!isInChina(wgsLng, wgsLat)) {
    return { lng: wgsLng, lat: wgsLat }
  }

  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0)
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0)
  const radLat = (wgsLat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - OFFSET * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((AXIS * (1 - OFFSET)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((AXIS / sqrtMagic) * Math.cos(radLat) * PI)
  const gcjLat = wgsLat + dLat
  const gcjLng = wgsLng + dLng

  return { lng: gcjLng, lat: gcjLat }
}

/**
 * GCJ-02 转 WGS-84（粗略逆转换）
 * @param {number} gcjLng GCJ-02 经度
 * @param {number} gcjLat GCJ-02 纬度
 * @returns {{lng: number, lat: number}} WGS-84 坐标
 */
export function gcj02ToWgs84(gcjLng, gcjLat) {
  if (!isInChina(gcjLng, gcjLat)) {
    return { lng: gcjLng, lat: gcjLat }
  }

  let dLat = transformLat(gcjLng - 105.0, gcjLat - 35.0)
  let dLng = transformLng(gcjLng - 105.0, gcjLat - 35.0)
  const radLat = (gcjLat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - OFFSET * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((AXIS * (1 - OFFSET)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((AXIS / sqrtMagic) * Math.cos(radLat) * PI)
  const wgsLat = gcjLat - dLat
  const wgsLng = gcjLng - dLng

  return { lng: wgsLng, lat: wgsLat }
}

/**
 * 批量转换 WGS-84 到 GCJ-02
 * @param {Array<{lng: number, lat: number}>} coords WGS-84 坐标数组
 * @returns {Array<{lng: number, lat: number}>} GCJ-02 坐标数组
 */
export function batchWgs84ToGcj02(coords) {
  return coords.map((coord) => wgs84ToGcj02(coord.lng, coord.lat))
}

/**
 * 计算两点间距离（米）
 * @param {number} lng1 第一点经度
 * @param {number} lat1 第一点纬度
 * @param {number} lng2 第二点经度
 * @param {number} lat2 第二点纬度
 * @returns {number} 距离（米）
 */
export function getDistance(lng1, lat1, lng2, lat2) {
  const radLat1 = (lat1 * PI) / 180.0
  const radLat2 = (lat2 * PI) / 180.0
  const a = radLat1 - radLat2
  const b = (lng1 * PI) / 180.0 - (lng2 * PI) / 180.0
  let s =
    2 *
    Math.asin(
      Math.sqrt(
        Math.pow(Math.sin(a / 2), 2) +
          Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
      )
    )
  s = s * 6378137.0
  s = Math.round(s * 10000) / 10000
  return s
}

// 默认导出
export default {
  wgs84ToGcj02,
  gcj02ToWgs84,
  batchWgs84ToGcj02,
  getDistance,
  isInChina
}
