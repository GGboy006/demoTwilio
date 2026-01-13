<template>
  <div class="video-page">
    <!-- Loading 状态 -->
    <div v-if="isConnecting" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>正在连接视频通话...</p>
    </div>

    <!-- 视频容器 -->
    <div class="video-container">
      <!-- 本地视频（发起人自己的摄像头） -->
      <div ref="localVideoRef" class="local-video"></div>

      <!-- 远程视频（接受人看到发起人的画面） -->
      <div ref="remoteVideoRef" class="remote-video"></div>
    </div>

    <!-- 参与者加入通知 -->
    <div v-if="showJoinNotification" class="join-notification">
      <div class="notification-icon">👤</div>
      <div class="notification-content">
        <div class="notification-title">{{ joinNotificationTitle }}</div>
        <div class="notification-message">{{ joinNotificationMessage }}</div>
      </div>
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
      <button @click="hangUp" class="btn-hangup">
        <span class="icon">📞</span>
        <span>挂断</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { connect } from 'twilio-video';
import { getTwilioToken, getUrlParams, monitorAudioLevel } from '../utils/twilio';
import { notifyCallEnded } from '../utils/webview';

const localVideoRef = ref(null);
const remoteVideoRef = ref(null);

const isConnecting = ref(true);
const connectionStatus = ref('connecting');
const connectionStatusText = ref('连接中');
const networkQuality = ref(0);
const networkQualityText = ref('检测中');
const audioLevel = ref(0);

// 参与者加入通知
const showJoinNotification = ref(false);
const joinNotificationTitle = ref('');
const joinNotificationMessage = ref('');
let notificationTimer = null;

let room = null;
let stopAudioMonitor = null;

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
    console.log('发起人参数:', params);

    // 获取 Token
    const token = await getTwilioToken(params.userId, params.roomId);

    // 连接到房间（开启摄像头和麦克风）
    room = await connect(token, {
      name: params.roomId,
      audio: true,
      video: { width: 640, height: 480 },
      networkQuality: {
        local: 1,
        remote: 1,
      },
    });

    console.log('成功加入房间:', room.name);
    isConnecting.value = false;
    connectionStatus.value = 'connected';
    connectionStatusText.value = statusMap.connected;

    // 显示本地视频
    room.localParticipant.videoTracks.forEach((publication) => {
      const videoElement = publication.track.attach();
      localVideoRef.value.appendChild(videoElement);
    });

    // 监听本地音频音量
    room.localParticipant.audioTracks.forEach((publication) => {
      stopAudioMonitor = monitorAudioLevel(publication.track.mediaStreamTrack, (level) => {
        audioLevel.value = level;
      });
    });

    // 监听网络质量
    room.localParticipant.on('networkQualityLevelChanged', (quality) => {
      networkQuality.value = quality;
      networkQualityText.value = qualityMap[quality];
    });

    // 监听远程参与者
    room.participants.forEach(participantConnected);
    room.on('participantConnected', participantConnected);
    room.on('participantDisconnected', participantDisconnected);

    // 监听房间断开
    room.on('disconnected', () => {
      connectionStatus.value = 'disconnected';
      connectionStatusText.value = statusMap.disconnected;
      console.log('已断开房间连接');
    });

  } catch (error) {
    console.error('连接失败:', error);
    isConnecting.value = false;
    connectionStatus.value = 'disconnected';
    connectionStatusText.value = '连接失败';
    alert('视频连接失败: ' + error.message);
  }
});

// 显示加入通知
function showParticipantJoinedNotification(participantName) {
  // 清除之前的定时器
  if (notificationTimer) {
    clearTimeout(notificationTimer);
  }

  joinNotificationTitle.value = '新成员加入';
  joinNotificationMessage.value = `${participantName} 已加入通话`;
  showJoinNotification.value = true;

  // 3秒后自动隐藏
  notificationTimer = setTimeout(() => {
    showJoinNotification.value = false;
  }, 3000);
}

// 参与者加入
function participantConnected(participant) {
  console.log('参与者加入:', participant.identity);

  // 显示加入通知
  showParticipantJoinedNotification(participant.identity);

  // 订阅已有的轨道
  participant.tracks.forEach((publication) => {
    if (publication.track) {
      attachTrack(publication.track);
    }
  });

  // 监听新的轨道
  participant.on('trackSubscribed', attachTrack);
  participant.on('trackUnsubscribed', detachTrack);
}

// 参与者离开
function participantDisconnected(participant) {
  console.log('参与者离开:', participant.identity);
  participant.tracks.forEach((publication) => {
    if (publication.track) {
      detachTrack(publication.track);
    }
  });
}

// 附加轨道到页面
function attachTrack(track) {
  if (track.kind === 'video') {
    const videoElement = track.attach();
    remoteVideoRef.value.appendChild(videoElement);
  } else if (track.kind === 'audio') {
    const audioElement = track.attach();
    audioElement.style.display = 'none';
    remoteVideoRef.value.appendChild(audioElement);
  }
}

// 移除轨道
function detachTrack(track) {
  track.detach().forEach((element) => element.remove());
}

// 挂断
function hangUp() {
  if (room) {
    room.disconnect();
  }
  if (stopAudioMonitor) {
    stopAudioMonitor();
  }
  notifyCallEnded();
  alert('通话已结束');
}

onUnmounted(() => {
  if (room) {
    room.disconnect();
  }
  if (stopAudioMonitor) {
    stopAudioMonitor();
  }
  if (notificationTimer) {
    clearTimeout(notificationTimer);
  }
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

.local-video {
  width: 100%;
  height: 100%;
}

.local-video video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remote-video {
  position: absolute;
  bottom: 80px;
  right: 20px;
  width: 120px;
  height: 160px;
  border: 2px solid #fff;
  border-radius: 8px;
  overflow: hidden;
  background: #333;
}

.remote-video video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.join-notification {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #4caf50;
  border-radius: 16px;
  padding: 24px 32px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.3s ease-out;
  z-index: 999;
  min-width: 300px;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translate(-50%, -60%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

.notification-icon {
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: rgba(76, 175, 80, 0.2);
  border-radius: 50%;
}

.notification-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-title {
  font-size: 18px;
  font-weight: bold;
  color: #4caf50;
}

.notification-message {
  font-size: 16px;
  color: #ccc;
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
}

.btn-hangup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-hangup:hover {
  background: #d32f2f;
  transform: scale(1.05);
}

.btn-hangup:active {
  transform: scale(0.95);
}

.icon {
  font-size: 24px;
}
</style>
