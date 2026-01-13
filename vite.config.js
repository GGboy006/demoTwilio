import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
	base: './',  // 使用相对路径
	build: {
		outDir: 'dist',
		assetsDir: 'assets',
		rollupOptions: {
			output: {
				chunkFileNames: 'assets/[name]-[hash].js',
				entryFileNames: 'assets/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash].[ext]'
			}
		},
	},
	plugins: [
		vue(),
		vueDevTools(),
		basicSsl(), // 启用 HTTPS 以获取摄像头权限
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
	server: {
		host: '0.0.0.0',      // 允许局域网访问
		port: 5173,           // 指定端口
		https: true,          // 启用 HTTPS 以获取摄像头权限
		open: true,           // 启动后自动打开浏览器
		strictPort: false,    // 如果端口被占用，尝试其他端口
		cors: true,           // 允许跨域

		// 配置代理（如果需要）
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				secure: false,
			}
		},

		// 热更新配置
		hmr: {
			overlay: true,      // 显示错误覆盖层
		},

		// 设置请求头
		headers: {
			'Access-Control-Allow-Origin': '*',
		}
	},

	// 预览配置（npm run build 后使用 npm run preview 时生效）
	preview: {
		host: '0.0.0.0',
		port: 4173,
	},
});