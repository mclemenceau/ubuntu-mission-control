import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const apiProxy = {
  target: 'https://tests-api.ubuntu.com',
  changeOrigin: true,
  rewrite: path => path.replace(/^\/api/, ''),
  proxyTimeout: 30000,
  timeout: 30000,
  configure: proxy => {
    proxy.on('proxyReq', proxyReq => {
      proxyReq.setHeader('X-CSRF-Token', '1')
    })
    proxy.on('error', (err, req, res) => {
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json' })
      }
      res.end(JSON.stringify({ error: err.message }))
    })
  },
}

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 3000,
    proxy: { '/api': apiProxy },
  },
  preview: {
    port: 3000,
    proxy: { '/api': apiProxy },
  },
})
