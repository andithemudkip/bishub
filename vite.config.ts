import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  appType: 'mpa',
  server: {
    open: false,
  },
  plugins: [
    {
      name: 'rewrite-html-pages',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          // Rewrite /remote and /display to their .html counterparts
          if (req.url === '/remote' || req.url === '/remote/') {
            req.url = '/remote.html'
          } else if (req.url === '/display' || req.url === '/display/') {
            req.url = '/display.html'
          }
          next()
        })
      },
    },
    react(),
    electron({
      entry: 'electron/main.ts',
      vite: {
        build: {
          outDir: 'dist-electron',
          rollupOptions: {
            external: ['electron', 'express', 'socket.io', 'http-proxy-middleware']
          }
        }
      }
    }),
    renderer()
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        display: path.resolve(__dirname, 'display.html'),
        remote: path.resolve(__dirname, 'remote.html')
      }
    }
  }
})
