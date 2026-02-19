import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0',
		port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
		strictPort: !!process.env.PORT
	},
	build: {
		chunkSizeWarningLimit: 1500,
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes('maplibre-gl')) {
						return 'vendor-maplibre';
					}
					if (id.includes('three')) {
						return 'vendor-three';
					}
					if (id.includes('@turf')) {
						return 'vendor-turf';
					}
				}
			}
		}
	}
});
