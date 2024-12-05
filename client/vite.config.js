// FILE Konfigurasi aplikasi frontend (VITE)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
   // Memastikan Vite menangani file ini sebagai aset
  assetsInclude: ['**/*.gltf', '**/*.glb'], 
  server: {
    port: 5173, // Port untuk aplikasi Vite (React) -- Frontend
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Port Server NodeJS -- Backend
        changeOrigin: true,
        // secure: false,
        // rewrite: (path) => path.replace(/^\/api/, ''), // Opsional, jika API backend tidak memerlukan prefix '/api'
      },
    },
  },
  plugins: [react()],
});
