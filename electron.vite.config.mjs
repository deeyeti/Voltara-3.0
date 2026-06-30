import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['sql.js', 'pdf-parse', 'papaparse', '@google/generative-ai']
      }
    }
  },
  preload: {
    // Use CJS format so require('electron') works natively in Electron's preload context
    build: {
      rollupOptions: {
        output: {
          format: 'cjs'
        },
        external: ['electron']
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
