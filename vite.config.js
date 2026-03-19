import { defineConfig } from 'vite';

// En GitHub Pages la app se sirve bajo /nombre-repo/
// Cambia VITE_BASE o pon el nombre del repo aquí directamente.
const base = process.env.GITHUB_PAGES ? '/mapa/' : '/';

export default defineConfig({
  base,
  server: {
    port: 3000,
    // Permite servir archivos GeoJSON grandes sin timeout
    fs: { strict: false },
  },
  build: {
    outDir: 'dist',
  },
});
