/**
 * WebView 通信工具类
 * 用于与鸿蒙 App 原生功能交互
 */

/**
 * 调用拍照功能
 */
export function capturePhoto() {
  try {
    // 鸿蒙 WebView 通信
    if (window.webkit?.messageHandlers?.capturePhoto) {
      window.webkit.messageHandlers.capturePhoto.postMessage({});
    }
    // Android WebView 通信
    else if (window.android?.capturePhoto) {
      window.android.capturePhoto();
    }
    // 测试环境模拟
    else {
      console.log('📷 拍照功能被调用（测试环境）');
      alert('拍照功能（在 App 中生效）');
    }
  } catch (error) {
    console.error('拍照功能调用失败:', error);
  }
}

/**
 * 控制手电筒
 * @param {boolean} isOn - true 打开，false 关闭
 */
export function toggleFlashlight(isOn) {
  try {
    // 鸿蒙 WebView 通信
    if (window.webkit?.messageHandlers?.flashlight) {
      window.webkit.messageHandlers.flashlight.postMessage({ action: isOn ? 'on' : 'off' });
    }
    // Android WebView 通信
    else if (window.android?.toggleFlashlight) {
      window.android.toggleFlashlight(isOn);
    }
    // 测试环境模拟
    else {
      console.log(`💡 手电筒${isOn ? '打开' : '关闭'}（测试环境）`);
      alert(`手电筒${isOn ? '打开' : '关闭'}（在 App 中生效）`);
    }
  } catch (error) {
    console.error('手电筒控制失败:', error);
  }
}

/**
 * 监听来自 App 的消息
 * @param {Function} callback - 消息处理回调
 */
export function listenToAppMessages(callback) {
  const handler = (event) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      callback(data);
    } catch (error) {
      console.error('解析 App 消息失败:', error);
    }
  };

  window.addEventListener('message', handler);

  // 返回取消监听的函数
  return () => {
    window.removeEventListener('message', handler);
  };
}

/**
 * 通知 App 通话已结束
 */
export function notifyCallEnded() {
  try {
    if (window.webkit?.messageHandlers?.callEnded) {
      window.webkit.messageHandlers.callEnded.postMessage({});
    } else if (window.android?.callEnded) {
      window.android.callEnded();
    } else {
      console.log('📞 通话已结束（测试环境）');
    }
  } catch (error) {
    console.error('通知通话结束失败:', error);
  }
}
