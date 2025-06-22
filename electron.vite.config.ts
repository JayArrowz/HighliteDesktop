import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

import{ resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        "@static": resolve(__dirname, "static")
      }
    },
    build: {
      rollupOptions: {
        input: {
          client: resolve(__dirname, 'src/renderer/client/client.html'),
          update: resolve(__dirname, 'src/renderer/updater/update.html')
        }
      }
    }
  }
})
