/**
 * DataTrack 通信模块
 * 处理命令发送、接收、ACK、重试逻辑
 */

import { LocalDataTrack } from 'twilio-video'
import {
  DATATRACK_RELIABILITY,
  ACK_TIMEOUT_MS,
  RETRY_LIMIT,
  CMD_STATUS
} from '../config.js'

/**
 * DataTrack 管理器
 */
export class DataTrackManager {
  constructor() {
    this.localDataTrack = null
    this.remoteDataTracks = new Map()
    this.pendingCommands = new Map()
    this.commandHandlers = new Map()
    this.messageListeners = []
  }

  /**
   * 创建本地 DataTrack
   */
  createLocalDataTrack() {
    if (!this.localDataTrack) {
      this.localDataTrack = new LocalDataTrack({
        ...DATATRACK_RELIABILITY
      })
      console.log('[DataTrack] 本地 DataTrack 已创建')
    }
    return this.localDataTrack
  }

  /**
   * 获取本地 DataTrack（用于连接房间时传递）
   */
  getLocalDataTrack() {
    return this.localDataTrack || this.createLocalDataTrack()
  }

  /**
   * 订阅远程参与者的 DataTrack
   * @param {Participant} participant - 远程参与者
   */
  subscribeParticipant(participant) {
    console.log(`[DataTrack] 订阅参与者: ${participant.identity}`)

    // 监听已有的 DataTrack
    participant.dataTracks.forEach(publication => {
      if (publication.track) {
        this._attachRemoteDataTrack(participant.sid, publication.track)
      }
    })

    // 监听新订阅的 DataTrack
    participant.on('trackSubscribed', track => {
      if (track.kind === 'data') {
        this._attachRemoteDataTrack(participant.sid, track)
      }
    })

    // 监听取消订阅
    participant.on('trackUnsubscribed', track => {
      if (track.kind === 'data') {
        this._detachRemoteDataTrack(participant.sid, track)
      }
    })
  }

  /**
   * 附加远程 DataTrack
   */
  _attachRemoteDataTrack(participantSid, track) {
    console.log(`[DataTrack] 附加远程 DataTrack: ${participantSid}`)
    this.remoteDataTracks.set(participantSid, track)

    track.on('message', data => {
      this._handleRemoteMessage(participantSid, data)
    })
  }

  /**
   * 移除远程 DataTrack
   */
  _detachRemoteDataTrack(participantSid, track) {
    console.log(`[DataTrack] 移除远程 DataTrack: ${participantSid}`)
    this.remoteDataTracks.delete(participantSid)
  }

