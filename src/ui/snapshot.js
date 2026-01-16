/**
 * 截图功能模块（志愿者端）
 * 从远程视频流中捕获高清画面
 */

import { SNAPSHOT_QUALITY, SNAPSHOT_MAX_EDGE } from '../config.js'

/**
 * 截图管理器
 */
export class SnapshotManager {
  constructor() {
    this.lastSnapshotTime = 0
    this.cooldownMs = 3000
  }

  /**
   * 检查是否在冷却中
   */
  isCoolingDown() {
    const now = Date.now()
    return now - this.lastSnapshotTime < this.cooldownMs
  }

  /**
   * 获取剩余冷却时间
   */
  getCooldownRemaining() {
    const elapsed = Date.now() - this.lastSnapshotTime
    const remaining = Math.max(0, this.cooldownMs - elapsed)
    return Math.ceil(remaining / 1000)
  }

  /**
   * 从视频元素截图
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @returns {Object} { dataUrl, blob, width, height, size }
   */
  captureFromVideo(videoElement) {
    if (!videoElement || videoElement.readyState < 2) {
      throw new Error('视频未就绪')
    }

    const startTime = performance.now()

    // 获取视频实际分辨率
    const videoWidth = videoElement.videoWidth
    const videoHeight = videoElement.videoHeight

    if (videoWidth === 0 || videoHeight === 0) {
      throw new Error('无法获取视频分辨率')
    }

    console.log(`[Snapshot] 原始视频分辨率: ${videoWidth}x${videoHeight}`)

    // 按最大边长等比缩放
    let targetWidth = videoWidth
    let targetHeight = videoHeight
    const maxEdge = Math.max(videoWidth, videoHeight)

    if (maxEdge > SNAPSHOT_MAX_EDGE) {
      const scale = SNAPSHOT_MAX_EDGE / maxEdge
      targetWidth = Math.round(videoWidth * scale)
      targetHeight = Math.round(videoHeight * scale)
      console.log(`[Snapshot] 缩放后分辨率: ${targetWidth}x${targetHeight}`)
    }

    // 创建 canvas
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法创建 Canvas Context')
    }

    // 绘制视频帧
    ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight)

    // 转换为 JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', SNAPSHOT_QUALITY)

    // 转换为 Blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('生成图片失败'))
            return
          }

          const ttv = Math.round(performance.now() - startTime)

          const result = {
            dataUrl,
            blob,
            width: targetWidth,
            height: targetHeight,
            size: blob.size,
            ttv, // Time To View
            quality: SNAPSHOT_QUALITY
          }

          console.log('[Snapshot] 截图成功:', {
            分辨率: `${targetWidth}x${targetHeight}`,
            大小: `${(blob.size / 1024).toFixed(2)} KB`,
            耗时: `${ttv} ms`,
            质量: SNAPSHOT_QUALITY
          })

          // 更新最后截图时间
          this.lastSnapshotTime = Date.now()

          resolve(result)
        },
        'image/jpeg',
        SNAPSHOT_QUALITY
      )
    })
  }

  /**
   * 下载截图
   * @param {Blob} blob - 图片 Blob
   * @param {string} filename - 文件名
   */
  downloadSnapshot(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `snapshot_${Date.now()}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    console.log(`[Snapshot] 下载截图: ${a.download}`)
  }
}

/**
 * 创建截图预览对话框
 * @param {Object} snapshot - 截图数据
 * @param {Function} onDownload - 下载回调
 * @param {Function} onClose - 关闭回调
 * @returns {HTMLElement} 对话框元素
 */
export function createSnapshotPreviewDialog(snapshot, onDownload, onClose) {
  const dialog = document.createElement('div')
  dialog.className = 'snapshot-preview-dialog'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-label', '截图预览')

  const overlay = document.createElement('div')
  overlay.className = 'snapshot-overlay'

  const content = document.createElement('div')
  content.className = 'snapshot-content'

  const header = document.createElement('div')
  header.className = 'snapshot-header'

  const title = document.createElement('h3')
  title.textContent = '截图预览'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'snapshot-close-btn'
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.onclick = () => {
    document.body.removeChild(dialog)
    if (onClose) onClose()
  }

  header.appendChild(title)
  header.appendChild(closeBtn)

  const imageContainer = document.createElement('div')
  imageContainer.className = 'snapshot-image-container'

  const img = document.createElement('img')
  img.src = snapshot.dataUrl
  img.alt = '截图'
  img.className = 'snapshot-image'

  imageContainer.appendChild(img)

  const info = document.createElement('div')
  info.className = 'snapshot-info'
  info.innerHTML = `
    <div class="info-item">
      <span class="info-label">分辨率:</span>
      <span class="info-value">${snapshot.width} × ${snapshot.height}</span>
    </div>
    <div class="info-item">
      <span class="info-label">大小:</span>
      <span class="info-value">${(snapshot.size / 1024).toFixed(2)} KB</span>
    </div>
    <div class="info-item">
      <span class="info-label">耗时:</span>
      <span class="info-value">${snapshot.ttv} ms</span>
    </div>
  `

  const actions = document.createElement('div')
  actions.className = 'snapshot-actions'

  const downloadBtn = document.createElement('button')
  downloadBtn.className = 'snapshot-download-btn'
  downloadBtn.textContent = '下载'
  downloadBtn.setAttribute('aria-label', '下载截图')
  downloadBtn.onclick = () => {
    if (onDownload) onDownload(snapshot)
  }

  actions.appendChild(downloadBtn)

  content.appendChild(header)
  content.appendChild(imageContainer)
  content.appendChild(info)
  content.appendChild(actions)

  dialog.appendChild(overlay)
  dialog.appendChild(content)

  // 添加样式
  addSnapshotStyles()

  return dialog
}

/**
 * 添加截图预览样式
 */
function addSnapshotStyles() {
  if (document.getElementById('snapshot-styles')) return

  const style = document.createElement('style')
  style.id = 'snapshot-styles'
  style.textContent = `
    .snapshot-preview-dialog {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .snapshot-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
    }

    .snapshot-content {
      position: relative;
      background: white;
      border-radius: 16px;
      padding: 20px;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .snapshot-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .snapshot-header h3 {
      margin: 0;
      font-size: 20px;
      color: #333;
    }

    .snapshot-close-btn {
      background: transparent;
      border: none;
      font-size: 24px;
      color: #666;
      cursor: pointer;
      padding: 4px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .snapshot-close-btn:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }

    .snapshot-image-container {
      flex: 1;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .snapshot-image {
      max-width: 100%;
      max-height: 60vh;
      object-fit: contain;
      border-radius: 8px;
    }

    .snapshot-info {
      display: flex;
      gap: 16px;
      padding: 12px 0;
      border-top: 1px solid #eee;
      border-bottom: 1px solid #eee;
      margin-bottom: 16px;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .info-label {
      color: #666;
    }

    .info-value {
      font-weight: bold;
      color: #333;
    }

    .snapshot-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .snapshot-download-btn {
      padding: 12px 24px;
      background: #2196f3;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s;
    }

    .snapshot-download-btn:hover {
      background: #1976d2;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    }

    .snapshot-download-btn:active {
      transform: translateY(0);
    }

    /* 移动端适配 */
    @media (max-width: 768px) {
      .snapshot-content {
        max-width: 95vw;
        max-height: 95vh;
        padding: 16px;
      }

      .snapshot-info {
        flex-direction: column;
        gap: 8px;
      }

      .snapshot-image {
        max-height: 50vh;
      }
    }
  `

  document.head.appendChild(style)
}
