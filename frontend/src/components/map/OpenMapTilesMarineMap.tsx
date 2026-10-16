import { useEffect, useRef, useState } from "react"
import maplibregl, { Map as MapLibreMap, Marker, Popup } from "maplibre-gl"
import type { AisTarget, Vessel } from "@/domain/types"

export type OpenMapTilesTheme = "dark" | "liberty" | "positron" | "satellite"

interface Port {
  name: string
  position: { lat: number; lng: number }
}

interface OpenMapTilesMarineMapProps {
  selectedVessel: Vessel | null
  aisTargets: AisTarget[]
  selectedTargetId?: string
  isOwnShipSelected?: boolean
  onSelectTarget: (id: string) => void
  onSelectOwnShip: () => void
  ports: Port[]
  track: Array<{ lat: number; lng: number }>
  showTrack: boolean
  showRangeRings: boolean
  theme: OpenMapTilesTheme
  centerTick: number
  navContainerRef?: React.RefObject<HTMLDivElement | null>
  showNavControl?: boolean
  showAttribution?: boolean
}

const STYLE_URLS: Record<OpenMapTilesTheme, string | object> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  positron: "https://tiles.openfreemap.org/styles/positron",
  satellite: {
    version: 8,
    sources: {
      "esri-satellite": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "esri-satellite-layer",
        type: "raster",
        source: "esri-satellite",
      },
    ],
  },
}

export function getVesselColor(type?: string, name?: string, mmsi?: string): string {
  const t = (type || "").toLowerCase()
  if (t.includes("cargo") || t.includes("container") || t.includes("bulk")) return "#16a34a"
  if (t.includes("tanker") || t.includes("oil") || t.includes("gas") || t.includes("chemical")) return "#dc2626"
  if (t.includes("passenger") || t.includes("ferry") || t.includes("cruise")) return "#2563eb"
  if (t.includes("tug") || t.includes("special") || t.includes("pilot") || t.includes("dredg")) return "#0891b2"
  if (t.includes("fish") || t.includes("nelayan")) return "#ea580c"

  const n = (name || "").toUpperCase()
  if (n.startsWith("MT ") || n.includes("TANKER")) return "#dc2626"
  if (n.startsWith("MV ") || n.includes("CARGO")) return "#16a34a"
  if (n.startsWith("KMP ") || n.includes("FERRY") || n.includes("PASSENGER")) return "#2563eb"
  if (n.startsWith("TB ") || n.includes("TUG") || n.includes("PILOT")) return "#0891b2"
  if (n.startsWith("KM ") || n.includes("NELAYAN") || n.includes("TUNA") || n.includes("MINA")) return "#ea580c"

  if (mmsi) {
    const num = parseInt(mmsi.replace(/\D/g, "").slice(-4), 10) || 0
    const mod = num % 5
    if (mod === 0) return "#16a34a" // Cargo
    if (mod === 1) return "#dc2626" // Tanker
    if (mod === 2) return "#2563eb" // Passenger
    if (mod === 3) return "#0891b2" // Tug / Special
    return "#ea580c" // Fishing
  }

  return "#16a34a"
}

export type VesselCategory = "Cargo" | "Tanker" | "Passenger" | "Tug / Special" | "Fishing"

export function getVesselCategory(type?: string, name?: string, mmsi?: string): VesselCategory {
  const color = getVesselColor(type, name, mmsi)
  if (color === "#dc2626") return "Tanker"
  if (color === "#2563eb") return "Passenger"
  if (color === "#0891b2") return "Tug / Special"
  if (color === "#ea580c") return "Fishing"
  return "Cargo"
}

function createCircleCoordinates(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  points = 64,
): [number, number][] {
  const coords: [number, number][] = []
  const km = radiusMeters / 1000
  const distanceX = km / (111.32 * Math.cos((centerLat * Math.PI) / 180))
  const distanceY = km / 110.574

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI)
    const x = distanceX * Math.cos(theta)
    const y = distanceY * Math.sin(theta)
    coords.push([centerLng + x, centerLat + y])
  }
  return coords
}

