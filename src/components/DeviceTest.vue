<template>
  <div class="device-test-modal" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>设备测试</h2>
        <button @click="closeModal" class="btn-close">✕</button>
      </div>

      <div class="modal-body">
        <!-- 移动端提示 -->
        <div v-if="isMobileDevice()" class="mobile-notice">
          <span class="notice-icon">📱</span>
          <div class="notice-content">
            <strong>移动端提示：</strong>
            <p>检测到移动设备，视频通话将自动使用后置摄像头以获得最佳效果。</p>
          </div>
        </div>

        <!-- 设备选择 -->
        <div class="device-section">
          <h3>📹 视频设备</h3>
          <select v-model="selectedVideoDevice" @change="changeVideoDevice" class="device-select">
            <option value="">选择摄像头...</option>
            <option v-for="device in videoDevices" :key="device.deviceId" :value="device.deviceId">
              {{ device.label || `摄像头 ${device.deviceId.substring(0, 8)}` }}
            </option>
          </select>
          <div class="video-preview-container">
            <video ref="videoPreviewRef" autoplay playsinline muted class="video-preview"></video>
            <div v-if="!isVideoActive" class="preview-placeholder">
              <span class="placeholder-icon">📹</span>
              <p>请选择摄像头开始预览</p>
            </div>
          </div>
        </div>

        <!-- 音频设备 -->
        <div class="device-section">
          <h3>🎤 音频设备</h3>
          <select v-model="selectedAudioDevice" @change="changeAudioDevice" class="device-select">
            <option value="">选择麦克风...</option>
            <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
              {{ device.label || `麦克风 ${device.deviceId.substring(0, 8)}` }}
            </option>
          </select>
          <div class="audio-test-container">
            <div class="audio-level-display">
              <div class="level-bar" :style="{ width: audioLevel + '%' }"></div>
              <span class="level-text">{{ audioLevel }}%</span>
            </div>
            <p class="audio-hint">
              {{ isAudioActive ? '🎤 正在监听麦克风...' : '请选择麦克风并说话测试' }}
            </p>
          </div>
        </div>

        <!-- 扬声器设备（如果支持） -->
        <div class="device-section" v-if="audioOutputDevices.length > 0">
          <h3>🔊 扬声器设备</h3>
          <select v-model="selectedAudioOutputDevice" @change="changeAudioOutputDevice" class="device-select">
            <option value="">选择扬声器...</option>
            <option v-for="device in audioOutputDevices" :key="device.deviceId" :value="device.deviceId">
              {{ device.label || `扬声器 ${device.deviceId.substring(0, 8)}` }}
            </option>
          </select>
          <button @click="testSpeaker" class="btn-test-speaker" :disabled="!selectedAudioOutputDevice">
            {{ isTestingAudio ? '正在播放...' : '🔊 测试扬声器' }}
          </button>
        </div>

        <!-- 设备状态 -->
        <div class="device-status">
          <div class="status-item" :class="{ active: isVideoActive }">
            <span class="status-icon">{{ isVideoActive ? '✅' : '⚪' }}</span>
            <span>摄像头</span>
          </div>
          <div class="status-item" :class="{ active: isAudioActive }">
            <span class="status-icon">{{ isAudioActive ? '✅' : '⚪' }}</span>
            <span>麦克风</span>
          </div>
          <div class="status-item" :class="{ active: permissionsGranted }">
            <span class="status-icon">{{ permissionsGranted ? '✅' : '⚪' }}</span>
            <span>权限已授予</span>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="error-message">
          <span class="error-icon">⚠️</span>
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="requestPermissions" class="btn btn-secondary">
          🔐 请求设备权限
        </button>
        <button @click="refreshDevices" class="btn btn-secondary">
          🔄 刷新设备列表
        </button>
        <button @click="closeModal" class="btn btn-primary">
          完成测试
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { getLocalTracks, initializeLocalTracks, getCurrentCameraInfo, isMobileDevice } from '../utils/mediaTrackManager';

const emit = defineEmits(['close']);

const videoDevices = ref([]);
const audioDevices = ref([]);
const audioOutputDevices = ref([]);

const selectedVideoDevice = ref('');
const selectedAudioDevice = ref('');
const selectedAudioOutputDevice = ref('');

