import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import "leaflet/dist/leaflet.css"
import "maplibre-gl/dist/maplibre-gl.css"
import "react-grid-layout/css/styles.css"

// Auto-reload on dynamic import chunk mismatch (new frontend deployment)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
