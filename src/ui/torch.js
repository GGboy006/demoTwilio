/**
 * 手电筒控制模块（志愿者端）
 * 通过 DataTrack 发送手电筒控制命令
 */

import { COOLDOWN } from '../config.js'

/**
 * 手电筒控制器
 */
export class TorchController {
  constructor() {
    this.isOn = false
    this.lastToggleTime = 0
    this.cooldownMs = COOLDOWN.TORCH
    this.isPending = false
  }

  /**
   * 检查是否在冷却中
   */
  isCoolingDown() {
    const now = Date.now()
    return now - this.lastToggleTime < this.cooldownMs
  }

  /**
   * 获取剩余冷却时间（秒）
   */
  getCooldownRemaining() {
    const elapsed = Date.now() - this.lastToggleTime
    const remaining = Math.max(0, this.cooldownMs - elapsed)
    return Math.ceil(remaining / 1000)
  }

  /**
   * 设置当前状态
   */
  setState(isOn) {
    this.isOn = isOn
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.isOn
  }

  /**
   * 设置待处理状态
   */
  setPending(isPending) {
    this.isPending = isPending
  }

  /**
   * 检查是否待处理
   */
  isPendingState() {
    return this.isPending
  }

  /**
   * 更新最后切换时间
   */
  updateToggleTime() {
    this.lastToggleTime = Date.now()
  }

  /**
   * 重置状态
   */
  reset() {
    this.isOn = false
    this.isPending = false
  }
}

/**
 * 创建手电筒状态提示
 * @param {string} message - 提示消息
 * @param {string} type - 类型: 'info', 'success', 'error', 'warning'
 * @returns {HTMLElement} 提示元素
 */
export function createTorchToast(message, type = 'info') {
  // 移除之前的提示
  const existing = document.querySelector('.torch-toast')
  if (existing) {
    existing.remove()
  }

  const toast = document.createElement('div')
  toast.className = `torch-toast torch-toast-${type}`
  toast.textContent = message

  // 添加样式（如果还没有）
  addTorchStyles()

  document.body.appendChild(toast)

  // 动画显示
  requestAnimationFrame(() => {
    toast.classList.add('show')
  })

  // 3秒后移除
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 3000)

  return toast
}

/**
 * 添加手电筒相关样式
 */
function addTorchStyles() {
  if (document.getElementById('torch-styles')) return

  const style = document.createElement('style')
  style.id = 'torch-styles'
  style.textContent = `
    .torch-toast {
      position: fixed;
      top: 100px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      color: white;
      z-index: 9999;
      opacity: 0;
      transition: all 0.3s ease;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .torch-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .torch-toast-info {
      background: #2196f3;
    }

    .torch-toast-success {
      background: #4caf50;
    }

    .torch-toast-error {
      background: #f44336;
    }

    .torch-toast-warning {
      background: #ff9800;
    }
  `

  document.head.appendChild(style)
}
