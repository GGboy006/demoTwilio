/**
 * 获取 Twilio Access Token
 * @param {string} identity - 用户标识
 * @param {string} roomName - 房间名称
 * @returns {Promise<string>} Access Token
 */

export async function getTwilioToken (identity, roomName) {
	// 统一使用云函数地址
	const url = 'https://gfyap86592.sealosbja.site/other/getTwilioToken';

	console.log('Requesting token from:', url);

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ identity, roomName }),
	});

	if (!response.ok) {
		throw new Error('Failed to get Twilio token');
	}

	const result = await response.json();

	// 云函数返回格式: { token: "...", identity: "..." }
	if (result.token) {
		return result.token;
	} else {
		throw new Error('Invalid token response');
	}
}

/**
 * 从 URL 获取参数
 * @returns {Object} URL 参数对象
 */
export function getUrlParams () {
	const params = new URLSearchParams(window.location.search);
	return {
		role: params.get('role') || '', // initiator 或 helper，无参数时为空字符串显示测试页面
		roomId: params.get('roomId') || 'test-room',
		userId: params.get('userId') || 'user-' + Date.now(),
		userName: params.get('userName') || 'User',
	};
}

/**
 * 计算音频音量级别
 * @param {MediaStreamTrack} audioTrack - 音频轨道
 * @param {Function} callback - 回调函数，接收音量级别 (0-100)
 * @returns {Function} 停止监听函数
 */
export function monitorAudioLevel (audioTrack, callback) {
	const audioContext = new AudioContext();
	const mediaStream = new MediaStream([audioTrack]);
	const source = audioContext.createMediaStreamSource(mediaStream);
	const analyser = audioContext.createAnalyser();

	analyser.fftSize = 256;
	source.connect(analyser);

	const bufferLength = analyser.frequencyBinCount;
	const dataArray = new Uint8Array(bufferLength);

	let animationId;

	function checkLevel () {
		analyser.getByteFrequencyData(dataArray);

		// 计算平均音量
		const average = dataArray.reduce((a, b) => a + b) / bufferLength;
		const level = Math.min(100, Math.round((average / 255) * 100));

		callback(level);
		animationId = requestAnimationFrame(checkLevel);
	}

	checkLevel();

	// 返回停止监听的函数
	return () => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		audioContext.close();
	};
}