const videoPreviewRef = ref(null);
const isVideoActive = ref(false);
const isAudioActive = ref(false);
const audioLevel = ref(0);
const permissionsGranted = ref(false);
const errorMessage = ref('');
const isTestingAudio = ref(false);

let videoStream = null;
let audioStream = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let animationFrameId = null;
let testAudio = null;

// 获取设备列表
async function getDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    videoDevices.value = devices.filter(device => device.kind === 'videoinput');
    audioDevices.value = devices.filter(device => device.kind === 'audioinput');
    audioOutputDevices.value = devices.filter(device => device.kind === 'audiooutput');

    console.log('视频设备:', videoDevices.value);
    console.log('音频输入设备:', audioDevices.value);
    console.log('音频输出设备:', audioOutputDevices.value);

    // 检查是否已授予权限（如果设备有 label，说明已授权）
    permissionsGranted.value = videoDevices.value.some(d => d.label) || audioDevices.value.some(d => d.label);
  } catch (error) {
    console.error('获取设备列表失败:', error);
    errorMessage.value = '无法获取设备列表: ' + error.message;
  }
}

// 请求设备权限
async function requestPermissions() {
  errorMessage.value = '';
  try {
    // 请求摄像头和麦克风权限
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    // 立即停止流，我们只是为了请求权限
    stream.getTracks().forEach(track => track.stop());

    permissionsGranted.value = true;

    // 重新获取设备列表（现在应该有 label 了）
    await getDevices();

    // 自动选择第一个设备
    if (videoDevices.value.length > 0 && !selectedVideoDevice.value) {
      selectedVideoDevice.value = videoDevices.value[0].deviceId;
      await changeVideoDevice();
    }
    if (audioDevices.value.length > 0 && !selectedAudioDevice.value) {
      selectedAudioDevice.value = audioDevices.value[0].deviceId;
      await changeAudioDevice();
    }
  } catch (error) {
    console.error('请求权限失败:', error);
    errorMessage.value = '权限请求失败: ' + error.message;
    permissionsGranted.value = false;
  }
}

// 切换视频设备
async function changeVideoDevice() {
  errorMessage.value = '';

  // 停止之前的视频流
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
    isVideoActive.value = false;
  }

  if (!selectedVideoDevice.value) return;

  try {
    // 【重要】移动端不允许切换摄像头，仅作预览用途
    // 实际使用时会通过全局轨道管理器使用固定的后置摄像头
    const isMobile = isMobileDevice();

    if (isMobile) {
      console.log('[DeviceTest] 移动端检测到，设备预览仅供参考，实际通话使用后置摄像头');
    }

    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: selectedVideoDevice.value } }
    });

    if (videoPreviewRef.value) {
      videoPreviewRef.value.srcObject = videoStream;
      isVideoActive.value = true;
    }
  } catch (error) {
    console.error('启动摄像头失败:', error);
    errorMessage.value = '启动摄像头失败: ' + error.message;
    isVideoActive.value = false;
  }
}

// 切换音频设备
async function changeAudioDevice() {
  errorMessage.value = '';

  // 停止之前的音频流
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }

  // 清理音频分析器
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  isAudioActive.value = false;
  audioLevel.value = 0;

  if (!selectedAudioDevice.value) return;

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: selectedAudioDevice.value } }
    });

    // 设置音频分析器
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(audioStream);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);

    isAudioActive.value = true;

    // 开始监听音量
    monitorAudioLevel();
  } catch (error) {
    console.error('启动麦克风失败:', error);
    errorMessage.value = '启动麦克风失败: ' + error.message;
    isAudioActive.value = false;
  }
}

