import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    commonjsOptions: {
      include: [/xiangqi\.cjs/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('@react-three')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/chess.js')) {
            return 'vendor-chess';
          }
          if (id.includes('packages/games/') || id.includes('@game-lobby/game-')) {
            const match = id.match(/game-([a-z0-9-]+)|games\/([a-z0-9-]+)/);
            if (match) {
              const slug = (match[1] ?? match[2] ?? '').replace(/-/g, '_');
              if (slug) return `game-${slug}`;
            }
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@game-lobby/game-chinese-chess > ../vendor/xiangqi.cjs'],
  },
  server: {
    port: 7125,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4123',
      '/socket.io': {
        target: 'http://localhost:4123',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
