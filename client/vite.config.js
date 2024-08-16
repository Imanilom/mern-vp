import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  server: {
    port: 3000, // Port untuk Vite (React)
    proxy: {
      '/api': {
        target: 'http://localhost:5173', // Ubah ini ke port server backend yang benar
        changeOrigin: true,
        // secure: false,
        // rewrite: (path) => path.replace(/^\/api/, ''), // Opsional, jika API backend tidak memerlukan prefix '/api'
      },
    },
  },
  plugins: [react()],
});
