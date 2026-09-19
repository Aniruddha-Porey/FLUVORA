import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app proxies /api → Express backend so the browser only ever talks
// to its own origin (works locally and behind the preview proxy).
const proxy = {
  '/api': { target: 'http://localhost:5000', changeOrigin: true },
};
const allowedHosts = ['localhost', '127.0.0.1', '.e2b.app'];

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts,
    hmr: { protocol: 'wss', clientPort: 443 },
    headers: { 'Cache-Control': 'no-store' },
    proxy,
  },
  // Production preview (hashed assets → browsers can never cache stale CSS/JS)
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts,
    proxy,
  },
});
