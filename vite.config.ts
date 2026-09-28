import { createHash } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The paper colour of the Passbook look, light and dark (src/index.css). */
const GROUND = { light: '#F6F4EE', dark: '#10161D' }

/** The logo and the files in public/icons, saved for offline use with each build. */
const ICONS = ['/logo.webp', ...readdirSync(path.resolve(__dirname, 'public/icons')).map((file) => `/icons/${file}`)]

/**
 * Puts the product name into index.html and generates the web manifest, so a
 * self-hosted copy can use its own name with VITE_APP_NAME (see TRADEMARKS.md).
 * Defaults match src/config/brand.ts.
 */
function brand(env: Record<string, string>): Plugin {
  const name = env.VITE_APP_NAME || 'Cheque Tracker'
  const tagline = env.VITE_APP_TAGLINE || 'Track every cheque. Never miss a date.'
  const manifest = JSON.stringify(
    {
      id: '/',
      name,
      short_name: name,
      description: tagline,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: GROUND.light,
      theme_color: GROUND.light,
      categories: ['finance', 'productivity'],
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2
  )

  return {
    name: 'brand',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%APP_NAME%', escapeHtml(name))
        .replaceAll('%APP_TAGLINE%', escapeHtml(tagline))
        .replaceAll('%GROUND_LIGHT%', GROUND.light)
        .replaceAll('%GROUND_DARK%', GROUND.dark),
    configureServer(server) {
      server.middlewares.use('/manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(manifest)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: manifest })
    },
  }
}

/**
 * Builds dist/sw.js from pwa/service-worker.js, with the list of this build's
 * files to save for offline use. Only production builds get one; the dev
 * server has no service worker (src/lib/pwa.ts).
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((file) => /\.(js|css|woff2|png|svg|webp)$/.test(file))
        .map((file) => `/${file}`)
      const files = [...new Set(['/index.html', '/manifest.json', ...ICONS, ...built])].sort()
      const template = readFileSync(path.resolve(__dirname, 'pwa/service-worker.js'), 'utf8')
      // Built files have hashed names; the icons and the worker itself don't.
      const hash = createHash('sha256').update(files.join('\n')).update(template)
      for (const icon of ICONS) hash.update(readFileSync(path.resolve(__dirname, `public${icon}`)))
      const version = hash.digest('hex').slice(0, 12)
      const source = template
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(files))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss(), brand(env), serviceWorker()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
