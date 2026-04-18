import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',  // bind to all interfaces — allows LAN/Wi-Fi access
    port: 3000,
    strictPort: true, // fail fast if 3000 is taken — avoids silent port shift → CORS mismatch
    allowedHosts: true,
    // Proxy /api requests to the backend during development so the browser
    // never hits CORS issues and we don't hardcode the port everywhere.
    // Note: proxy runs server-side, so localhost here is correct (not the client's localhost).
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
