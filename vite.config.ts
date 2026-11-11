import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // Vite 8 (rolldown) pipeline: 'oxc' is the native minifier.
    // 'esbuild' is deprecated in Vite 8 and requires the esbuild package separately.
    minify: !process.env.TAURI_ENV_DEBUG ? 'oxc' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  }
})
