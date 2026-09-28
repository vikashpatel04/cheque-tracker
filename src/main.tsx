import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// IBM Plex, served with the app so it works offline and makes no third-party requests.
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-ext-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-ext-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-ext-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-sans/latin-ext-700.css'
import '@fontsource/ibm-plex-serif/latin-600.css'
import '@fontsource/ibm-plex-serif/latin-ext-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-ext-500.css'
import './index.css'
import App from './App'
import { initTheme } from '@/lib/theme'
import { registerServiceWorker } from '@/lib/pwa'

initTheme()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
