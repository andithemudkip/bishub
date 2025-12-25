import express from 'express'
import { createServer as createHttpServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import { networkInterfaces } from 'os'
import { createProxyMiddleware } from 'http-proxy-middleware'
import type { StateManager } from './state'
import type { WindowManager } from './windowManager'
import type { ServerToClientEvents, ClientToServerEvents } from '../src/shared/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

export function createServer(stateManager: StateManager, windowManager: WindowManager) {
  const app = express()
  const httpServer = createHttpServer(app)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  const isDev = process.env.NODE_ENV !== 'production'

  if (isDev) {
    // In development, proxy everything except /api and socket.io to Vite
    app.use('/remote', createProxyMiddleware({
      target: VITE_DEV_SERVER_URL,
      changeOrigin: true,
      pathRewrite: { '^/remote': '/remote.html' },
    }))
    // Proxy all Vite-related paths
    app.use(['/@vite', '/@react-refresh', '/@fs', '/src', '/node_modules', '/.vite'], createProxyMiddleware({
      target: VITE_DEV_SERVER_URL,
      changeOrigin: true,
      ws: true,
    }))
  } else {
    // Serve static files for mobile remote in production
    app.use(express.static(path.join(__dirname, '../dist')))
    app.get('/remote', (_req, res) => {
      res.sendFile(path.join(__dirname, '../dist/remote.html'))
    })
  }

  // API endpoint to get local IP addresses
  app.get('/api/ip', (_req, res) => {
    const ips = getLocalIPs()
    res.json({ ips, port: stateManager.getSettings().serverPort })
  })

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Send current state to new client
    socket.emit('stateUpdate', stateManager.getState())
    socket.emit('settingsUpdate', stateManager.getSettings())
    socket.emit('monitors', windowManager.getMonitors())

    // Mode control
    socket.on('setMode', (mode) => {
      stateManager.setMode(mode)
    })

    socket.on('goIdle', () => {
      stateManager.goIdle()
    })

    // Text mode
    socket.on('loadText', (title, content) => {
      stateManager.loadText(title, content)
    })

    socket.on('nextSlide', () => {
      stateManager.nextSlide()
    })

    socket.on('prevSlide', () => {
      stateManager.prevSlide()
    })

    socket.on('goToSlide', (index) => {
      stateManager.goToSlide(index)
    })

    // Video mode
    socket.on('loadVideo', (src) => {
      stateManager.loadVideo(src)
    })

    socket.on('playVideo', () => {
      stateManager.playVideo()
    })

    socket.on('pauseVideo', () => {
      stateManager.pauseVideo()
    })

    socket.on('stopVideo', () => {
      stateManager.stopVideo()
    })

    socket.on('seekVideo', (time) => {
      stateManager.seekVideo(time)
    })

    socket.on('setVolume', (volume) => {
      stateManager.setVolume(volume)
    })

    // Settings
    socket.on('setDisplayMonitor', (monitorId) => {
      windowManager.moveDisplayToMonitor(monitorId)
    })

    socket.on('getMonitors', () => {
      socket.emit('monitors', windowManager.getMonitors())
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  // Subscribe to state changes and broadcast to all clients
  stateManager.onStateChange((state) => {
    io.emit('stateUpdate', state)
  })

  stateManager.onSettingsChange((settings) => {
    io.emit('settingsUpdate', settings)
  })

  return httpServer
}

function getLocalIPs(): string[] {
  const nets = networkInterfaces()
  const ips: string[] = []

  for (const name of Object.keys(nets)) {
    const netInterfaces = nets[name]
    if (!netInterfaces) continue

    for (const net of netInterfaces) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address)
      }
    }
  }

  return ips
}
