/**
 * JSBridge 原生功能适配器（盲人端）
 * 提供手电筒和截图的原生调用能力
 */

import { ERROR_CODE } from '../config.js'

/**
 * JSBridge 管理器
 */
export class NativeBridge {
  constructor() {
    this.torchCallbacks = new Map()
    this.setupMessageListener()
  }

  /**
   * 检查是否支持原生功能
   */
  isNativeAvailable() {
    // 检查 iOS WebKit
    if (window.webkit?.messageHandlers) {
      return true
    }
    // 检查 Android WebView
    if (window.android) {
      return true
    }
    return false
  }

  /**
   * 设置消息监听器
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        this.handleNativeMessage(data)
      } catch (error) {
        console.error('[NativeBridge] 解析原生消息失败:', error)
      }
    })

    // 为原生回调提供全局接口
    window.onTorchResult = (result) => {
      this.handleTorchResult(result)
    }
  }

  /**
   * 处理原生消息
   */
  handleNativeMessage(data) {
    console.log('[NativeBridge] 收到原生消息:', data)

    if (data.type === 'torchResult') {
      this.handleTorchResult(data)
    }
  }

  /**
   * 处理手电筒操作结果
   */
  handleTorchResult(result) {
    const { traceId, status, errorCode } = result

    if (!traceId) {
      console.warn('[NativeBridge] 手电筒结果缺少 traceId')
      return
    }

    const callback = this.torchCallbacks.get(traceId)
    if (!callback) {
      console.warn('[NativeBridge] 未找到手电筒回调:', traceId)
      return
    }

    // 清除超时定时器
    if (callback.timeoutId) {
      clearTimeout(callback.timeoutId)
    }

    // 调用回调
    if (status === 'done') {
      callback.onSuccess()
    } else {
      callback.onError(errorCode || ERROR_CODE.UNKNOWN)
    }

    // 清理
    this.torchCallbacks.delete(traceId)
  }

  /**
   * 打开手电筒
   * @param {string} traceId - 追踪 ID
   * @param {Function} onSuccess - 成功回调
   * @param {Function} onError - 失败回调
   * @param {number} timeout - 超时时间（毫秒）
   */
  openTorch(traceId, onSuccess, onError, timeout = 3000) {
    console.log('[NativeBridge] 打开手电筒:', traceId)

    // 记录回调
    const callback = {
      onSuccess,
      onError,
      timeoutId: setTimeout(() => {
        console.error('[NativeBridge] 手电筒操作超时:', traceId)
        onError(ERROR_CODE.TIMEOUT)
        this.torchCallbacks.delete(traceId)
      }, timeout)
    }

    this.torchCallbacks.set(traceId, callback)

    // 调用原生
    try {
      // iOS WebKit
      if (window.webkit?.messageHandlers?.openTorch) {
        window.webkit.messageHandlers.openTorch.postMessage({ traceId })
        return
      }

      // Android WebView
      if (window.android?.openTorch) {
        window.android.openTorch(traceId)
        return
      }

      // 不支持原生
      clearTimeout(callback.timeoutId)
      this.torchCallbacks.delete(traceId)
      onError(ERROR_CODE.NOT_SUPPORTED)
    } catch (error) {
      console.error('[NativeBridge] 调用原生手电筒失败:', error)
      clearTimeout(callback.timeoutId)
      this.torchCallbacks.delete(traceId)
      onError(ERROR_CODE.UNKNOWN)
    }
  }

  /**
   * 关闭手电筒
   * @param {string} traceId - 追踪 ID
   * @param {Function} onSuccess - 成功回调
   * @param {Function} onError - 失败回调
   * @param {number} timeout - 超时时间（毫秒）
   */
  closeTorch(traceId, onSuccess, onError, timeout = 3000) {
    console.log('[NativeBridge] 关闭手电筒:', traceId)

    // 记录回调
    const callback = {
      onSuccess,
      onError,
      timeoutId: setTimeout(() => {
        console.error('[NativeBridge] 手电筒操作超时:', traceId)
        onError(ERROR_CODE.TIMEOUT)
        this.torchCallbacks.delete(traceId)
      }, timeout)
    }

    this.torchCallbacks.set(traceId, callback)

    // 调用原生
    try {
      // iOS WebKit
      if (window.webkit?.messageHandlers?.closeTorch) {
        window.webkit.messageHandlers.closeTorch.postMessage({ traceId })
        return
      }

      // Android WebView
      if (window.android?.closeTorch) {
        window.android.closeTorch(traceId)
        return
      }

      // 不支持原生
      clearTimeout(callback.timeoutId)
      this.torchCallbacks.delete(traceId)
      onError(ERROR_CODE.NOT_SUPPORTED)
    } catch (error) {
      console.error('[NativeBridge] 调用原生手电筒失败:', error)
      clearTimeout(callback.timeoutId)
      this.torchCallbacks.delete(traceId)
      onError(ERROR_CODE.UNKNOWN)
    }
  }

  /**
   * 尝试使用 Web API 控制手电筒
   * @param {MediaStreamTrack} videoTrack - 视频轨道
   * @param {boolean} enabled - 是否开启
   * @returns {Promise<void>}
   */
  async applyWebTorch(videoTrack, enabled) {
    console.log(`[NativeBridge] 尝试 Web API ${enabled ? '开启' : '关闭'}手电筒`)

    if (!videoTrack) {
      throw new Error('视频轨道不存在')
    }

    const capabilities = videoTrack.getCapabilities()
    console.log('[NativeBridge] 轨道能力:', capabilities)

    // 检查是否支持手电筒
    if (!capabilities.torch) {
      throw new Error('设备不支持手电筒（Web API）')
    }

    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: enabled }]
      })
      console.log(`[NativeBridge] Web API 手电筒${enabled ? '已开启' : '已关闭'}`)
    } catch (error) {
      console.error('[NativeBridge] Web API 手电筒控制失败:', error)
      throw error
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清除所有待处理的回调
    this.torchCallbacks.forEach(callback => {
      if (callback.timeoutId) {
        clearTimeout(callback.timeoutId)
      }
    })
    this.torchCallbacks.clear()
    console.log('[NativeBridge] 资源已清理')
  }
}
