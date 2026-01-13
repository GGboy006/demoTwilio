<template>
  <div class="debug-panel" :class="{ collapsed: isCollapsed }">
    <!-- 折叠/展开按钮 -->
    <div class="debug-header" @click="toggleCollapse">
      <div class="header-left">
        <span class="debug-icon">🐛</span>
        <span class="debug-title">调试日志</span>
        <span class="log-count" :class="{ 'has-error': errorCount > 0 }">
          {{ logs.length }} 条 ({{ errorCount }} 错误)
        </span>
      </div>
      <div class="header-right">
        <button @click.stop="clearLogs" class="btn-clear" title="清除日志">
          🗑️
        </button>
        <button @click.stop="exportLogs" class="btn-export" title="导出日志">
          📥
        </button>
        <span class="collapse-icon">{{ isCollapsed ? '▲' : '▼' }}</span>
      </div>
    </div>

    <!-- 日志内容 -->
    <div v-if="!isCollapsed" class="debug-content">
      <!-- 过滤器 -->
      <div class="debug-filters">
        <button
          v-for="filter in filters"
          :key="filter.value"
          @click="currentFilter = filter.value"
          :class="['filter-btn', filter.value, { active: currentFilter === filter.value }]"
        >
          {{ filter.label }} ({{ getFilterCount(filter.value) }})
        </button>
      </div>

      <!-- 日志列表 -->
      <div class="debug-logs" ref="logsContainer">
        <div
          v-for="log in filteredLogs"
          :key="log.id"
          :class="['log-item', log.type]"
        >
          <div class="log-header">
            <span class="log-icon">{{ getLogIcon(log.type) }}</span>
            <span class="log-time">{{ log.time }}</span>
            <span class="log-type">{{ getLogTypeText(log.type) }}</span>
          </div>
          <div class="log-message">{{ log.message }}</div>
          <div v-if="log.details" class="log-details">
            <pre>{{ log.details }}</pre>
          </div>
        </div>
        <div v-if="filteredLogs.length === 0" class="no-logs">
          暂无{{ currentFilter === 'all' ? '' : getLogTypeText(currentFilter) }}日志
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const isCollapsed = ref(false);
const logs = ref([]);
const currentFilter = ref('all');
const logsContainer = ref(null);
let logIdCounter = 0;

const filters = [
  { label: '全部', value: 'all' },
  { label: '成功', value: 'success' },
  { label: '信息', value: 'info' },
  { label: '警告', value: 'warning' },
  { label: '错误', value: 'error' },
];

// 错误数量
const errorCount = computed(() => {
  return logs.value.filter(log => log.type === 'error').length;
});

// 过滤后的日志
const filteredLogs = computed(() => {
  if (currentFilter.value === 'all') {
    return logs.value;
  }
  return logs.value.filter(log => log.type === currentFilter.value);
});

// 获取特定类型的日志数量
function getFilterCount(type) {
  if (type === 'all') return logs.value.length;
  return logs.value.filter(log => log.type === type).length;
}

// 添加日志
function addLog(type, message, details = null) {
  const log = {
    id: logIdCounter++,
    type,
    message,
    details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : details) : null,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    timestamp: Date.now(),
  };

  logs.value.unshift(log);

  // 限制日志数量，保留最新的100条
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100);
  }

  // 自动滚动到顶部
  nextTick(() => {
    if (logsContainer.value && !isCollapsed.value) {
      logsContainer.value.scrollTop = 0;
    }
  });
}

// 获取日志图标
function getLogIcon(type) {
  const icons = {
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
  };
  return icons[type] || 'ℹ️';
}

// 获取日志类型文本
function getLogTypeText(type) {
  const texts = {
    success: '成功',
    info: '信息',
    warning: '警告',
    error: '错误',
  };
  return texts[type] || '信息';
}

// 折叠/展开
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

// 清除日志
function clearLogs() {
  logs.value = [];
  logIdCounter = 0;
}

