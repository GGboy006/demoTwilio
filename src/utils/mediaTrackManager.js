/**
 * 全局媒体轨道管理器
 * 解决移动端摄像头独占问题
 *
 * 关键点：
 * 1. 移动端摄像头同一时间只能被一个 LocalVideoTrack 占用
 * 2. 预先创建轨道，在不同页面复用
 * 3. 强制使用后置摄像头 (facingMode: 'environment')
 */

import { createLocalTracks } from 'twilio-video';

// 全局轨道存储
let localTracks = {
  video: null,
  audio: null,
};

// 轨道状态
let tracksInitialized = false;
let initializationPromise = null;

/**
 * 检测是否为移动设备
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 初始化本地轨道（预先获取媒体）
 * 使用 createLocalTracks 而不是 getUserMedia
 *
 * @param {Object} options - 配置选项
 * @param {boolean} options.video - 是否创建视频轨道
 * @param {boolean} options.audio - 是否创建音频轨道
 * @returns {Promise<Object>} 返回创建的轨道
 */
export async function initializeLocalTracks(options = { video: true, audio: true }) {
  // 如果正在初始化，返回现有的 Promise
  if (initializationPromise) {
    return initializationPromise;
  }

  // 如果已经初始化，返回现有的轨道
  if (tracksInitialized) {
    return {
      videoTrack: localTracks.video,
      audioTrack: localTracks.audio,
    };
  }

  // 开始初始化
  initializationPromise = (async () => {
    try {
      console.log('[MediaTrackManager] 开始初始化本地轨道...');

      const trackOptions = {};

      // 配置视频轨道
      if (options.video) {
        trackOptions.video = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // 移动端强制使用后置摄像头
          facingMode: isMobileDevice() ? 'environment' : 'user',
        };
      }

      // 配置音频轨道
      if (options.audio) {
        trackOptions.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
      }

      // 使用 Twilio 的 createLocalTracks 创建轨道
      const tracks = await createLocalTracks(trackOptions);

      console.log('[MediaTrackManager] 成功创建轨道:', tracks.length);

      // 存储轨道
      tracks.forEach(track => {
        if (track.kind === 'video') {
          localTracks.video = track;
          console.log('[MediaTrackManager] 视频轨道已创建:', {
            name: track.name,
            id: track.id,
            mediaStreamTrack: track.mediaStreamTrack.getSettings(),
          });
        } else if (track.kind === 'audio') {
          localTracks.audio = track;
          console.log('[MediaTrackManager] 音频轨道已创建:', {
            name: track.name,
            id: track.id,
          });
        }
      });

      tracksInitialized = true;
      initializationPromise = null;

      return {
        videoTrack: localTracks.video,
        audioTrack: localTracks.audio,
      };
    } catch (error) {
      console.error('[MediaTrackManager] 初始化轨道失败:', error);
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * 获取现有的本地轨道（不创建新的）
 *
 * @returns {Object} 现有的轨道
 */
export function getLocalTracks() {
  return {
    videoTrack: localTracks.video,
    audioTrack: localTracks.audio,
    initialized: tracksInitialized,
  };
}

/**
 * 获取视频轨道
 * 如果不存在会自动初始化
 */
export async function getVideoTrack() {
  if (!localTracks.video) {
    await initializeLocalTracks({ video: true, audio: false });
  }
  return localTracks.video;
}

/**
 * 获取音频轨道
 * 如果不存在会自动初始化
 */
export async function getAudioTrack() {
  if (!localTracks.audio) {
    await initializeLocalTracks({ video: false, audio: true });
  }
  return localTracks.audio;
}

/**
 * 获取轨道数组（用于传递给 Twilio connect）
 *
 * @param {Object} options - 配置选项
 * @param {boolean} options.video - 是否包含视频轨道
 * @param {boolean} options.audio - 是否包含音频轨道
 * @returns {Array} 轨道数组
 */
export async function getTracksForConnection(options = { video: true, audio: true }) {
  // 确保轨道已初始化
  if (!tracksInitialized) {
    await initializeLocalTracks(options);
  }

  const tracks = [];

  if (options.video && localTracks.video) {
    tracks.push(localTracks.video);
  }

  if (options.audio && localTracks.audio) {
    tracks.push(localTracks.audio);
  }

  console.log('[MediaTrackManager] 返回轨道用于连接:', tracks.length);
  return tracks;
}

/**
 * 停止并释放指定类型的轨道
 *
 * @param {string} kind - 'video' 或 'audio'
 */
export function stopTrack(kind) {
  const track = localTracks[kind];
  if (track) {
    console.log(`[MediaTrackManager] 停止 ${kind} 轨道`);
    track.stop();
    localTracks[kind] = null;
  }
}

/**
 * 停止并释放所有轨道
 */
export function stopAllTracks() {
  console.log('[MediaTrackManager] 停止所有轨道');

  if (localTracks.video) {
    localTracks.video.stop();
    localTracks.video = null;
  }

  if (localTracks.audio) {
    localTracks.audio.stop();
    localTracks.audio = null;
  }

  tracksInitialized = false;
  initializationPromise = null;
}

/**
 * 检查轨道是否已初始化
 */
export function areTracksInitialized() {
  return tracksInitialized;
}

/**
 * 重新初始化轨道（停止旧的，创建新的）
 */
export async function reinitializeTracks(options = { video: true, audio: true }) {
  console.log('[MediaTrackManager] 重新初始化轨道...');
  stopAllTracks();
  return initializeLocalTracks(options);
}

/**
 * 获取当前使用的摄像头信息
 */
export function getCurrentCameraInfo() {
  if (!localTracks.video || !localTracks.video.mediaStreamTrack) {
    return null;
  }

  const settings = localTracks.video.mediaStreamTrack.getSettings();
  return {
    deviceId: settings.deviceId,
    facingMode: settings.facingMode,
    width: settings.width,
    height: settings.height,
    aspectRatio: settings.aspectRatio,
  };
}

/**
 * 监听轨道停止事件
 */
export function onTrackStopped(kind, callback) {
  const track = localTracks[kind];
  if (track && track.mediaStreamTrack) {
    track.mediaStreamTrack.addEventListener('ended', () => {
      console.log(`[MediaTrackManager] ${kind} 轨道已停止`);
      localTracks[kind] = null;
      callback();
    });
  }
}

export default {
  initializeLocalTracks,
  getLocalTracks,
  getVideoTrack,
  getAudioTrack,
  getTracksForConnection,
  stopTrack,
  stopAllTracks,
  areTracksInitialized,
  reinitializeTracks,
  getCurrentCameraInfo,
  onTrackStopped,
  isMobileDevice,
};
