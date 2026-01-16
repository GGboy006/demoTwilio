<template>
  <div class="video-page">
    <!-- Loading 状态 -->
    <div v-if="isConnecting" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>正在连接视频通话...</p>
    </div>

    <!-- 视频容器 -->
    <div class="video-container">
      <!-- 远程视频（发起人的画面 - 全屏显示） -->
      <div ref="remoteVideoRef" class="remote-video"></div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">连接状态:</span>
        <span :class="['status-value', connectionStatus]">
          {{ connectionStatusText }}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">网络质量:</span>
        <span :class="['status-value', 'quality-' + networkQuality]">
          {{ networkQualityText }}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">音量:</span>
        <div class="audio-level">
          <div class="audio-level-bar" :style="{ width: audioLevel + '%' }"></div>
          <span class="audio-level-text">{{ audioLevel }}%</span>
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="controls">
      <button @click="capturePhoto" class="btn-action btn-photo">
        <span class="icon">📷</span>
        <span>拍照</span>
      </button>

      <button @click="hangUp" class="btn-hangup">
        <span class="icon">📞</span>
        <span>挂断</span>
      </button>

      <button @click="toggleFlashlight" :class="['btn-action', 'btn-flashlight', { active: isFlashlightOn }]">
        <span class="icon">💡</span>
        <span>{{ isFlashlightOn ? '关灯' : '开灯' }}</span>
      </button>
    </div>

    <!-- 调试面板 -->
    <DebugPanel ref="debugPanelRef" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { connect } from 'twilio-video';
import { getTwilioToken, getUrlParams, monitorAudioLevel } from '../utils/twilio';
import { notifyCallEnded } from '../utils/webview';
import DebugPanel from './DebugPanel.vue';
import { DataTrackManager } from '../control/datatrack.js';
import { SnapshotManager, createSnapshotPreviewDialog } from '../ui/snapshot.js';
import { TorchController, createTorchToast } from '../ui/torch.js';
import { CMD, CMD_STATUS, COOLDOWN } from '../config.js';
import { MonitorCollector, EVENT_TYPE } from '../monitor/panel.js';

const remoteVideoRef = ref(null);
const debugPanelRef = ref(null);

const isConnecting = ref(true);
const connectionStatus = ref('connecting');
const connectionStatusText = ref('连接中');
const networkQuality = ref(0);
const networkQualityText = ref('检测中');
const audioLevel = ref(0);

// 手电筒状态
const isFlashlightOn = ref(false);
const isFlashlightPending = ref(false);

// 截图按钮状态
const isSnapshotPending = ref(false);
const snapshotCooldown = ref(0);
const torchCooldown = ref(0);

let room = null;
let stopAudioMonitor = null;

// 管理器实例
let dataTrackManager = null;
let snapshotManager = null;
let torchController = null;
let monitorCollector = null;

// 连接状态映射
const statusMap = {
  connecting: '连接中',
  connected: '已连接',
  reconnecting: '重新连接中',
  disconnected: '已断开',
};

// 网络质量映射
const qualityMap = {
  0: '检测中',
  1: '差',
  2: '较差',
  3: '一般',
  4: '良好',
  5: '优秀',
};