  /**
   * 处理远程消息
   */
  _handleRemoteMessage(participantSid, data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data
      console.log('[DataTrack] 收到远程消息:', message)

      // 触发消息监听器
      this.messageListeners.forEach(listener => {
        try {
          listener(message, participantSid)
        } catch (error) {
          console.error('[DataTrack] 消息监听器错误:', error)
        }
      })

      // 如果是命令回执，处理 pending 命令
      if (message.traceId && message.status) {
        this._handleCommandResponse(message)
      }

      // 如果是命令请求，调用对应的处理器
      if (message.cmd && this.commandHandlers.has(message.cmd)) {
        const handler = this.commandHandlers.get(message.cmd)
        handler(message, participantSid)
      }
    } catch (error) {
      console.error('[DataTrack] 处理远程消息失败:', error)
    }
  }

  /**
   * 处理命令响应（ACK/Done/Failed）
   */
  _handleCommandResponse(response) {
    const { traceId, status } = response
    const pending = this.pendingCommands.get(traceId)

    if (!pending) {
      console.warn(`[DataTrack] 未找到待处理命令: ${traceId}`)
      return
    }

    // 清除超时定时器
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId)
    }

    // 更新状态
    pending.status = status
    pending.response = response

    // 调用回调
    if (status === CMD_STATUS.ACCEPTED && pending.onAccepted) {
      pending.onAccepted(response)
    } else if (status === CMD_STATUS.DONE && pending.onDone) {
      pending.onDone(response)
    } else if (status === CMD_STATUS.FAILED && pending.onFailed) {
      pending.onFailed(response)
    }

    // 如果是最终状态，清理
    if (status === CMD_STATUS.DONE || status === CMD_STATUS.FAILED) {
      this.pendingCommands.delete(traceId)
    }
  }

  /**
   * 发送命令
   * @param {Object} command - 命令对象 { cmd, payload, ttlMs }
   * @param {Object} callbacks - 回调函数 { onAccepted, onDone, onFailed, onTimeout }
   * @returns {string} traceId
   */
  sendCommand(command, callbacks = {}) {
    if (!this.localDataTrack) {
      throw new Error('LocalDataTrack 未初始化')
    }

    const traceId = this._generateTraceId()
    const message = {
      traceId,
      cmd: command.cmd,
      payload: command.payload || {},
      ts: Date.now(),
      ttlMs: command.ttlMs
    }

    // 发送消息
    this.localDataTrack.send(JSON.stringify(message))
    console.log('[DataTrack] 发送命令:', message)

    // 记录待处理命令
    const pending = {
      traceId,
      command: message,
      status: 'pending',
      retryCount: 0,
      ...callbacks
    }

    this.pendingCommands.set(traceId, pending)

    // 设置超时定时器
    pending.timeoutId = setTimeout(() => {
      this._handleCommandTimeout(traceId)
    }, ACK_TIMEOUT_MS)

    return traceId
  }

  /**
   * 处理命令超时（ACK 未收到）
   */
  _handleCommandTimeout(traceId) {
    const pending = this.pendingCommands.get(traceId)
    if (!pending) return

    console.warn(`[DataTrack] 命令超时: ${traceId}, 重试次数: ${pending.retryCount}`)

    // 如果未达到重试上限，重试
    if (pending.retryCount < RETRY_LIMIT) {
      pending.retryCount++

      // 重新发送
      this.localDataTrack.send(JSON.stringify(pending.command))
      console.log(`[DataTrack] 重试发送命令 (${pending.retryCount}/${RETRY_LIMIT}):`, pending.command)

      // 重新设置超时
      pending.timeoutId = setTimeout(() => {
        this._handleCommandTimeout(traceId)
      }, ACK_TIMEOUT_MS)
    } else {
      // 超过重试次数，调用超时回调
      if (pending.onTimeout) {
        pending.onTimeout()
      }
      this.pendingCommands.delete(traceId)
    }
  }

  /**
   * 发送命令响应（ACK/Done/Failed）
   * @param {string} traceId - 命令跟踪 ID
   * @param {string} status - 状态
   * @param {Object} extra - 额外信息
   */
  sendResponse(traceId, status, extra = {}) {
    if (!this.localDataTrack) {
      console.error('[DataTrack] LocalDataTrack 未初始化')
      return
    }

    const response = {
      traceId,
      status,
      ts: Date.now(),
      ...extra
    }

    this.localDataTrack.send(JSON.stringify(response))
    console.log('[DataTrack] 发送响应:', response)
  }

  /**
   * 注册命令处理器
   * @param {string} cmd - 命令类型
   * @param {Function} handler - 处理函数
   */
  registerCommandHandler(cmd, handler) {
    this.commandHandlers.set(cmd, handler)
    console.log(`[DataTrack] 注册命令处理器: ${cmd}`)
  }

  /**
   * 添加消息监听器
   * @param {Function} listener - 监听函数
   */
  addMessageListener(listener) {
    this.messageListeners.push(listener)
  }

  /**
   * 移除消息监听器
   */
  removeMessageListener(listener) {
    const index = this.messageListeners.indexOf(listener)
    if (index > -1) {
      this.messageListeners.splice(index, 1)
    }
  }

  /**
   * 生成唯一的 traceId
   */
  _generateTraceId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理所有待处理命令的定时器
    this.pendingCommands.forEach(pending => {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId)
      }
    })

    this.pendingCommands.clear()
    this.remoteDataTracks.clear()
    this.commandHandlers.clear()
    this.messageListeners = []

    console.log('[DataTrack] 资源已清理')
  }
}
