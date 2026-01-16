# Twilio 视频协助系统

一个为视力困难人士提供远程视频协助的 WebView 应用，基于 Vue 3 + Vite + Twilio Video SDK 开发。

## 功能特性

·

### 发起人（视力困难者）

- ✅ 自动开启摄像头和麦克风
- ✅ 实时展示摄像头画面
- ✅ 双向语音通话
- ✅ 视频连接 Loading 状态
- ✅ 网络质量监测
- ✅ 连接状态显示
- ✅ 麦克风音量实时显示
- ✅ 挂断通话功能
- ✅ **接收并处理远程命令（截图请求、手电筒控制）**
- ✅ **手电筒控制（原生优先，Web API 降级）**

### 接受人（志愿者/协助者）

- ✅ 只开启麦克风（不发送视频）
- ✅ 全屏显示发起人的摄像头画面
- ✅ 双向语音通话
- ✅ **高清截图功能（从远程视频流本地捕获）**
- ✅ **手电筒远程控制（通过 DataTrack 控制发起人手电筒）**
- ✅ 网络质量监测
- ✅ 连接状态显示
- ✅ 麦克风音量实时显示
- ✅ 挂断通话功能
- ✅ **命令冷却与状态管理**
- ✅ **命令 ACK/重试机制**

## 新增功能说明

### 1. 高清截图（L0 实现）

**志愿者端**从本地接收的远程视频流中捕获高清画面，无需网络回传。

**特性：**

- 从 HTML5 `<video>` 元素直接捕获原始分辨率
- 自动按最大边长 1920px 等比缩放
- JPEG 质量 0.9，通常文件大小 < 1.5 MB
- 截图预览对话框（可放大、下载）
- 3 秒冷却时间防止频繁操作
- 显示分辨率、大小、耗时等指标

**实现原理：**

- 志愿者端通过 DataTrack 发送 `snapshot.request` 命令
- 发起人端收到后回复 `accepted`（实际不生成图片）
- 志愿者端从本地的 `remoteVideoRef` 的 video 元素中使用 Canvas API 截图
- 生成 JPEG Blob 并显示预览

### 2. 手电筒远程控制

**志愿者端**通过 DataTrack 发送命令，**发起人端**接收后执行手电筒控制。

**特性：**

- 优先使用原生 JSBridge（iOS/Android）
- 原生失败时自动降级到 Web API (`torch` 约束)
- 命令状态跟踪：pending → accepted → done/failed
- ACK 超时自动重试（最多 2 次）
- 3 秒冷却时间
- 友好的状态提示（Toast 通知）

**实现流程：**

```
志愿者点击开关
→ 发送 torch.on/off 命令（DataTrack）
→ 发起人收到命令，回 accepted
→ 发起人尝试原生 JSBridge
→ 原生成功：回 done | 原生失败：尝试 Web API
→ Web API 成功：回 done | Web API 失败：回 failed
→ 志愿者收到 done/failed，更新 UI 状态
```

### 3. DataTrack 通信层

**可靠的点对点命令通道：**

- 基于 Twilio LocalDataTrack / RemoteDataTrack
- 命令协议：`{ traceId, cmd, payload, ts, ttlMs }`
- 回执协议：`{ traceId, status: 'accepted'|'done'|'failed', errorCode?, metrics? }`
- 超时重试机制（800ms 超时，最多重试 2 次）
- 命令冷却防护（3 秒）

**支持的命令：**

- `snapshot.request`：截图请求
- `torch.on`：打开手电筒
- `torch.off`：关闭手电筒

### 4. 监控与调试

**内置监控收集器：**

- 记录最近 20 条命令流水
- 统计成功率、平均 TTV、错误分布
- 调试面板实时显示命令事件
- 支持事件类型：CMD_SENT、CMD_ACK、CMD_DONE、CMD_FAILED、CMD_TIMEOUT

**可观测性：**

- 每个命令都有唯一 traceId
- 完整的生命周期追踪
- 详细的错误码和降级路径日志

## 技术架构

```
demoTwilio/
├── src/
│   ├── components/
│   │   ├── InitiatorPage.vue    # 发起人页面（命令接收端）
│   │   ├── HelperPage.vue       # 接受人页面（命令发送端）
│   │   ├── DebugPanel.vue       # 调试面板
│   │   └── DeviceTest.vue       # 设备测试
│   ├── control/
│   │   └── datatrack.js         # DataTrack 通信管理器
│   ├── ui/
│   │   ├── snapshot.js          # 截图功能模块
│   │   └── torch.js             # 手电筒控制模块
│   ├── bridge/
│   │   └── native.js            # JSBridge 原生适配器
│   ├── monitor/
│   │   └── panel.js             # 监控数据收集器
│   ├── utils/
│   │   ├── twilio.js            # Twilio 工具函数
│   │   ├── webview.js           # WebView 通信工具
│   │   └── mediaTrackManager.js # 媒体轨道管理
│   ├── config.js                # 应用配置（角色、命令、常量）
│   ├── App.vue                  # 主应用组件
│   └── main.js                  # 应用入口
├── .env                         # 环境变量配置
└── package.json                 # 项目依赖
```

