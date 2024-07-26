import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://103.147.114.203:5173/',
        secure: false,
      },
    },
  },

  plugins: [react()],
});
