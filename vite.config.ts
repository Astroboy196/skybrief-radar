import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/api/vatsim-data': {
        target: 'https://data.vatsim.net',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/vatsim-data', '/v3/vatsim-data.json'),
      },
      '/api/vatsim-transceivers': {
        target: 'https://data.vatsim.net',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/vatsim-transceivers', '/v3/transceivers-data.json'),
      },
      '/api/vatsim-stats': {
        target: 'https://api.vatsim.net',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/vatsim-stats', ''),
      },
      '/api/metar': {
        target: 'https://metar.vatsim.net',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/metar', ''),
      },
      '/api/weather': {
        target: 'https://aviationweather.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/weather', '/api/data'),
      },
    },
  },
});
