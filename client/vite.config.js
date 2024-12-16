// FILE Konfigurasi aplikasi frontend (VITE)

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  // Memastikan Vite menangani file ini sebagai aset
  assetsInclude: ["**/*.gltf", "**/*.glb"],
  server: {
    port: 3031, // Port untuk Vite (React)
    proxy: {
      "/api": {
        target: "http://localhost:3030", // Ubah ini ke port server backend yang benar
        changeOrigin: true,
        // secure: false,
        // rewrite: (path) => path.replace(/^\/api/, ''), // Opsional, jika API backend tidak memerlukan prefix '/api'
      },
    },
  },
  plugins: [react()],
});
