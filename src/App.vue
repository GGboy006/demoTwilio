<script setup>
import { ref, onMounted, provide } from 'vue';
import InitiatorPage from './components/InitiatorPage.vue';
import HelperPage from './components/HelperPage.vue';
import { getUrlParams } from './utils/twilio';

const currentRole = ref('');
const params = ref({});
const resetKey = ref(0);

onMounted(() => {
  params.value = getUrlParams();
  currentRole.value = params.value.role;
  console.log('当前角色:', currentRole.value);
  console.log('参数:', params.value);
});

// 重置调试功能
function resetDebug() {
  console.log('重置调试状态');

  // 清除 URL 参数，回到初始选择页面
  window.history.pushState({}, '', window.location.pathname);

  // 重置状态
  currentRole.value = '';
  params.value = {};

  // 强制重新渲染组件
  resetKey.value++;

  console.log('已重置到初始状态');
}

// 提供重置方法给子组件使用
provide('resetDebug', resetDebug);
</script>

<template>
  <div class="app" :key="resetKey">
		<!-- 重置调试按钮 -->
    <button v-if="currentRole" @click="resetDebug" class="reset-debug-btn">
      <span class="reset-icon">🔄</span>
      重置调试
    </button>

    <!-- 发起人页面 -->
    <InitiatorPage v-if="currentRole === 'initiator'" />

    <!-- 接受人页面 -->
    <HelperPage v-else-if="currentRole === 'helper'" />

    <!-- 测试页面 -->
    <div v-else class="test-page">
      <h1>Twilio 视频协助系统</h1>
      <p>请选择角色进行测试：</p>
      <div class="test-links">
        <a :href="'?role=initiator&roomId=test-room&userId=initiator-1&userName=发起人'" class="btn btn-initiator">
          进入发起人页面
        </a>
        <a :href="'?role=helper&roomId=test-room&userId=helper-1&userName=协助者'" class="btn btn-helper">
          进入接受人页面
        </a>
      </div>
      <div class="tips">
        <h3>使用说明：</h3>
        <ul>
          <li>发起人：开启摄像头和麦克风，展示实时画面</li>
          <li>接受人：只开启麦克风，可以看到发起人的画面并语音指导</li>
          <li>接受人可以控制发起人的手电筒和进行拍照</li>
          <li>两个页面需要使用相同的 roomId 才能通话</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.reset-debug-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(255, 87, 34, 0.9);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.reset-debug-btn:hover {
  background: rgba(255, 87, 34, 1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.reset-debug-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.reset-icon {
  display: inline-block;
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.reset-debug-btn:hover .reset-icon {
  animation: rotate 0.5s linear infinite;
}

.test-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.test-page h1 {
  font-size: 2.5rem;
  margin-bottom: 20px;
}

.test-page p {
  font-size: 1.2rem;
  margin-bottom: 30px;
}

.test-links {
  display: flex;
  gap: 20px;
  margin-bottom: 40px;
}

.btn {
  display: inline-block;
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: bold;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.3s;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.btn-initiator {
  background: #4caf50;
  color: white;
}

.btn-initiator:hover {
  background: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
}

.btn-helper {
  background: #2196f3;
  color: white;
}

.btn-helper:hover {
  background: #0b7dda;
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
}

.tips {
  max-width: 600px;
  background: rgba(255, 255, 255, 0.1);
  padding: 20px 30px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.tips h3 {
  margin-bottom: 15px;
  font-size: 1.3rem;
}

.tips ul {
  list-style: none;
}

.tips li {
  padding: 8px 0;
  padding-left: 25px;
  position: relative;
}

.tips li:before {
  content: '✓';
  position: absolute;
  left: 0;
  font-weight: bold;
}
</style>
