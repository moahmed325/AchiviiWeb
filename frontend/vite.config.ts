import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  define: {
    'process.env.VITE_API_URL': JSON.stringify('https://achivii-api.onrender.com'),
    'process.env.VITE_API_BASE_URL': JSON.stringify('https://achivii-api.onrender.com'),
  },
});
