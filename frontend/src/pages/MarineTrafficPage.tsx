import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import {
  Activity,
  Anchor,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  ExternalLink,
  Filter,
  Gauge,
  Globe,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Moon,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Search,
  Ship,
  Sun,
  TriangleAlert,
  Wind,
  X,
} from "lucide-react"
import { StatusBadge } from "@/components/common/UI"
import { useFleet } from "@/state/FleetProvider"
import { api } from "@/services/api"
import type { AisTarget, Vessel } from "@/domain/types"
import {
  OpenMapTilesMarineMap,
  getVesselColor,
  getVesselCategory,
  type OpenMapTilesTheme,
  type VesselCategory,
} from "@/components/map/OpenMapTilesMarineMap"
import { OwnShipIcon } from "@/components/common/OwnShipIcon"

const ALL_VESSEL_CATEGORIES: VesselCategory[] = [
  "Cargo",
  "Tanker",
  "Passenger",
  "Tug / Special",
  "Fishing",
]

const VESSEL_TYPE_OPTIONS: { label: string; value: VesselCategory; color: string }[] = [
  { label: "Cargo", value: "Cargo", color: "#16a34a" },
  { label: "Tanker", value: "Tanker", color: "#dc2626" },
  { label: "Passenger", value: "Passenger", color: "#2563eb" },
  { label: "Tug / Special", value: "Tug / Special", color: "#0891b2" },
  { label: "Fishing", value: "Fishing", color: "#ea580c" },
]

const REGIONAL_PORTS = [
  { name: "Port of Singapore", code: "SGSIN", country: "Singapore", lat: 1.264, lng: 103.84 },
  { name: "Port of Tanjung Priok", code: "IDTPP", country: "Jakarta, ID", lat: -6.102, lng: 106.883 },
  { name: "Port of Panjang", code: "IDPNJ", country: "Lampung, ID", lat: -5.467, lng: 105.318 },
  { name: "Port of Batam (Batu Ampar)", code: "IDBTH", country: "Batam, ID", lat: 1.157, lng: 103.987 },
  { name: "Port of Tanjung Perak", code: "IDSUB", country: "Surabaya, ID", lat: -7.198, lng: 112.733 },
  { name: "Port of Merak", code: "IDMRK", country: "Banten, ID", lat: -5.932, lng: 105.996 },
  { name: "Port of Bakauheni", code: "IDBKH", country: "Lampung, ID", lat: -5.871, lng: 105.753 },
]