// 监听音频音量
function monitorAudioLevel() {
  if (!analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const checkLevel = () => {
    if (!analyser) return;

    analyser.getByteFrequencyData(dataArray);

    // 计算平均音量
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const level = Math.min(100, Math.round((average / 128) * 100));

    audioLevel.value = level;

    animationFrameId = requestAnimationFrame(checkLevel);
  };

  checkLevel();
}

// 切换扬声器设备
async function changeAudioOutputDevice() {
  if (!selectedAudioOutputDevice.value) return;

  // 注意：只有支持 setSinkId 的浏览器才能切换扬声器
  if (testAudio && typeof testAudio.setSinkId === 'function') {
    try {
      await testAudio.setSinkId(selectedAudioOutputDevice.value);
      console.log('扬声器已切换');
    } catch (error) {
      console.error('切换扬声器失败:', error);
      errorMessage.value = '切换扬声器失败: ' + error.message;
    }
  }
}

// 测试扬声器
async function testSpeaker() {
  if (isTestingAudio.value) return;

  errorMessage.value = '';
  isTestingAudio.value = true;

  try {
    // 创建测试音频（使用 AudioContext 生成一个简单的测试音）
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 设置为 440Hz (A4音)
    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.3;

    oscillator.start();

    // 播放 1 秒后停止
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
      isTestingAudio.value = false;
    }, 1000);
  } catch (error) {
    console.error('测试扬声器失败:', error);
    errorMessage.value = '测试扬声器失败: ' + error.message;
    isTestingAudio.value = false;
  }
}

// 刷新设备列表
async function refreshDevices() {
  errorMessage.value = '';
  await getDevices();
}

// 关闭模态框
function closeModal() {
  // 检查是否需要预先初始化全局轨道
  const { initialized } = getLocalTracks();

  if (!initialized && (isVideoActive.value || isAudioActive.value)) {
    console.log('[DeviceTest] 关闭测试，将预先初始化全局轨道供视频通话使用');

    // 异步初始化全局轨道（不阻塞关闭）
    initializeLocalTracks({ video: true, audio: true })
      .then(() => {
        const cameraInfo = getCurrentCameraInfo();
        console.log('[DeviceTest] 全局轨道已预先初始化:', cameraInfo);
      })
      .catch(err => {
        console.error('[DeviceTest] 预初始化全局轨道失败:', err);
      });
  }

  emit('close');
}

// 清理资源
function cleanup() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (audioContext) {
    audioContext.close();
  }
  if (testAudio) {
    testAudio.pause();
    testAudio = null;
  }
}

onMounted(async () => {
  await getDevices();
});

onUnmounted(() => {
  cleanup();
});
</script>

<style scoped>
.device-test-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #f0f0f0;
  color: #333;
}

.modal-body {
  padding: 24px;
}

.mobile-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  margin-bottom: 24px;
}

.notice-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.notice-content {
  flex: 1;
}

.notice-content strong {
  display: block;
  margin-bottom: 4px;
  color: #1976d2;
}

.notice-content p {
  margin: 0;
  font-size: 14px;
  color: #555;
  line-height: 1.5;
}

.device-section {
  margin-bottom: 24px;
}

.device-section h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #333;
}

.device-select {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  margin-bottom: 16px;
  transition: border-color 0.2s;
}

.device-select:hover {
  border-color: #2196f3;
}

.device-select:focus {
  outline: none;
  border-color: #2196f3;
}

.video-preview-container {
  position: relative;
  width: 100%;
  height: 300px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  color: #999;
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.preview-placeholder p {
  margin: 0;
  font-size: 14px;
}

.audio-test-container {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

.audio-level-display {
  position: relative;
  height: 40px;
  background: #e0e0e0;
  border-radius: 20px;
  overflow: hidden;
  margin-bottom: 12px;
}

.level-bar {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  transition: width 0.1s ease;
}

.level-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: bold;
  color: #333;
  font-size: 14px;
}

.audio-hint {
  margin: 0;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.btn-test-speaker {
  width: 100%;
  padding: 12px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 12px;
}

.btn-test-speaker:hover:not(:disabled) {
  background: #1976d2;
  transform: translateY(-2px);
}

.btn-test-speaker:active:not(:disabled) {
  transform: translateY(0);
}

.btn-test-speaker:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.device-status {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border-radius: 8px;
  flex: 1;
  transition: all 0.2s;
}

.status-item.active {
  background: #e8f5e9;
  border: 1px solid #4caf50;
}

.status-icon {
  font-size: 20px;
}

.status-item span:last-child {
  font-size: 14px;
  color: #666;
}

.status-item.active span:last-child {
  color: #2e7d32;
  font-weight: bold;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #ffebee;
  border: 1px solid #ef5350;
  border-radius: 8px;
  color: #c62828;
  font-size: 14px;
}

.error-icon {
  font-size: 20px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover {
  background: #1976d2;
  transform: translateY(-2px);
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
  transform: translateY(-2px);
}

.btn:active {
  transform: translateY(0);
}
</style>
