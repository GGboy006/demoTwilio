# Twilio 视频协助系统

一个为视力困难人士提供远程视频协助的 WebView 应用，基于 Vue 3 + Vite + Twilio Video SDK 开发。

## 功能特性

### 发起人（视力困难者）
- ✅ 自动开启摄像头和麦克风
- ✅ 实时展示摄像头画面
- ✅ 双向语音通话
- ✅ 视频连接 Loading 状态
- ✅ 网络质量监测
- ✅ 连接状态显示
- ✅ 麦克风音量实时显示
- ✅ 挂断通话功能

### 接受人（志愿者/协助者）
- ✅ 只开启麦克风（不发送视频）
- ✅ 全屏显示发起人的摄像头画面
- ✅ 双向语音通话
- ✅ 拍照功能（调用 App 原生）
- ✅ 手电筒控制（打开/关闭发起人手电筒）
- ✅ 网络质量监测
- ✅ 连接状态显示
- ✅ 麦克风音量实时显示
- ✅ 挂断通话功能

## 技术架构

```
demoTwilio/
├── src/
│   ├── components/
│   │   ├── InitiatorPage.vue    # 发起人页面
│   │   └── HelperPage.vue       # 接受人页面
│   ├── utils/
│   │   ├── twilio.js            # Twilio 工具函数
│   │   └── webview.js           # WebView 通信工具
│   ├── App.vue                  # 主应用组件
│   └── main.js                  # 应用入口
├── server.js                     # Express 后端服务
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

编辑 `.env` 文件，填入你的 Twilio 凭证：

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_API_KEY=your_api_key_here
TWILIO_API_SECRET=your_api_secret_here
PORT=3001
```

获取凭证：
- Account SID: https://www.twilio.com/console
- API Key 和 Secret: https://www.twilio.com/console/runtime/api-keys

### 3. 启动应用

```bash
# 同时启动前端和后端
npm start

# 或者分别启动
npm run server  # 启动后端服务（端口 3001）
npm run dev     # 启动前端开发服务器（端口 5173）
```

### 4. 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

## 使用方式

### URL 参数说明

应用通过 URL 参数识别身份和房间信息：

```
http://localhost:5173?role=initiator&roomId=room123&userId=user1&userName=张三
```

| 参数 | 说明 | 可选值 | 必填 |
|------|------|--------|------|
| role | 角色 | initiator（发起人）/ helper（接受人） | 是 |
| roomId | 房间ID | 任意字符串 | 是 |
| userId | 用户ID | 任意唯一字符串 | 是 |
| userName | 用户名 | 任意字符串 | 否 |

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
window.android?.toggleFlashlight(true);  // 打开
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
  audio: true,  // 开启麦克风
  video: true,  // 开启摄像头
});
```

**接受人：**
```javascript
const room = await connect(token, {
  audio: true,   // 开启麦克风
  video: false,  // 不开启摄像头
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
npm start
```

### 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录，可以部署到任何静态文件服务器。

后端服务需要单独部署：

```bash
node server.js
```

建议使用 PM2 或其他进程管理工具保持服务运行。

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
