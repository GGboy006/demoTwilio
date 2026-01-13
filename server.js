import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import twilio from 'twilio';

const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const app = express();
const port = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 生成 Twilio Access Token
app.post('/token', (req, res) => {
  const { identity, roomName } = req.body;

  if (!identity || !roomName) {
    return res.status(400).json({ error: 'identity and roomName are required' });
  }

  // 创建 Access Token
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity }
  );

  // 创建 Video Grant
  const videoGrant = new VideoGrant({
    room: roomName
  });

  token.addGrant(videoGrant);

  // 返回 JWT Token
  res.json({
    identity,
    token: token.toJwt()
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Twilio Video Server is running' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  console.log(`📹 Twilio Video Token Service ready`);
  console.log(`💡 For mobile access, use your computer's IP address (e.g., http://192.168.x.x:${port})`);
});