function formatDateTime(isoString?: string): string {
  if (!isoString) return "—"
  const date = new Date(isoString)
  if (isNaN(date.getTime()) || date.getTime() === 0) return "—"
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function MarineTrafficPage() {
  const { vessels, aisTargets: fallbackAisTargets, tracks } = useFleet()
  const [selectedVesselId, setSelectedVesselId] = useState(vessels[0]?.id ?? "")
  const [selectedTargetId, setSelectedTargetId] = useState<string>()
  const [liveAisTargets, setLiveAisTargets] = useState<AisTarget[] | null>(null)
  type MapTheme = OpenMapTilesTheme
  const [mapTheme, setMapTheme] = useState<MapTheme>(() => {
    const saved = localStorage.getItem("marine_map_theme") as MapTheme
    return (saved === "dark" || saved === "liberty" || saved === "positron" || saved === "satellite") ? saved : "dark"
  })
  const [showRangeRings, setShowRangeRings] = useState(true)
  const [showOwnShipDetail, setShowOwnShipDetail] = useState(false)
  const [showTrack, setShowTrack] = useState(true)
  const [trackWindow, setTrackWindow] = useState("1h")
  const [query, setQuery] = useState("")
  const [classFilter, setClassFilter] = useState<"All" | "A" | "B">("All")
  const [selectedTypes, setSelectedTypes] = useState<VesselCategory[]>(ALL_VESSEL_CATEGORIES)
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [listOpen, setListOpen] = useState(true)
  const [centerTick, setCenterTick] = useState(0)
  const [tileError, setTileError] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [vesselDropdownOpen, setVesselDropdownOpen] = useState(false)
  const vesselDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        vesselDropdownRef.current &&
        !vesselDropdownRef.current.contains(event.target as Node)
      ) {
        setVesselDropdownOpen(false)
      }
    }
    if (vesselDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [vesselDropdownOpen])

  const mapWorkspace = useRef<HTMLDivElement>(null)
  const navContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (vessels.length > 0 && !vessels.some((v) => v.id === selectedVesselId)) {
      setSelectedVesselId(vessels[0].id)
    } else if (vessels.length === 0 && selectedVesselId !== "") {
      setSelectedVesselId("")
    }
  }, [vessels, selectedVesselId])

  const selectedVessel =
    vessels.find((vessel) => vessel.id === selectedVesselId) ?? vessels[0]

  // Polling data AIS real-time khusus untuk kapal yang sedang dipilih
  useEffect(() => {
    const targetVesselId = selectedVessel?.id
    if (!targetVesselId) return
    let isMounted = true

    const fetchAis = () => {
      api
        .getAisTargets(targetVesselId)
        .then((targets) => {
          if (isMounted && Array.isArray(targets)) {
            setLiveAisTargets(targets)
          }
        })
        .catch(() => { })
    }

    fetchAis()
    const timer = window.setInterval(fetchAis, 2000)
    return () => {
      isMounted = false
      window.clearInterval(timer)
    }
  }, [selectedVessel?.id])

  useEffect(() => {
    localStorage.setItem("marine_map_theme", mapTheme)
  }, [mapTheme])

  const aisTargets = liveAisTargets !== null ? liveAisTargets : fallbackAisTargets
  const selectedTarget = aisTargets.find(
    (target) => target.id === selectedTargetId,
  )
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: 0,
      Cargo: 0,
      Tanker: 0,
      Passenger: 0,
      "Tug / Special": 0,
      Fishing: 0,
    }
    aisTargets.forEach((target) => {
      if (classFilter === "All" || target.aisClass === classFilter) {
        counts.All++
        const cat = getVesselCategory(target.type, target.name, target.mmsi)
        if (counts[cat] !== undefined) {
          counts[cat]++
        }
      }
    })
    return counts
  }, [aisTargets, classFilter])

  const filtered = useMemo(
    () =>
      aisTargets
        .filter((target) => {
          if (classFilter !== "All" && target.aisClass !== classFilter) return false
          const cat = getVesselCategory(target.type, target.name, target.mmsi)
          if (!selectedTypes.includes(cat)) return false
          if (
            query &&
            !`${target.name} ${target.mmsi}`
              .toLowerCase()
              .includes(query.toLowerCase())
          ) {
            return false
          }
          return true
        })
        .sort((a, b) => a.distanceNm - b.distanceNm),
    [aisTargets, classFilter, selectedTypes, query],
  )

  const toggleType = (cat: VesselCategory) => {
    setSelectedTypes((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((c) => c !== cat)
      } else {
        return [...prev, cat]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectedTypes.length === ALL_VESSEL_CATEGORIES.length) {
      setSelectedTypes([])
    } else {
      setSelectedTypes([...ALL_VESSEL_CATEGORIES])
    }
  }
  const track = (tracks[selectedVessel?.id ?? ""] ?? []).slice(
    trackWindow === "30m" ? -10 : trackWindow === "1h" ? -20 : -120,
  )

  useEffect(() => {
    const handler = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  async function toggleFullscreen() {
    if (!mapWorkspace.current || !document.fullscreenEnabled) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await mapWorkspace.current.requestFullscreen()
  }

  return (
    <main
      ref={mapWorkspace}
      className="marine-traffic-workspace relative h-[calc(100vh-68px)] w-full overflow-hidden bg-slate-900"
    >
      <div className="flex h-full w-full">
        <aside
          className={`${listOpen ? "w-[310px]" : "w-0"
            } relative z-[600] flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white shadow-xl transition-[width] duration-300`}
        >
          <div className="flex h-full w-[310px] flex-col">
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-slate-800">AIS targets</h2>
                  <p className="mt-1 text-[9px] text-slate-400">
                    {filtered.length} targets in reception range
                  </p>
                </div>
                <div className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-600">
                  SCANNING
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent text-[10px] outline-none"
                  placeholder="Search MMSI or vessel..."
                />
              </label>
              <div className="mt-2 flex gap-1">
                {(["All", "A", "B"] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setClassFilter(item)}
                    className={`flex-1 rounded-lg py-1.5 text-[9px] font-bold ${classFilter === item
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500"
                      }`}
                  >
                    {item === "All" ? "All classes" : `Class ${item}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filtered.map((target) => {
                const vesselColor = getVesselColor(target.type, target.name, target.mmsi)
                return (
                  <button
                    key={target.id}
                    onClick={() => {
                      setSelectedTargetId(target.id)
                      setShowOwnShipDetail(false)
                      setCenterTick((tick) => tick + 1)
                    }}
                    className={`mb-1.5 w-full rounded-xl border p-3 text-left transition ${selectedTargetId === target.id
                        ? "border-teal-300 bg-teal-50 shadow-sm"
                        : "border-transparent hover:bg-slate-50"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition"
                        style={{
                          backgroundColor: `${vesselColor}18`,
                          borderColor: `${vesselColor}35`,
                          color: vesselColor,
                        }}
                      >
                        <Navigation
                          className="h-4 w-4"
                          style={{
                            transform: `rotate(${target.heading || target.cog || 0}deg)`,
                            color: vesselColor,
                          }}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-bold text-slate-700">
                            {target.name}
                          </span>
                          {target.aisClass === "B" ? (
                            <span className="rounded bg-purple-50 border border-purple-200/90 px-1.5 py-0.5 text-[8px] font-bold text-purple-700">
                              CLASS B
                            </span>
                          ) : (
                            <span className="rounded bg-blue-50 border border-blue-200/90 px-1.5 py-0.5 text-[8px] font-bold text-blue-700">
                              CLASS A
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[9px] text-slate-400">
                          MMSI {target.mmsi}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[9px]">
                          <span className="font-bold text-slate-600">
                            {target.distanceNm.toFixed(1)} NM
                          </span>
                          <span className="text-slate-400">
                            {target.bearing}° BRG • {target.sog.toFixed(1)} kn
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <div className="relative min-w-0 flex-1">
          {selectedVessel ? (
            <OpenMapTilesMarineMap
              selectedVessel={selectedVessel}
              aisTargets={filtered}
              selectedTargetId={selectedTargetId}
              isOwnShipSelected={showOwnShipDetail && !selectedTargetId}
              onSelectTarget={(id) => {
                setSelectedTargetId(id)
                setShowOwnShipDetail(false)
              }}
              onSelectOwnShip={() => {
                setSelectedTargetId(undefined)
                setShowOwnShipDetail(true)
              }}
              ports={REGIONAL_PORTS.map((p) => ({
                name: p.name,
                position: { lat: p.lat, lng: p.lng },
              }))}
              track={track}
              showTrack={showTrack}
              showRangeRings={showRangeRings}
              theme={mapTheme}
              centerTick={centerTick}
              navContainerRef={navContainerRef}
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-300">
              Register a vessel to start tracking.
            </div>
          )}

          <button
            onClick={() => setListOpen(!listOpen)}
            className="absolute left-3 top-3 z-[500] grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-lg"
            aria-label="Toggle AIS list"
          >
            {listOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          <div className="absolute right-3 top-3 z-[500] flex items-center gap-2">
            {/* Custom Vessel Select Dropdown */}
            <div className="relative" ref={vesselDropdownRef}>
              <button
                type="button"
                onClick={() => setVesselDropdownOpen((prev) => !prev)}
                className={`flex h-10 items-center gap-2.5 rounded-xl border bg-white/95 px-3 shadow-lg backdrop-blur-sm transition active:scale-[0.98] ${
                  vesselDropdownOpen
                    ? "border-[#db4040]/50 ring-2 ring-[#db4040]/20 bg-white"
                    : "border-slate-200 hover:border-slate-300 hover:bg-white"
                }`}
                title="Select Active Vessel"
                aria-expanded={vesselDropdownOpen}
              >
                <OwnShipIcon className="h-4 w-4 shrink-0 text-[#db4040]" />
                <span className="text-xs font-bold text-slate-800 max-w-[130px] truncate sm:max-w-[170px]">
                  {selectedVessel ? selectedVessel.name : "Select Vessel"}
                </span>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
                    vesselDropdownOpen ? "rotate-180 text-slate-700" : ""
                  }`}
                />
              </button>

              {/* Popover Dropdown Menu */}
              {vesselDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 origin-top-right rounded-2xl border border-slate-200/90 bg-white/98 p-1.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md z-[1000] animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Active Fleet Vessel
                    </span>
                    <span className="rounded-full bg-red-50 text-[#db4040] border border-red-100 px-2 py-0.5 text-[9px] font-bold">
                      {vessels.length} {vessels.length === 1 ? "vessel" : "vessels"}
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 p-0.5">
                    {vessels.map((vessel) => {
                      const isSelected = vessel.id === selectedVesselId
                      return (
                        <button
                          key={vessel.id}
                          type="button"
                          onClick={() => {
                            setSelectedVesselId(vessel.id)
                            setSelectedTargetId(undefined)
                            setShowOwnShipDetail(true)
                            setCenterTick((tick) => tick + 1)
                            setVesselDropdownOpen(false)
                          }}
                          className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                            isSelected
                              ? "bg-red-50/70 border border-red-200/70 text-slate-900 shadow-xs"
                              : "border border-transparent hover:bg-slate-50 text-slate-700 hover:text-slate-900"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${
                                isSelected
                                  ? "bg-[#db4040] text-white border-[#db4040]"
                                  : "bg-slate-50 text-slate-500 border-slate-200"
                              }`}
                            >
                              <OwnShipIcon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold truncate ${isSelected ? "text-slate-900" : "text-slate-800"}`}>
                                  {vessel.name}
                                </span>
                                {vessel.quality === "live" && (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 truncate">
                                MMSI: {vessel.mmsi || "—"} • {vessel.type || "Vessel"}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="h-4 w-4 shrink-0 text-[#db4040]" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-1 border-t border-slate-100 pt-1.5 px-2 pb-1">
                    <Link
                      to="/vessels"
                      onClick={() => setVesselDropdownOpen(false)}
                      className="flex items-center justify-between text-[10px] font-bold text-slate-500 hover:text-[#db4040] transition px-1 py-1 rounded-lg hover:bg-red-50/50"
                    >
                      <span>Manage Fleet & Sensors</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Map Theme Switcher: Light, Dark, 3D, Sat + Range Rings */}
            <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setMapTheme("positron")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  mapTheme === "positron"
                    ? "bg-slate-900 text-blue-400 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Light (Mode Terang)"
              >
                <Sun className="h-3.5 w-3.5 text-blue-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setMapTheme("dark")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  mapTheme === "dark"
                    ? "bg-slate-900 text-cyan-400 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Dark (Mode Gelap Navigasi)"
              >
                <Moon className="h-3.5 w-3.5 text-cyan-400" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setMapTheme("liberty")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  mapTheme === "liberty"
                    ? "bg-slate-900 text-amber-400 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="3D (Mode Vektor 3D & Bangunan)"
              >
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                <span>3D</span>
              </button>
              <button
                type="button"
                onClick={() => setMapTheme("satellite")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  mapTheme === "satellite"
                    ? "bg-slate-900 text-emerald-400 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Sat (Citra Satelit)"
              >
                <Globe className="h-3.5 w-3.5 text-emerald-500" />
                <span>Sat</span>
              </button>
              <div className="mx-1 h-4 w-px bg-slate-200" />
              <button
                type="button"
                onClick={() => setShowRangeRings(!showRangeRings)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                  showRangeRings
                    ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title="Toggle Range Rings (0.5 NM, 1.0 NM, 2.0 NM)"
              >
                <Crosshair className="h-3 w-3 text-cyan-600" />
                <span>Rings {showRangeRings ? "On" : "Off"}</span>
              </button>
            </div>

            {/* Navigation & Center Group: [Zoom In, Zoom Out, Drag Rotate] + Center + Fullscreen */}
            <div className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-2 py-1 shadow-lg backdrop-blur-sm">
              <div
                ref={navContainerRef}
                className="nav-ctrl-group-horizontal flex items-center"
              />
              <div className="h-4 w-px bg-slate-200" />
              <button
                type="button"
                onClick={() => {
                  setSelectedTargetId(undefined)
                  setShowOwnShipDetail(true)
                  setCenterTick((tick) => tick + 1)
                }}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100"
                title="Pusatkan Kamera ke Kapal Sendiri"
              >
                <LocateFixed className="h-4 w-4 text-[#db4040]" />
                <span>Center</span>
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <button
                type="button"
                onClick={toggleFullscreen}
                disabled={!document.fullscreenEnabled}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                aria-label="Toggle fullscreen"
                title="Layar Penuh"
              >
                {fullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <div className="absolute bottom-5 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            <button
              onClick={() => setShowTrack(!showTrack)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-bold ${showTrack ? "bg-teal-50 text-teal-700" : "text-slate-500"
                }`}
            >
              <Route className="h-3.5 w-3.5" /> Track{" "}
              {showTrack ? "on" : "off"}
            </button>
            <div className="h-5 w-px bg-slate-200" />
            {["30m", "1h", "6h"].map((window) => (
              <button
                key={window}
                onClick={() => setTrackWindow(window)}
                className={`rounded-lg px-2.5 py-2 text-[9px] font-bold ${trackWindow === window
                    ? "bg-slate-900 text-white"
                    : "text-slate-500"
                  }`}
              >
                {window}
              </button>
            ))}
          </div>
          {tileError && (
            <div className="absolute left-1/2 top-16 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700 shadow">
              <TriangleAlert className="h-4 w-4" /> Some map tiles are
              unavailable. AIS data remains active.
            </div>
          )}

          {/* Vertical Collapsible Map Legend & Multi-Select Vessel Type Filter */}
          <div className="absolute bottom-4 left-4 z-[500] hidden flex-col sm:flex">
            {legendCollapsed ? (
              <button
                type="button"
                onClick={() => setLegendCollapsed(false)}
                className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 text-[10px] font-bold text-slate-700 shadow-lg backdrop-blur-md hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                title="Buka Legend & Filter Jenis Kapal"
              >
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <span>Vessel Types</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                  {selectedTypes.length}/{ALL_VESSEL_CATEGORIES.length}
                </span>
                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              </button>
            ) : (
              <div className="flex w-[215px] flex-col rounded-2xl border border-slate-200/90 bg-white/95 p-2.5 shadow-xl backdrop-blur-md transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-[11px] font-bold text-slate-800">
                      Vessel Types
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLegendCollapsed(true)}
                    className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                    title="Minimize Legend"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Own Ship Direct Focus Button */}
                <div className="pt-2 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTargetId(undefined)
                      setShowOwnShipDetail(true)
                      setCenterTick((tick) => tick + 1)
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-red-50 hover:text-[#db4040] transition cursor-pointer"
                    title="Pusatkan Kamera ke Kapal Sendiri (Own Ship)"
                  >
                    <span className="flex items-center gap-2">
                      <OwnShipIcon className="h-4 w-4" color="#db4040" />
                      <span>Own ship</span>
                    </span>
                    <span className="rounded bg-red-100/80 px-1.5 py-0.5 text-[8px] font-bold text-[#db4040]">
                      Active
                    </span>
                  </button>
                </div>

                <div className="my-1 h-px bg-slate-100" />

                {/* Sub-header: Select All / Clear All */}
                <div className="flex items-center justify-between px-1.5 py-1 text-[9px]">
                  <span className="text-slate-400 font-medium">
                    Filter ({selectedTypes.length}/{ALL_VESSEL_CATEGORIES.length})
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
                  >
                    {selectedTypes.length === ALL_VESSEL_CATEGORIES.length ? "Clear all" : "Select all"}
                  </button>
                </div>

                {/* Vertical Checklist Items */}
                <div className="flex flex-col gap-0.5 pt-0.5">
                  {VESSEL_TYPE_OPTIONS.map((item) => {
                    const isSelected = selectedTypes.includes(item.value)
                    const count = typeCounts[item.value] || 0
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleType(item.value)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] transition cursor-pointer border ${
                          isSelected
                            ? "border-transparent bg-slate-50/80 font-semibold text-slate-800"
                            : "border-transparent text-slate-400 opacity-60 hover:opacity-100 hover:bg-slate-50/50"
                        }`}
                        title={`Toggle filter: ${item.label}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Checkbox Box */}
                          <span
                            className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded border transition ${
                              isSelected
                                ? "border-transparent text-white"
                                : "border-slate-300 bg-white"
                            }`}
                            style={isSelected ? { backgroundColor: item.color } : {}}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </span>

                          {/* Color Dot Indicator */}
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />

                          {/* Vessel Category Name */}
                          <span className="truncate">{item.label}</span>
                        </div>

                        {/* Count Badge */}
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[8px] font-bold shrink-0 transition"
                          style={
                            isSelected
                              ? {
                                  backgroundColor: `${item.color}18`,
                                  color: item.color,
                                }
                              : {
                                  backgroundColor: "#f1f5f9",
                                  color: "#94a3b8",
                                }
                          }
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Floating Ship Info Card ala OpenRemote (Gambar 2) */}
          {((showOwnShipDetail && selectedVessel && !selectedTarget) || selectedTarget) && (
            <div className="absolute top-14 right-3 z-[600] w-[290px] sm:w-[310px] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl transition-all duration-200">
              {/* Header: Warna Primary Accent / Sama dengan Warna Logo (#db4040) */}
              <div className="flex items-center justify-between bg-[#db4040] px-3.5 py-2.5 text-white shadow-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  {selectedTarget ? (
                    <Ship className="h-4 w-4 shrink-0 text-white" />
                  ) : (
                    <OwnShipIcon className="h-4 w-4 shrink-0" color="#ffffff" />
                  )}
                  <span className="truncate text-xs font-bold tracking-wide">
                    {selectedTarget ? selectedTarget.name : selectedVessel?.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTargetId(undefined)
                    setShowOwnShipDetail(false)
                  }}
                  className="rounded-md p-1 text-white/80 hover:bg-white/20 hover:text-white transition"
                  aria-label="Close card"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Body: Daftar Baris Parameter (Gambar 2) */}
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-3.5 py-2 text-xs text-slate-700 divide-y divide-slate-100">
                {selectedTarget ? (
                  <>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">MMSI</span>
                      <span className="font-mono font-bold text-slate-800">{selectedTarget.mmsi}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">IMO</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedTarget.imo || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Vessel type</span>
                      <span className="font-semibold text-slate-800">{selectedTarget.type || "Vessel"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">AIS class</span>
                      {selectedTarget.aisClass === "B" ? (
                        <span className="rounded bg-purple-50 border border-purple-200/90 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                          Class B
                        </span>
                      ) : (
                        <span className="rounded bg-blue-50 border border-blue-200/90 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                          Class A
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Call sign</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedTarget.callSign || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Destination</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">{selectedTarget.destination || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Nav status</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">{selectedTarget.status}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Speed (SOG)</span>
                      <span className="font-mono font-bold text-slate-800">{selectedTarget.sog.toFixed(1)} kn</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Course (COG)</span>
                      <span className="font-mono font-semibold text-slate-800">{Math.round(selectedTarget.cog)}°</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Heading</span>
                      <span className="font-mono font-semibold text-slate-800">{Math.round(selectedTarget.heading)}°</span>
                    </div>
                    {selectedTarget.rot !== null && selectedTarget.rot !== undefined && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500">Rate of turn (ROT)</span>
                        <span className="font-mono font-semibold text-slate-800">{selectedTarget.rot > 0 ? `+${selectedTarget.rot}` : selectedTarget.rot}°/min</span>
                      </div>
                    )}
                    {(selectedTarget.lengthM || selectedTarget.beamM) && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500">Dimensions</span>
                        <span className="font-mono font-semibold text-slate-800">{selectedTarget.lengthM || "—"}m × {selectedTarget.beamM || "—"}m</span>
                      </div>
                    )}
                    {selectedTarget.draughtM !== null && selectedTarget.draughtM !== undefined && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500">Max draught</span>
                        <span className="font-mono font-semibold text-slate-800">{selectedTarget.draughtM.toFixed(1)} m</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Distance</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedTarget.distanceNm.toFixed(1)} NM</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Bearing</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedTarget.bearing}°</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">CPA / TCPA</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedTarget.cpa} NM / {selectedTarget.tcpa} m</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Coordinates</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700">
                        {selectedTarget.position.lat.toFixed(5)}°, {selectedTarget.position.lng.toFixed(5)}°
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 bg-slate-50/80 -mx-3.5 px-3.5 border-t border-slate-100/80">
                      <span className="text-slate-500 font-medium">Last Received</span>
                      <span className="font-mono text-[11px] font-bold text-slate-800">
                        {formatDateTime(selectedTarget.updatedAt)}
                      </span>
                    </div>
                  </>
                ) : selectedVessel ? (
                  <>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Navigation status</span>
                      <span className="font-semibold text-emerald-600">{selectedVessel.status}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">MMSI</span>
                      <span className="font-mono font-bold text-slate-800">{selectedVessel.mmsi}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Destination</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{selectedVessel.destination || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Speed (SOG)</span>
                      <span className="font-mono font-bold text-slate-800">{selectedVessel.sog.toFixed(1)} kn</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Course (COG)</span>
                      <span className="font-mono font-semibold text-slate-800">{Math.round(selectedVessel.cog ?? 0)}°</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Heading</span>
                      <span className="font-mono font-semibold text-slate-800">{Math.round(selectedVessel.heading ?? 0)}°</span>
                    </div>
                    {selectedVessel.depth !== null && selectedVessel.depth !== undefined && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500">Depth sounder</span>
                        <span className="font-mono font-semibold text-slate-800">{selectedVessel.depth.toFixed(1)} m</span>
                      </div>
                    )}
                    {selectedVessel.rpm !== null && selectedVessel.rpm !== undefined && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500">Engine RPM</span>
                        <span className="font-mono font-semibold text-slate-800">{Math.round(selectedVessel.rpm)} RPM</span>
                      </div>
                    )}
                    {selectedVessel.fuel !== null && selectedVessel.fuel !== undefined && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500">Fuel reserve</span>
                        <span className="font-mono font-semibold text-slate-800">{Math.round(selectedVessel.fuel)}%</span>
                      </div>
                    )}
                    {selectedVessel.windSpeed !== null && selectedVessel.windSpeed !== undefined && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500">Wind speed</span>
                        <span className="font-mono font-semibold text-slate-800">{selectedVessel.windSpeed.toFixed(1)} kn</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">Coordinates</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700">
                        {selectedVessel.position?.lat != null ? selectedVessel.position.lat.toFixed(5) : "—"}°, {selectedVessel.position?.lng != null ? selectedVessel.position.lng.toFixed(5) : "—"}°
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 bg-slate-50/80 -mx-3.5 px-3.5 border-t border-slate-100/80">
                      <span className="text-slate-500 font-medium">Last Received</span>
                      <span className="font-mono text-[11px] font-bold text-slate-800">
                        {formatDateTime(selectedVessel.updatedAt)}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Footer: Tombol Center + Tombol View (Khusus Own Ship) */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3.5 py-2">
                <button
                  type="button"
                  onClick={() => setCenterTick((tick) => tick + 1)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  <Crosshair className="h-3.5 w-3.5 text-[#db4040]" /> Center
                </button>
                {!selectedTarget && selectedVessel && (
                  <Link
                    to="/vessels"
                    className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-[#db4040] shadow-sm hover:bg-red-100 transition"
                  >
                    View
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
