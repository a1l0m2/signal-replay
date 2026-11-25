import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const YAHOO_HOST = 'https://query1.finance.yahoo.com'

/** Dev + preview proxy so the browser can read Yahoo without CORS. */
function yahooProxyPlugin(): Plugin {
  const proxy = {
    '/api/yahoo': {
      target: YAHOO_HOST,
      changeOrigin: true,
      secure: true,
      rewrite: (path: string) => path.replace(/^\/api\/yahoo/, ''),
      headers: {
        'User-Agent': 'Mozilla/5.0 SignalReplayResearch/1.0 (near-realtime delayed chart)',
        Accept: 'application/json',
      },
    },
  }
  return {
    name: 'signal-replay-yahoo-proxy',
    config() {
      return {
        server: { proxy },
        preview: { proxy },
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), yahooProxyPlugin()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
