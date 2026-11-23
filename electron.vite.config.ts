import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' https: http: ws: wss:",
  "media-src 'self' data: blob: https: http:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "form-action 'none'"
].join('; ')

/**
 * The Electron webRequest CSP does not apply to file:// loads, so inject a
 * meta policy into production HTML. Development keeps HMR/WebSocket access
 * without the meta tag.
 */
const productionCsp: Plugin = {
  name: '3pi-production-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const meta = `    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`
    return html.includes('<meta charset="UTF-8" />')
      ? html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n${meta}`)
      : html.replace('<head>', `<head>\n${meta}`)
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react(), productionCsp]
  }
})
