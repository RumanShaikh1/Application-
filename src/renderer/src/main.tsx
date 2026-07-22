import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installDevApiFallbackIfNeeded } from './lib/devApiFallback'

installDevApiFallbackIfNeeded()

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found')
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