onMounted(async () => {
  try {
    const params = getUrlParams();
    console.log('接受人参数:', params);
    debugPanelRef.value?.addLog('info', '接受人页面初始化', params);

    // 初始化管理器
    dataTrackManager = new DataTrackManager();
    snapshotManager = new SnapshotManager();
    torchController = new TorchController();
    monitorCollector = new MonitorCollector();
    debugPanelRef.value?.addLog('success', '管理器已初始化');

    // 获取 Token
    debugPanelRef.value?.addLog('info', '正在获取 Twilio Token...', { userId: params.userId, roomId: params.roomId });
    const token = await getTwilioToken(params.userId, params.roomId);
    debugPanelRef.value?.addLog('success', 'Token 获取成功');

    // 创建 DataTrack
    const localDataTrack = dataTrackManager.createLocalDataTrack();

    // 连接到房间（只开启麦克风，包含 DataTrack）
    debugPanelRef.value?.addLog('info', '正在连接到视频房间（仅音频 + DataTrack）...', { roomId: params.roomId });
    room = await connect(token, {
      name: params.roomId,
      audio: true,
      video: false, // 接受人不发送视频
      tracks: [localDataTrack], // 包含 DataTrack
      networkQuality: {
        local: 1,
        remote: 1,
      },
    });

    console.log('成功加入房间:', room.name);
    debugPanelRef.value?.addLog('success', `成功加入房间: ${room.name}`, {
      participantSid: room.localParticipant.sid,
      participantIdentity: room.localParticipant.identity,
      mode: '仅音频（接受人模式）'
    });
    isConnecting.value = false;
    connectionStatus.value = 'connected';
    connectionStatusText.value = statusMap.connected;

    // 监听本地音频音量（接受人自己的麦克风）
    debugPanelRef.value?.addLog('info', '正在启动音频监听...');
    room.localParticipant.audioTracks.forEach((publication) => {
      stopAudioMonitor = monitorAudioLevel(publication.track.mediaStreamTrack, (level) => {
        audioLevel.value = level;
      });
      debugPanelRef.value?.addLog('success', '音频监听已启动', { trackSid: publication.trackSid });
    });

    // 监听网络质量
    debugPanelRef.value?.addLog('info', '正在监听网络质量...');
    room.localParticipant.on('networkQualityLevelChanged', (quality) => {
      networkQuality.value = quality;
      networkQualityText.value = qualityMap[quality];
      debugPanelRef.value?.addLog('info', `网络质量变化: ${qualityMap[quality]} (${quality}/5)`);
    });

    // 监听远程参与者（发起人）
    debugPanelRef.value?.addLog('info', '开始监听远程参与者（发起人）连接...');
    room.participants.forEach(participantConnected);
    room.on('participantConnected', participantConnected);
    room.on('participantDisconnected', participantDisconnected);

    // 监听房间断开
    room.on('disconnected', () => {
      connectionStatus.value = 'disconnected';
      connectionStatusText.value = statusMap.disconnected;
      console.log('已断开房间连接');
      debugPanelRef.value?.addLog('warning', '房间连接已断开');
    });

    debugPanelRef.value?.addLog('success', '所有监听器已设置完成');

  } catch (error) {
    console.error('连接失败:', error);
    debugPanelRef.value?.addLog('error', '视频连接失败', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    isConnecting.value = false;
    connectionStatus.value = 'disconnected';
    connectionStatusText.value = '连接失败';
    alert('视频连接失败: ' + error.message);
  }
});

// 参与者加入（发起人）
function participantConnected(participant) {
  console.log('参与者加入:', participant.identity);
  debugPanelRef.value?.addLog('success', `发起人加入: ${participant.identity}`, {
    participantSid: participant.sid,
    state: participant.state,
    trackCount: participant.tracks.size
  });

  // 订阅远程 DataTrack
  dataTrackManager.subscribeParticipant(participant);

  // 订阅已有的轨道
  participant.tracks.forEach((publication) => {
    if (publication.track) {
      attachTrack(publication.track);
    }
  });

  // 监听新的轨道
  participant.on('trackSubscribed', (track) => {
    debugPanelRef.value?.addLog('info', `订阅发起人轨道: ${track.kind}`, { trackSid: track.sid });
    attachTrack(track);
  });
  participant.on('trackUnsubscribed', (track) => {
    debugPanelRef.value?.addLog('warning', `取消订阅发起人轨道: ${track.kind}`, { trackSid: track.sid });
    detachTrack(track);
  });
}

// 参与者离开
function participantDisconnected(participant) {
  console.log('参与者离开:', participant.identity);
  debugPanelRef.value?.addLog('warning', `发起人离开: ${participant.identity}`, {
    participantSid: participant.sid
  });
  participant.tracks.forEach((publication) => {
    if (publication.track) {
      detachTrack(publication.track);
    }
  });
}

// 附加轨道到页面
function attachTrack(track) {
  try {
    if (track.kind === 'video') {
      const videoElement = track.attach();
      remoteVideoRef.value.appendChild(videoElement);
      debugPanelRef.value?.addLog('success', '发起人视频轨道已附加（全屏显示）', { trackName: track.name });
    } else if (track.kind === 'audio') {
      const audioElement = track.attach();
      audioElement.style.display = 'none';
      remoteVideoRef.value.appendChild(audioElement);
      debugPanelRef.value?.addLog('success', '发起人音频轨道已附加', { trackName: track.name });
    }
  } catch (error) {
    debugPanelRef.value?.addLog('error', `附加轨道失败: ${track.kind}`, { error: error.message });
  }
}

// 移除轨道
function detachTrack(track) {
  try {
    track.detach().forEach((element) => element.remove());
    debugPanelRef.value?.addLog('info', `轨道已移除: ${track.kind}`, { trackName: track.name });
  } catch (error) {
    debugPanelRef.value?.addLog('error', `移除轨道失败: ${track.kind}`, { error: error.message });
  }
}

// 拍照（截图）
async function capturePhoto() {
  debugPanelRef.value?.addLog('info', '触发截图功能');

  // 检查冷却
  if (snapshotManager.isCoolingDown()) {
    const remaining = snapshotManager.getCooldownRemaining();
    createTorchToast(`请等待 ${remaining} 秒后再截图`, 'warning');
    debugPanelRef.value?.addLog('warning', `截图冷却中，剩余 ${remaining} 秒`);
    return;
  }

  // 检查远程视频是否存在
  const videoElement = remoteVideoRef.value?.querySelector('video');
  if (!videoElement) {
    createTorchToast('未找到远程视频', 'error');
    debugPanelRef.value?.addLog('error', '未找到远程视频元素');
    return;
  }

  try {
    isSnapshotPending.value = true;

    // 发送截图请求命令
    const traceId = dataTrackManager.sendCommand(
      {
        cmd: CMD.SNAPSHOT_REQUEST,
        payload: {},
        ttlMs: COOLDOWN.SNAPSHOT
      },
      {
        onAccepted: () => {
          debugPanelRef.value?.addLog('success', '对端已接受截图请求');
          monitorCollector.recordEvent(EVENT_TYPE.CMD_ACK, { cmd: CMD.SNAPSHOT_REQUEST });
        },
        onTimeout: () => {
          createTorchToast('截图请求超时', 'error');
          debugPanelRef.value?.addLog('error', '截图请求超时');
          monitorCollector.recordEvent(EVENT_TYPE.CMD_TIMEOUT, { cmd: CMD.SNAPSHOT_REQUEST });
          isSnapshotPending.value = false;
        }
      }
    );

    debugPanelRef.value?.addLog('info', '已发送截图请求', { traceId });
    monitorCollector.recordEvent(EVENT_TYPE.CMD_SENT, { cmd: CMD.SNAPSHOT_REQUEST, traceId });

    // 等待一小段时间让对端准备
    await new Promise(resolve => setTimeout(resolve, 300));

    // 从本地的远程视频流中截图
    const snapshot = await snapshotManager.captureFromVideo(videoElement);

    debugPanelRef.value?.addLog('success', '截图成功', {
      分辨率: `${snapshot.width}×${snapshot.height}`,
      大小: `${(snapshot.size / 1024).toFixed(2)} KB`,
      耗时: `${snapshot.ttv} ms`
    });

    monitorCollector.recordEvent(EVENT_TYPE.SNAPSHOT_RENDERED, {
      width: snapshot.width,
      height: snapshot.height,
      size: snapshot.size,
      ttv: snapshot.ttv
    });

    // 显示预览对话框
    const dialog = createSnapshotPreviewDialog(
      snapshot,
      // 下载回调
      (snap) => {
        snapshotManager.downloadSnapshot(snap.blob, `snapshot_${Date.now()}.jpg`);
        debugPanelRef.value?.addLog('success', '截图已下载');
      },
      // 关闭回调
      () => {
        debugPanelRef.value?.addLog('info', '截图预览已关闭');
      }
    );

    document.body.appendChild(dialog);

  } catch (error) {
    console.error('截图失败:', error);
    createTorchToast(`截图失败: ${error.message}`, 'error');
    debugPanelRef.value?.addLog('error', '截图失败', { error: error.message });
    monitorCollector.recordEvent(EVENT_TYPE.CMD_FAILED, {
      cmd: CMD.SNAPSHOT_REQUEST,
      errorCode: 'CAPTURE_FAILED'
    });
  } finally {
    isSnapshotPending.value = false;
  }
}

// 切换手电筒
async function toggleFlashlight() {
  const targetState = !isFlashlightOn.value;
  const action = targetState ? '开启' : '关闭';
  const cmd = targetState ? CMD.TORCH_ON : CMD.TORCH_OFF;

  debugPanelRef.value?.addLog('info', `${action}手电筒`);

  // 检查冷却
  if (torchController.isCoolingDown()) {
    const remaining = torchController.getCooldownRemaining();
    createTorchToast(`请等待 ${remaining} 秒后再操作`, 'warning');
    debugPanelRef.value?.addLog('warning', `手电筒冷却中，剩余 ${remaining} 秒`);
    return;
  }

  // 检查是否有待处理的命令
  if (torchController.isPendingState()) {
    createTorchToast('手电筒操作处理中', 'info');
    debugPanelRef.value?.addLog('warning', '手电筒操作正在处理中');
    return;
  }

  try {
    torchController.setPending(true);
    isFlashlightPending.value = true;

    // 发送手电筒命令
    const traceId = dataTrackManager.sendCommand(
      {
        cmd,
        payload: {},
        ttlMs: COOLDOWN.TORCH
      },
      {
        onAccepted: () => {
          debugPanelRef.value?.addLog('success', `对端已接受手电筒${action}请求`);
          createTorchToast(`已请求对端${action}手电筒`, 'info');
          monitorCollector.recordEvent(EVENT_TYPE.CMD_ACK, { cmd });
        },
        onDone: () => {
          // 更新状态
          isFlashlightOn.value = targetState;
          torchController.setState(targetState);
          torchController.updateToggleTime();

          debugPanelRef.value?.addLog('success', `手电筒已${action}`);
          createTorchToast(`手电筒已${action}`, 'success');
          monitorCollector.recordEvent(EVENT_TYPE.TORCH_SUCCESS, { action: targetState ? 'on' : 'off' });

          torchController.setPending(false);
          isFlashlightPending.value = false;
        },
        onFailed: (response) => {
          const errorMsg = response.errorCode || '未知错误';
          debugPanelRef.value?.addLog('error', `手电筒${action}失败: ${errorMsg}`);
          createTorchToast(`手电筒操作失败: ${errorMsg}`, 'error');
          monitorCollector.recordEvent(EVENT_TYPE.TORCH_FAILED, { errorCode: errorMsg });

          torchController.setPending(false);
          isFlashlightPending.value = false;
        },
        onTimeout: () => {
          debugPanelRef.value?.addLog('error', `手电筒${action}超时`);
          createTorchToast('手电筒操作超时', 'error');
          monitorCollector.recordEvent(EVENT_TYPE.CMD_TIMEOUT, { cmd });

          torchController.setPending(false);
          isFlashlightPending.value = false;
        }
      }
    );

    debugPanelRef.value?.addLog('info', `已发送手电筒${action}命令`, { traceId });
    monitorCollector.recordEvent(EVENT_TYPE.CMD_SENT, { cmd, traceId });

  } catch (error) {
    console.error('手电筒操作失败:', error);
    createTorchToast(`手电筒操作失败: ${error.message}`, 'error');
    debugPanelRef.value?.addLog('error', '手电筒操作失败', { error: error.message });

    torchController.setPending(false);
    isFlashlightPending.value = false;
  }
}

// 挂断
function hangUp() {
  debugPanelRef.value?.addLog('info', '正在挂断通话...');

  // 断开房间
  if (room) {
    room.disconnect();
    debugPanelRef.value?.addLog('success', '房间连接已断开');
  }

  // 停止音频监听
  if (stopAudioMonitor) {
    stopAudioMonitor();
    debugPanelRef.value?.addLog('info', '音频监听已停止');
  }

  // 如果手电筒还开着，发送关闭命令
  if (isFlashlightOn.value && dataTrackManager) {
    dataTrackManager.sendCommand({
      cmd: CMD.TORCH_OFF,
      payload: {}
    });
    debugPanelRef.value?.addLog('info', '已发送手电筒关闭命令');
  }

  notifyCallEnded();
  debugPanelRef.value?.addLog('success', '通话已结束');
  alert('通话已结束');
}

onUnmounted(() => {
  // 清理房间连接
  if (room) {
    room.disconnect();
  }

  // 清理音频监听
  if (stopAudioMonitor) {
    stopAudioMonitor();
  }

  // 清理 DataTrack 管理器
  if (dataTrackManager) {
    dataTrackManager.cleanup();
  }

  debugPanelRef.value?.addLog('info', '所有资源已清理');
});
</script>

<style scoped>
.video-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #000;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  color: white;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay p {
  margin-top: 20px;
  font-size: 16px;
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.remote-video {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
}

.remote-video video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.status-bar {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: white;
  font-size: 14px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  color: #999;
  min-width: 80px;
}

.status-value {
  font-weight: bold;
}

.status-value.connected {
  color: #4caf50;
}

.status-value.connecting,
.status-value.reconnecting {
  color: #ff9800;
}

.status-value.disconnected {
  color: #f44336;
}

.status-value.quality-5 {
  color: #4caf50;
}

.status-value.quality-4 {
  color: #8bc34a;
}

.status-value.quality-3 {
  color: #ffeb3b;
}

.status-value.quality-2 {
  color: #ff9800;
}

.status-value.quality-1 {
  color: #f44336;
}

.audio-level {
  flex: 1;
  position: relative;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  overflow: hidden;
}

.audio-level-bar {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  transition: width 0.1s ease;
}

.audio-level-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  font-weight: bold;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
}

.controls {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  align-items: center;
}

.btn-action,
.btn-hangup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-action {
  background: #2196f3;
}

.btn-action:hover {
  background: #1976d2;
  transform: scale(1.05);
}

.btn-action:active {
  transform: scale(0.95);
}

.btn-hangup {
  background: #f44336;
}

.btn-hangup:hover {
  background: #d32f2f;
  transform: scale(1.05);
}

.btn-hangup:active {
  transform: scale(0.95);
}

.btn-flashlight.active {
  background: #ffc107;
}

.btn-flashlight.active:hover {
  background: #ffa000;
}

.icon {
  font-size: 24px;
}
</style>
