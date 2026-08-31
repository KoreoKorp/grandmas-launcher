import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['msedge-tts']
      })
    ],
    build: {
      rollupOptions: {
        external: ['bufferutil', 'utf-8-validate']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          launcher:    resolve(__dirname, 'src/preload/launcher.js'),
          admin:       resolve(__dirname, 'src/preload/admin.js'),
          browserView: resolve(__dirname, 'src/preload/browserView.js')
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          launcher: resolve(__dirname, 'src/renderer/launcher/index.html'),
          admin: resolve(__dirname, 'src/renderer/admin/index.html')
        }
      }
    }
  }
})