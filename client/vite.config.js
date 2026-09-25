import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 4173 is Vite's own default preview port, reserved for this project's
// frontend in ../PORTS.md — keep dev + preview on the same port so tooling
// needs zero config once this exists.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
  preview: {
    port: 4173,
  },
});
