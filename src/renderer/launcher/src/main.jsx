import React from 'react'
import ReactDOM from 'react-dom/client'
// Bundled fonts (offline-safe — no CDN). Inter for body/labels, Playfair for display.
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/500.css'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
