/**
 * 监控面板增强模块
 * 为调试面板添加命令流水、网络质量、订阅层等信息
 */

/**
 * 命令事件类型
 */
export const EVENT_TYPE = {
  CMD_SENT: 'cmd_sent',
  CMD_ACK: 'cmd_ack',
  CMD_DONE: 'cmd_done',
  CMD_FAILED: 'cmd_failed',
  CMD_TIMEOUT: 'cmd_timeout',
  SNAPSHOT_RENDERED: 'snapshot_rendered',
  TORCH_SUCCESS: 'torch_success',
  TORCH_FAILED: 'torch_failed',
}

/**
 * 监控数据收集器
 */
export class MonitorCollector {
  constructor() {
    this.commandHistory = []
    this.maxHistorySize = 20
    this.metrics = {
      snapshotCount: 0,
      snapshotSuccessCount: 0,
      snapshotFailedCount: 0,
      torchSuccessCount: 0,
      torchFailedCount: 0,
      averageTTV: 0,
      totalTTV: 0
    }
  }

  /**
   * 记录命令事件
   * @param {string} eventType - 事件类型
   * @param {Object} data - 事件数据
   */
  recordEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      data: { ...data }
    }

    // 添加到历史记录
    this.commandHistory.unshift(event)

    // 限制历史记录大小
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.pop()
    }

    // 更新指标
    this.updateMetrics(eventType, data)

    console.log('[Monitor] 记录事件:', eventType, data)

    return event
  }

  /**
   * 更新指标
   */
  updateMetrics(eventType, data) {
    switch (eventType) {
      case EVENT_TYPE.SNAPSHOT_RENDERED:
        this.metrics.snapshotCount++
        this.metrics.snapshotSuccessCount++
        if (data.ttv) {
          this.metrics.totalTTV += data.ttv
          this.metrics.averageTTV = Math.round(
            this.metrics.totalTTV / this.metrics.snapshotSuccessCount
          )
        }
        break

      case EVENT_TYPE.CMD_FAILED:
        if (data.cmd === 'snapshot.request') {
          this.metrics.snapshotCount++
          this.metrics.snapshotFailedCount++
        }
        break

      case EVENT_TYPE.TORCH_SUCCESS:
        this.metrics.torchSuccessCount++
        break

      case EVENT_TYPE.TORCH_FAILED:
        this.metrics.torchFailedCount++
        break
    }
  }

  /**
   * 获取最近的命令历史
   * @param {number} limit - 限制数量
   */
  getRecentCommands(limit = 5) {
    return this.commandHistory.slice(0, limit)
  }

  /**
   * 获取指标
   */
  getMetrics() {
    return { ...this.metrics }
  }

  /**
   * 获取成功率统计
   */
  getSuccessRates() {
    const snapshotRate =
      this.metrics.snapshotCount > 0
        ? Math.round((this.metrics.snapshotSuccessCount / this.metrics.snapshotCount) * 100)
        : 100

    const torchTotal = this.metrics.torchSuccessCount + this.metrics.torchFailedCount
    const torchRate =
      torchTotal > 0
        ? Math.round((this.metrics.torchSuccessCount / torchTotal) * 100)
        : 100

    return {
      snapshot: snapshotRate,
      torch: torchRate
    }
  }

  /**
   * 清空历史记录
   */
  clearHistory() {
    this.commandHistory = []
  }

  /**
   * 重置指标
   */
  resetMetrics() {
    this.metrics = {
      snapshotCount: 0,
      snapshotSuccessCount: 0,
      snapshotFailedCount: 0,
      torchSuccessCount: 0,
      torchFailedCount: 0,
      averageTTV: 0,
      totalTTV: 0
    }
  }
}

/**
 * 格式化命令事件为显示文本
 * @param {Object} event - 事件对象
 */
export function formatEventForDisplay(event) {
  const time = new Date(event.timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })

  let text = ''
  let icon = ''
  let color = ''

  switch (event.type) {
    case EVENT_TYPE.CMD_SENT:
      icon = '📤'
      text = `发送命令: ${event.data.cmd}`
      color = '#2196f3'
      break

    case EVENT_TYPE.CMD_ACK:
      icon = '✓'
      text = `命令已接收: ${event.data.cmd}`
      color = '#4caf50'
      break

    case EVENT_TYPE.CMD_DONE:
      icon = '✓✓'
      text = `命令已完成: ${event.data.cmd}`
      color = '#4caf50'
      break

    case EVENT_TYPE.CMD_FAILED:
      icon = '✗'
      text = `命令失败: ${event.data.cmd} (${event.data.errorCode || '未知错误'})`
      color = '#f44336'
      break

    case EVENT_TYPE.CMD_TIMEOUT:
      icon = '⏱'
      text = `命令超时: ${event.data.cmd}`
      color = '#ff9800'
      break

    case EVENT_TYPE.SNAPSHOT_RENDERED:
      icon = '📷'
      text = `截图完成: ${event.data.width}×${event.data.height}, ${event.data.ttv}ms`
      color = '#4caf50'
      break

    case EVENT_TYPE.TORCH_SUCCESS:
      icon = '💡'
      text = `手电筒${event.data.action === 'on' ? '已开启' : '已关闭'}`
      color = '#4caf50'
      break

    case EVENT_TYPE.TORCH_FAILED:
      icon = '💡'
      text = `手电筒操作失败: ${event.data.errorCode || '未知错误'}`
      color = '#f44336'
      break

    default:
      icon = 'ℹ'
      text = event.type
      color = '#666'
  }

  return {
    time,
    icon,
    text,
    color
  }
}
