import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [
		sveltekit({
			alias: {
				'$lib': 'src/lib'
			},
			adapter: adapter({ fallback: 'index.html' }),
			prerender: {
				entries: []
			}
		})
	],
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
		watch: { ignored: ['**/src-tauri/**', '**/third_party/**'] }
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
