import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '127.0.0.1',
		port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
		strictPort: !!process.env.PORT
	}
});