// 导出日志
function exportLogs() {
  const logsText = logs.value.map(log => {
    let text = `[${log.time}] [${getLogTypeText(log.type)}] ${log.message}`;
    if (log.details) {
      text += `\n详细信息:\n${log.details}`;
    }
    return text;
  }).join('\n\n');

  const blob = new Blob([logsText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `debug-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  addLog('success', '日志已导出到文件');
}

// 暴露方法给父组件使用
defineExpose({
  addLog,
  clearLogs,
});
</script>

<style scoped>
.debug-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.95);
  color: white;
  z-index: 9998;
  border-top: 2px solid #333;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;
  max-height: 50vh;
  display: flex;
  flex-direction: column;
}

.debug-panel.collapsed {
  max-height: 50px;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(40, 40, 40, 0.95);
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid #444;
}

.debug-header:hover {
  background: rgba(50, 50, 50, 0.95);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.debug-icon {
  font-size: 20px;
}

.debug-title {
  font-weight: bold;
  font-size: 16px;
}

.log-count {
  background: rgba(33, 150, 243, 0.3);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.log-count.has-error {
  background: rgba(244, 67, 54, 0.3);
  color: #ff5252;
}

.btn-clear,
.btn-export {
  background: transparent;
  border: 1px solid #555;
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-clear:hover,
.btn-export:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #777;
}

.collapse-icon {
  font-size: 14px;
  color: #999;
}

.debug-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.debug-filters {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(30, 30, 30, 0.95);
  border-bottom: 1px solid #444;
  overflow-x: auto;
}

.filter-btn {
  padding: 6px 12px;
  border: 1px solid #555;
  background: transparent;
  color: #ccc;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.filter-btn.active {
  font-weight: bold;
}

.filter-btn.all.active {
  background: rgba(33, 150, 243, 0.3);
  border-color: #2196f3;
  color: #64b5f6;
}

.filter-btn.success.active {
  background: rgba(76, 175, 80, 0.3);
  border-color: #4caf50;
  color: #81c784;
}

.filter-btn.info.active {
  background: rgba(33, 150, 243, 0.3);
  border-color: #2196f3;
  color: #64b5f6;
}

.filter-btn.warning.active {
  background: rgba(255, 152, 0, 0.3);
  border-color: #ff9800;
  color: #ffb74d;
}

.filter-btn.error.active {
  background: rgba(244, 67, 54, 0.3);
  border-color: #f44336;
  color: #e57373;
}

.debug-logs {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.debug-logs::-webkit-scrollbar {
  width: 8px;
}

.debug-logs::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}

.debug-logs::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.debug-logs::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

.log-item {
  background: rgba(40, 40, 40, 0.8);
  border-left: 3px solid #555;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.log-item.success {
  border-left-color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
}

.log-item.info {
  border-left-color: #2196f3;
  background: rgba(33, 150, 243, 0.1);
}

.log-item.warning {
  border-left-color: #ff9800;
  background: rgba(255, 152, 0, 0.1);
}

.log-item.error {
  border-left-color: #f44336;
  background: rgba(244, 67, 54, 0.1);
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.log-icon {
  font-size: 16px;
}

.log-time {
  color: #999;
  font-size: 12px;
  font-family: monospace;
}

.log-type {
  font-weight: bold;
  font-size: 12px;
  text-transform: uppercase;
}

.log-item.success .log-type {
  color: #81c784;
}

.log-item.info .log-type {
  color: #64b5f6;
}

.log-item.warning .log-type {
  color: #ffb74d;
}

.log-item.error .log-type {
  color: #e57373;
}

.log-message {
  color: #eee;
  line-height: 1.5;
  word-break: break-word;
}

.log-details {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  font-size: 12px;
  max-height: 200px;
  overflow: auto;
}

.log-details pre {
  color: #aaa;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.no-logs {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 14px;
}
</style>
