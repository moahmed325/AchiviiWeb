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
    // The workspace has more than one React install; libraries must share the app's copy or hooks break.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-radix': ['@radix-ui/react-dialog', '@radix-ui/react-slot', '@radix-ui/react-tabs'],
          'vendor-icons': ['lucide-react'],
        },
      },
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
