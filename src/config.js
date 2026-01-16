/**
 * 应用配置文件
 * 集中管理角色定义、DataTrack 配置、命令协议等
 */

// 角色定义
export const ROLE = {
  INITIATOR: 'initiator', // 发起人（盲人端）
  HELPER: 'helper',       // 接受人（志愿者端）
}

// DataTrack 可靠性配置
export const DATATRACK_RELIABILITY = {
  ordered: true,           // 保持消息顺序
  maxPacketLifeTime: 1000  // 包最大生存时间 1 秒
}

// 命令超时与重试配置
export const CMD_TTL_MS = 3000      // 命令存活时间 3 秒
export const ACK_TIMEOUT_MS = 800   // ACK 响应超时 800ms
export const RETRY_LIMIT = 2        // 最大重试次数

// 截图配置
export const SNAPSHOT_QUALITY = 0.9     // JPEG 质量 0.9
export const SNAPSHOT_MAX_EDGE = 1920   // 最大边长 1920px

// 手电筒配置
export const ENABLE_NATIVE_TORCH = true // 是否启用原生手电筒控制

// 命令类型定义
export const CMD = {
  SNAPSHOT_REQUEST: 'snapshot.request',
  TORCH_ON: 'torch.on',
  TORCH_OFF: 'torch.off',
}

// 命令状态
export const CMD_STATUS = {
  ACCEPTED: 'accepted',   // 命令已接收
  DONE: 'done',           // 命令已完成
  FAILED: 'failed',       // 命令执行失败
}

// 错误码
export const ERROR_CODE = {
  TIMEOUT: 'TIMEOUT',
  NO_PERMISSION: 'NO_PERMISSION',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  UNKNOWN: 'UNKNOWN',
}

// 冷却时间配置（毫秒）
export const COOLDOWN = {
  SNAPSHOT: 3000,   // 截图冷却 3 秒
  TORCH: 3000,      // 手电筒冷却 3 秒
}