## 安装和运行

### 1. 安装依赖

```bash
cd demoTwilio
npm install
```

### 2. 配置 Twilio 凭证

```env
改为使用线上接口返回
```

### 3. 启动应用

```bash
# 后端使用线上接口，只需要启动前端
npm run dev     # 启动前端开发服务器（端口 5173）
```

### 4. 访问应用

- 前端: http://localhost:5173

## 使用方式

### URL 参数说明

应用通过 URL 参数识别身份和房间信息：

```
http://localhost:5173?role=initiator&roomId=room123&userId=user1&userName=张三
```

| 参数     | 说明    | 可选值                                | 必填 |
| -------- | ------- | ------------------------------------- | ---- |
| role     | 角色    | initiator（发起人）/ helper（接受人） | 是   |
| roomId   | 房间 ID | 任意字符串                            | 是   |
| userId   | 用户 ID | 任意唯一字符串                        | 是   |
| userName | 用户名  | 任意字符串                            | 否   |

**重要：** 发起人和接受人必须使用**相同的 roomId** 才能进入同一个视频房间。

### 测试方式

1. 访问 http://localhost:5173（不带参数）
2. 点击"进入发起人页面"或"进入接受人页面"
3. 在两个不同的浏览器标签页中分别打开发起人和接受人页面
4. 确保两个页面使用相同的 roomId

### 在鸿蒙 App 中集成

从 App 跳转到 WebView 时，传入 URL 参数：

```javascript
// 发起人
const url = `https://your-domain.com?role=initiator&roomId=${roomId}&userId=${userId}&userName=${userName}`;

// 接受人
const url = `https://your-domain.com?role=helper&roomId=${roomId}&userId=${userId}&userName=${userName}`;
```

## WebView 通信接口

### 从 Web 调用 App 原生功能

#### 1. 拍照功能

```javascript
// iOS (鸿蒙)
window.webkit?.messageHandlers?.capturePhoto?.postMessage({});

// Android
window.android?.capturePhoto();
```

#### 2. 手电筒控制

```javascript
// iOS (鸿蒙)
window.webkit?.messageHandlers?.flashlight?.postMessage({ action: 'on' }); // 打开
window.webkit?.messageHandlers?.flashlight?.postMessage({ action: 'off' }); // 关闭

// Android
window.android?.toggleFlashlight(true); // 打开
window.android?.toggleFlashlight(false); // 关闭
```

#### 3. 通话结束通知

```javascript
// iOS (鸿蒙)
window.webkit?.messageHandlers?.callEnded?.postMessage({});

// Android
window.android?.callEnded();
```

### 从 App 向 Web 发送消息

```javascript
// Web 端监听
window.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('收到 App 消息:', data);
});
```

## API 接口

### POST /token

生成 Twilio Access Token

**请求体：**

```json
{
  "identity": "user-123",
  "roomName": "room-456"
}
```

**响应：**

```json
{
  "identity": "user-123",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### GET /health

健康检查接口

**响应：**

```json
{
  "status": "ok",
  "message": "Twilio Video Server is running"
}
```

## 核心实现说明

### 单向视频 + 双向音频

**发起人：**

```javascript
const room = await connect(token, {
  audio: true, // 开启麦克风
  video: true, // 开启摄像头
});
```

**接受人：**

```javascript
const room = await connect(token, {
  audio: true, // 开启麦克风
  video: false, // 不开启摄像头
});
```

### 网络质量监测

```javascript
room.localParticipant.on('networkQualityLevelChanged', (quality) => {
  // quality: 0-5，数字越大质量越好
  console.log('网络质量:', quality);
});
```

### 音量监测

使用 Web Audio API 实时监测麦克风音量：

```javascript
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
// ... 实时获取音频数据
```

## 构建部署

### 开发环境

```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录，可以部署到任何静态文件服务器。

## 浏览器兼容性

- Chrome 74+
- Firefox 66+
- Safari 12.1+
- Edge 79+

**注意：** 需要 HTTPS 才能访问摄像头和麦克风（localhost 除外）。

## 常见问题

### 1. 无法获取摄像头/麦克风权限

- 确保浏览器已授权
- 确保使用 HTTPS（或 localhost）
- 检查设备是否被其他应用占用

### 2. 视频连接失败

- 检查 Twilio 凭证是否正确
- 确保后端服务正在运行
- 检查网络连接

### 3. 看不到对方

- 确保两个用户使用相同的 roomId
- 检查防火墙设置
- 查看浏览器控制台日志

### 4. 音频延迟或卡顿

- 检查网络质量
- 降低视频分辨率
- 使用有线网络

## 许可证

MIT

## 联系方式

如有问题或建议，请联系开发团队。
