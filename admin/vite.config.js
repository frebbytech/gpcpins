import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5003,
  },
  plugins: [react()],
     optimizeDeps: {
    include: [
      '@mui/material',
      '@emotion/styled',
      '@emotion/react',
      '@mui/icons-material'
    ]
  },
  resolve: {
    alias: {
      '@': '/src', // Add this alias
    },
  },

});