export function OpenMapTilesMarineMap({
  selectedVessel,
  aisTargets = [],
  selectedTargetId,
  isOwnShipSelected = true,
  onSelectTarget,
  onSelectOwnShip,
  ports = [],
  track = [],
  showTrack = true,
  showRangeRings = true,
  theme = "liberty",
  centerTick = 0,
  navContainerRef,
  showNavControl = true,
  showAttribution = false,
}: OpenMapTilesMarineMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const ownShipMarkerRef = useRef<Marker | null>(null)
  const portMarkersRef = useRef<Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)

  // 1. Initialize MapLibre GL
  useEffect(() => {
    if (!containerRef.current) return

    const initialLng = selectedVessel?.position?.lng ?? 106.88
    const initialLat = selectedVessel?.position?.lat ?? -5.99

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URLS[theme] as any,
      center: [initialLng, initialLat],
      zoom: 11,
      pitch: theme === "liberty" ? 55 : 0,
      bearing: 0,
      attributionControl: false,
    })

    // Navigation Control (Zoom + 3D Compass / Pitch rotation)
    if (showNavControl) {
      const navControl = new maplibregl.NavigationControl({ visualizePitch: true })
      map.addControl(navControl, navContainerRef?.current ? undefined : "bottom-right")

      // Move control container to external toolbar group if provided
      const ctrlEl = (navControl as any)._container as HTMLElement | undefined
      if (ctrlEl && navContainerRef?.current) {
        navContainerRef.current.appendChild(ctrlEl)
      }
    }

    if (showAttribution) {
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: "OpenMapTiles &bull; OpenSeaMap &bull; OpenFreeMap",
        }),
        "bottom-right",
      )
    }

    const setupLayers = () => {
      // OpenSeaMap Nautical Overlay (Buoys, Lights, TSS, Anchorage)
      if (!map.getSource("openseamap")) {
        map.addSource("openseamap", {
          type: "raster",
          tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 18,
        })
      }
      if (!map.getLayer("openseamap-layer")) {
        map.addLayer({
          id: "openseamap-layer",
          type: "raster",
          source: "openseamap",
          paint: {
            "raster-opacity": 1.0,
          },
        })
      }

      // Track Source & Layer
      if (!map.getSource("vessel-track-src")) {
        map.addSource("vessel-track-src", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [] },
            properties: {},
          },
        })
        map.addLayer({
          id: "vessel-track-layer",
          type: "line",
          source: "vessel-track-src",
          paint: {
            "line-color": "#0284c7",
            "line-width": 3,
            "line-dasharray": [2, 2],
            "line-opacity": 0.85,
          },
        })
      }

      // Range Rings Source & Layers (0.5, 1.0, 2.0 NM)
      if (!map.getSource("range-rings-src")) {
        map.addSource("range-rings-src", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        })
        map.addLayer({
          id: "range-rings-line-layer",
          type: "line",
          source: "range-rings-src",
          paint: {
            "line-color": "#0284c7",
            "line-width": 1.5,
            "line-dasharray": [4, 4],
            "line-opacity": 0.75,
          },
        })
      }

      // Course Vector Predictor Line
      if (!map.getSource("course-vector-src")) {
        map.addSource("course-vector-src", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [] },
            properties: {},
          },
        })
        map.addLayer({
          id: "course-vector-layer",
          type: "line",
          source: "course-vector-src",
          paint: {
            "line-color": "#db4040",
            "line-width": 2,
            "line-opacity": 0.9,
          },
        })
      }
      setMapLoaded(true)
    }

    map.on("load", setupLayers)
    map.on("style.load", setupLayers)

    mapRef.current = map

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.resize()
      })
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (ownShipMarkerRef.current) {
        ownShipMarkerRef.current.remove()
        ownShipMarkerRef.current = null
      }
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
      portMarkersRef.current.forEach((m) => m.remove())
      portMarkersRef.current = []
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [])

  // 2. Switch theme style smoothly & 3D pitch perspective
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setStyle(STYLE_URLS[theme] as any)
    if (theme === "liberty") {
      map.easeTo({ pitch: 55, duration: 1000 })
    } else {
      map.easeTo({ pitch: 0, duration: 800 })
    }
  }, [theme])

  // Sync nav controls into external container if container mounts
  useEffect(() => {
    if (!containerRef.current || !navContainerRef?.current) return
    const el = containerRef.current.querySelector(".maplibregl-ctrl-group")
    if (el && navContainerRef.current && el.parentNode !== navContainerRef.current) {
      navContainerRef.current.appendChild(el)
    }
  }, [navContainerRef])

  // 3. Center camera when centerTick changes, vessel changes, or map finishes loading
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedVessel?.position) return
    const { lng, lat } = selectedVessel.position
    if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) return

    map.flyTo({
      center: [lng, lat],
      zoom: 12,
      essential: true,
      speed: 1.2,
    })
  }, [centerTick, selectedVessel?.id, mapLoaded])

  // 4. Update Own Ship Marker (Icon Ship Saja dengan Panah Heading dan Gelombang saat Terpilih)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedVessel?.position) return
    const { lng, lat } = selectedVessel.position
    if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) return

    const rot = selectedVessel.heading ?? selectedVessel.cog ?? 0

    if (!ownShipMarkerRef.current) {
      const el = document.createElement("div")
      el.className = "ais-marker-container own-ship"
      el.style.cursor = "pointer"
      el.innerHTML = `
        <div class="target-wave-pulse own-pulse ${isOwnShipSelected ? "active" : ""}" style="--pulse-color: #db4040;">
          <span class="target-wave-ring"></span>
          <span class="target-wave-ring"></span>
          <span class="target-wave-ring"></span>
        </div>
        <div class="own-ship-marker-unit" style="transform: rotate(${rot}deg);" title="${selectedVessel.name}">
          <div class="own-ship-heading-arrow">
            <svg viewBox="0 0 14 12" width="13" height="11" style="display: block; overflow: visible;">
              <polygon points="7,0 14,12 7,8 0,12" fill="#db4040" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="own-ship-badge-disc">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#db4040" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="2.5" x2="12" y2="5.5" />
              <path d="M7.5 9V5.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5V9" />
              <path d="M3.5 12 12 9.5l8.5 2.5c.3 3-1.2 5.5-4 6.3L12 19.5l-4.5-1.2C4.7 17.5 3.2 15 3.5 12Z" />
              <line x1="12" y1="9.5" x2="12" y2="16.5" />
              <path d="M2 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
            </svg>
          </div>
        </div>
      `

      el.addEventListener("click", (e) => {
        e.stopPropagation()
        onSelectOwnShip()
      })

      const popup = new Popup({ offset: 20, closeButton: false }).setHTML(`
        <div style="font-family: inherit; font-size: 11px; padding: 2px;">
          <strong style="color: #db4040;">★ ${selectedVessel.name} (Own Ship)</strong>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">
            MMSI: ${selectedVessel.mmsi || "—"} &bull; SOG: ${selectedVessel.sog?.toFixed(1) || 0} kn
          </div>
        </div>
      `)

      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map)

      ownShipMarkerRef.current = marker
    } else {
      ownShipMarkerRef.current.setLngLat([lng, lat])
      const el = ownShipMarkerRef.current.getElement()
      const pulseEl = el?.querySelector<HTMLElement>(".target-wave-pulse")
      if (pulseEl) {
        pulseEl.style.setProperty("--pulse-color", "#db4040")
        if (isOwnShipSelected) {
          pulseEl.classList.add("active")
        } else {
          pulseEl.classList.remove("active")
        }
      }
      const unitEl = el?.querySelector<HTMLElement>(".own-ship-marker-unit")
      if (unitEl) {
        unitEl.style.transform = `rotate(${rot}deg)`
        unitEl.setAttribute("title", selectedVessel.name)
      }
      ownShipMarkerRef.current.getPopup()?.setHTML(`
        <div style="font-family: inherit; font-size: 11px; padding: 2px;">
          <strong style="color: #db4040;">★ ${selectedVessel.name} (Own Ship)</strong>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">
            MMSI: ${selectedVessel.mmsi || "—"} &bull; SOG: ${selectedVessel.sog?.toFixed(1) || 0} kn
          </div>
        </div>
      `)
    }
  }, [selectedVessel, isOwnShipSelected, onSelectOwnShip, mapLoaded])

  // 5. Update AIS Targets Markers (Bentuk Arah + Warna Jenis Kapal + Gelombang saat Diklik)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(aisTargets.map((t) => t.id))

    // Remove obsolete markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    // Add or update markers
    aisTargets.forEach((target) => {
      const isSelected = target.id === selectedTargetId
      // Warna marker murni sesuai jenis kapal, TIDAK berubah menjadi biru saat dipilih
      const color = getVesselColor(target.type, target.name, target.mmsi)
      const rot = target.heading ?? target.cog ?? 0

      let marker = markersRef.current.get(target.id)

      if (!marker) {
        const el = document.createElement("div")
        el.className = `ais-marker-container ${isSelected ? "selected" : ""}`
        el.style.cursor = "pointer"
        el.innerHTML = `
          <div class="target-wave-pulse ${isSelected ? "active" : ""}" style="--pulse-color: ${color};">
            <span class="target-wave-ring"></span>
            <span class="target-wave-ring"></span>
            <span class="target-wave-ring"></span>
          </div>
          <div class="ais-vessel-arrow" style="transform: rotate(${rot}deg);">
            <svg viewBox="0 0 20 28" width="18" height="26" style="display: block; overflow: visible;">
              <polygon points="10,1 19,25 10,20 1,25" fill="${color}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round" />
            </svg>
          </div>
        `

        el.addEventListener("click", (e) => {
          e.stopPropagation()
          onSelectTarget(target.id)
        })

        const popup = new Popup({ offset: 16, closeButton: false }).setHTML(`
          <div style="font-family: inherit; font-size: 10px; padding: 2px;">
            <strong>${target.name}</strong>
            <div style="color: #64748b; font-size: 9px; margin-top: 1px;">
              MMSI: ${target.mmsi} &bull; ${target.type || "Vessel"}
            </div>
            <div style="color: #0284c7; font-size: 9px;">
              SOG: ${target.sog.toFixed(1)} kn &bull; CPA: ${target.cpa.toFixed(2)} NM
            </div>
          </div>
        `)

        marker = new Marker({ element: el, anchor: "center" })
          .setLngLat([target.position.lng, target.position.lat])
          .setPopup(popup)
          .addTo(map)

        markersRef.current.set(target.id, marker)
      } else {
        marker.setLngLat([target.position.lng, target.position.lat])
        const el = marker.getElement()
        if (el) {
          if (isSelected) {
            el.classList.add("selected")
          } else {
            el.classList.remove("selected")
          }

          // Animasi gelombang sonar/radar saat kapal tertarget (warna dinamis sesuai warna kapal)
          const pulseEl = el.querySelector<HTMLElement>(".target-wave-pulse")
          if (pulseEl) {
            pulseEl.style.setProperty("--pulse-color", color)
            if (isSelected) {
              pulseEl.classList.add("active")
            } else {
              pulseEl.classList.remove("active")
            }
          }

          const arrowEl = el.querySelector<HTMLElement>(".ais-vessel-arrow")
          if (arrowEl) {
            arrowEl.style.transform = `rotate(${rot}deg)`
          }

          const poly = el.querySelector("polygon")
          if (poly) {
            poly.setAttribute("fill", color)
            poly.setAttribute("stroke", "#ffffff")
            poly.setAttribute("stroke-width", "1.8")
          }
        }
      }
    })
  }, [aisTargets, selectedTargetId, onSelectTarget])

  // 6. Update Port Markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (ports && portMarkersRef.current.length === 0) {
      ports.forEach((port) => {
        const el = document.createElement("div")
        el.className = "map-port-marker"
        el.innerHTML = `⚓`
        el.style.cursor = "pointer"

        const popup = new Popup({ offset: 18, closeButton: false }).setHTML(`
          <div style="font-family: inherit; font-size: 10px; font-weight: bold; color: #0369a1;">
            Pelabuhan ${port.name}
          </div>
        `)

        const marker = new Marker({ element: el, anchor: "center" })
          .setLngLat([port.position.lng, port.position.lat])
          .setPopup(popup)
          .addTo(map)

        portMarkersRef.current.push(marker)
      })
    }
  }, [ports])

  // 7. Update Track Line
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource("vessel-track-src") as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (!showTrack || !track || track.length < 2) {
      source.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [] },
        properties: {},
      })
      return
    }

    const coords = (track || []).map((p) => [p.lng, p.lat])
    source.setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {},
    })
  }, [track, showTrack, mapLoaded])

  // 8. Update Range Rings (0.5 NM = 926m, 1.0 NM = 1852m, 2.0 NM = 3704m)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedVessel?.position) return

    const source = map.getSource("range-rings-src") as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (!showRangeRings) {
      source.setData({ type: "FeatureCollection", features: [] })
      return
    }

    const { lng, lat } = selectedVessel.position
    if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) return

    const ringRadii = [926, 1852, 3704] // meters
    const features = ringRadii.map((radius) => ({
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [createCircleCoordinates(lng, lat, radius)],
      },
      properties: { radius },
    }))

    source.setData({
      type: "FeatureCollection",
      features,
    })
  }, [selectedVessel, showRangeRings, mapLoaded])

  // 9. Update Course Over Ground predictor vector line
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedVessel?.position) return

    const source = map.getSource("course-vector-src") as maplibregl.GeoJSONSource | undefined
    if (!source) return

    const { lng, lat } = selectedVessel.position
    if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) return

    const cogRad = ((selectedVessel.cog || selectedVessel.heading || 0) * Math.PI) / 180
    // Predictor length: 1 NM (1.852 km)
    const distKm = Math.max(1.0, ((selectedVessel.sog || 0) * 1.852) / 6) // 10 minutes prediction
    const dLat = (distKm / 110.574) * Math.cos(cogRad)
    const dLng = (distKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(cogRad)

    source.setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [lng, lat],
          [lng + dLng, lat + dLat],
        ],
      },
      properties: {},
    })
  }, [selectedVessel, mapLoaded])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{
        position: "relative",
        background: theme === "dark" ? "#0b1320" : "#f1f5f9",
      }}
    />
  )
}
