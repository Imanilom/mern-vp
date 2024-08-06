import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port : 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000/',
        // target: 'https://103.147.114.203:5173/',
        secure: false,
      },
    },
  },

  plugins: [react()],
});
