import { useState, useEffect, useMemo } from "react"
import {
  Activity,
  AlertTriangle,
  Anchor,
  ArrowRight,
  CircleGauge,
  Compass,
  Crosshair,
  Database,
  ExternalLink,
  Eye,
  Fuel,
  Gauge,
  Layers,
  MapPin,
  Navigation,
  Radio,
  Server,
  ShieldAlert,
  Ship,
  SlidersHorizontal,
  Thermometer,
  Waves,
  Wind,
  Zap,
} from "lucide-react"
import { Link } from "react-router"
import { StatusBadge } from "@/components/common/UI"
import { useFleet } from "@/state/FleetProvider"
import { useAuth } from "@/state/AuthProvider"
import { api } from "@/services/api"
import type { AisTarget, Vessel } from "@/domain/types"
import {
  OpenMapTilesMarineMap,
  type OpenMapTilesTheme,
} from "@/components/map/OpenMapTilesMarineMap"

const REGIONAL_PORTS = [
  { name: "Port of Singapore", position: { lat: 1.264, lng: 103.84 } },
  { name: "Port of Tanjung Priok", position: { lat: -6.102, lng: 106.883 } },
  { name: "Port of Panjang", position: { lat: -5.467, lng: 105.318 } },
  { name: "Port of Batam (Batu Ampar)", position: { lat: 1.157, lng: 103.987 } },
  { name: "Port of Tanjung Perak", position: { lat: -7.198, lng: 112.733 } },
  { name: "Port of Merak", position: { lat: -5.932, lng: 105.996 } },
  { name: "Port of Bakauheni", position: { lat: -5.871, lng: 105.753 } },
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

export function OverviewPage() {
  const { user, isSuperadmin } = useAuth()
  const { vessels, agents, aisTargets: fallbackAisTargets, alerts, logs, tracks, acknowledgeAlert } = useFleet()

  const [selectedVesselId, setSelectedVesselId] = useState<string>(vessels[0]?.id || "")
  const [mapTheme, setMapTheme] = useState<OpenMapTilesTheme>("liberty")
  const [centerTick, setCenterTick] = useState<number>(0)
  const [liveAisTargets, setLiveAisTargets] = useState<AisTarget[] | null>(null)
  const [sidebarTab, setSidebarTab] = useState<"insights" | "gateways">("insights")

  // Keep selected vessel aligned with permitted vessels
  useEffect(() => {
    if (vessels.length > 0 && !vessels.some((v) => v.id === selectedVesselId)) {
      setSelectedVesselId(vessels[0].id)
    } else if (vessels.length === 0 && selectedVesselId !== "") {
      setSelectedVesselId("")
    }
  }, [vessels, selectedVesselId])

  const activeVessel: Vessel | null = useMemo(() => {
    return vessels.find((v) => v.id === selectedVesselId) || vessels[0] || null
  }, [vessels, selectedVesselId])

  const activeTrack = activeVessel ? tracks[activeVessel.id] || [] : []

  // Fetch real-time AIS targets scoped specifically to the active vessel's current position
  useEffect(() => {
    const targetVesselId = activeVessel?.id
    if (!targetVesselId) {
      setLiveAisTargets(null)
      return
    }
    let isMounted = true

    const fetchAis = () => {
      api
        .getAisTargets(targetVesselId)
        .then((targets) => {
          if (isMounted && Array.isArray(targets)) {
            setLiveAisTargets(targets)
          }
        })
        .catch(() => {})
    }

    fetchAis()
    const timer = window.setInterval(fetchAis, 3000)
    return () => {
      isMounted = false
      window.clearInterval(timer)
    }
  }, [activeVessel?.id])

  const aisTargets = liveAisTargets !== null ? liveAisTargets : fallbackAisTargets

  // Scoped KPIs calculated strictly for the current account's fleet
  const underwayVessels = vessels.filter((v) => v.status === "Underway" && v.quality !== "offline")
  const underwayCount = underwayVessels.length
  const portCount = vessels.filter((v) => (v.status === "In Port" || v.status === "Anchored") && v.quality !== "offline").length
  const liveVesselsCount = vessels.filter((v) => v.quality === "live").length
  const delayedVesselsCount = vessels.filter((v) => v.quality === "delayed").length
  const offlineVesselsCount = vessels.filter((v) => v.quality === "offline" || v.quality === "stale").length

  const avgSpeedKnots =
    underwayVessels.length > 0
      ? (underwayVessels.reduce((acc, v) => acc + (v.sog || 0), 0) / underwayVessels.length).toFixed(1)
      : "0.0"

  // Proximity alerts & sorted AIS targets around currently selected vessel
  const sortedAisTargets = useMemo(() => {
    return [...aisTargets].sort((a, b) => (a.distanceNm ?? 999) - (b.distanceNm ?? 999))
  }, [aisTargets])

  const dangerTargets = useMemo(() => {
    return aisTargets.filter((t) => t.distanceNm !== undefined && t.distanceNm <= 1.0)
  }, [aisTargets])

  // Company / Organization badge name
  const companyLabel = user?.role_name || (isSuperadmin ? "Platform Superadmin" : "Fleet Operator")

  if (vessels.length === 0) {
    return (
      <main className="grid min-h-[600px] place-items-center text-center p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-inner">
            <Ship className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-base font-bold text-slate-800">No Vessels Assigned to this Account</h1>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Your account ({user?.email}) does not have permission to access any fleet vessels yet. Please contact your Fleet Administrator to assign vessel permissions.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8 space-y-6">
      {/* 1. HERO HEADER WITH PLATFORM STATUS & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#db4040]">
            <Ship className="h-4 w-4" />
            <span>GeoTekno VMS • {companyLabel}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Fleet Operations Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
            Real-time digital twin monitoring, maritime traffic situational awareness, and navigation telemetry for your fleet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Platform Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
            {liveVesselsCount > 0 ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-slate-700">Live Telemetry Active</span>
              </>
            ) : delayedVesselsCount > 0 ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="font-semibold text-slate-700">Telemetry Delayed / Intermittent</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                </span>
                <span className="font-semibold text-slate-700">Fleet Standby / Offline</span>
              </>
            )}
            <span className="text-slate-300">•</span>
            <span className="font-mono text-[11px] text-slate-500">{vessels.length} Assigned Vessels</span>
          </div>

          <Link
            to="/marine-traffic"
            className="inline-flex items-center gap-2 rounded-xl bg-[#db4040] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#b92b2b] transition active:scale-[0.99]"
          >
            <Radio className="h-4 w-4" />
            <span>Marine Traffic (AIS)</span>
          </Link>

          <Link
            to="/monitoring"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition active:scale-[0.99]"
          >
            <Gauge className="h-4 w-4 text-[#db4040]" />
            <span>Telemetry Dashboard</span>
          </Link>
        </div>
      </div>

      {/* 2. OPERATIONAL KPI SUMMARY CARDS (Top Row - 4 Scoped Metric Cards) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Assigned Fleet Status */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              My Fleet Status
            </span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-[#db4040]">
              <Ship className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {vessels.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {vessels.length === 1 ? "Vessel Assigned" : "Vessels Assigned"}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            {underwayCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                {underwayCount} Underway
              </span>
            ) : liveVesselsCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                {portCount} In Port / Anchor
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                {offlineVesselsCount} Standby / Offline
              </span>
            )}
            <span>•</span>
            <span className="text-slate-500">{portCount} In Port / Anchor</span>
          </div>
        </div>

        {/* Card 2: Fleet Navigation Summary */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fleet Navigation
            </span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Navigation className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
              {avgSpeedKnots}
            </span>
            <span className="text-xs font-semibold text-slate-500">kn Avg Cruising</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span className="truncate">
              Active Ship: <strong className="text-slate-800">{activeVessel?.name}</strong>
            </span>
            <span className="font-mono text-slate-700 font-bold">
              {activeVessel?.sog.toFixed(1) || "0.0"} kn
            </span>
          </div>
        </div>

        {/* Card 3: Surrounding AIS Traffic (Scoped around Active Vessel) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Surrounding AIS Traffic
            </span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Radio className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {aisTargets.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">Nearby AIS Targets</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span className={`font-semibold ${dangerTargets.length > 0 ? "text-red-600" : "text-slate-600"}`}>
              {sortedAisTargets.length > 0 ? (
                <>Closest: <strong className="text-slate-900">{sortedAisTargets[0]?.distanceNm?.toFixed(1) || "0.0"} NM</strong> ({sortedAisTargets[0]?.name})</>
              ) : (
                "No AIS targets in range"
              )}
            </span>
            <Link to="/marine-traffic" className="text-[11px] font-bold text-[#db4040] hover:underline">
              AIS Traffic →
            </Link>
          </div>
        </div>

        {/* Card 4: Telemetry & Sensor Health */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Telemetry Health
            </span>
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${
              liveVesselsCount > 0
                ? "bg-emerald-50 text-emerald-600"
                : delayedVesselsCount > 0
                  ? "bg-amber-50 text-amber-600"
                  : "bg-slate-100 text-slate-500"
            }`}>
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tight ${
              liveVesselsCount > 0
                ? "text-emerald-600"
                : delayedVesselsCount > 0
                  ? "text-amber-600"
                  : "text-slate-500"
            }`}>
              {liveVesselsCount}/{vessels.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {liveVesselsCount > 0
                ? "Live Streaming"
                : delayedVesselsCount > 0
                  ? "Delayed / AIS Buffering"
                  : "Standby / Offline"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span className={`inline-flex items-center gap-1 font-semibold ${
              liveVesselsCount > 0
                ? "text-emerald-700"
                : delayedVesselsCount > 0
                  ? "text-amber-700"
                  : "text-slate-500"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                liveVesselsCount > 0
                  ? "bg-emerald-500"
                  : delayedVesselsCount > 0
                    ? "bg-amber-500"
                    : "bg-slate-400"
              }`}></span>
              {liveVesselsCount > 0
                ? "Sensors Online"
                : delayedVesselsCount > 0
                  ? "Tolerated Marine Delay"
                  : "No Signal Received"}
            </span>
            <Link to="/monitoring" className="text-[11px] font-bold text-[#db4040] hover:underline">
              Instruments →
            </Link>
          </div>
        </div>
      </section>

      {/* 3. MIDDLE ROW: FLEET GEOGRAPHIC GLANCE & ACTIVE VESSEL DIGITAL TWIN SNAPSHOT */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left (8 Cols): Fleet Geographic Glance */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-[#db4040]" />
                <h2 className="text-sm font-bold text-slate-800">
                  Fleet Geographic Glance
                </h2>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Live positions of your fleet and surrounding AIS maritime traffic.
              </p>
            </div>

            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              {/* Vessel selector (only shows vessels assigned to this account) */}
              {vessels.length > 1 && (
                <select
                  value={selectedVesselId}
                  onChange={(e) => {
                    setSelectedVesselId(e.target.value)
                    setCenterTick((t) => t + 1)
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 outline-none focus:border-[#db4040]"
                >
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Theme selector */}
              <select
                value={mapTheme}
                onChange={(e) => setMapTheme(e.target.value as OpenMapTilesTheme)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="liberty">Liberty Marine</option>
                <option value="dark">Dark Nautical</option>
                <option value="positron">Positron Light</option>
                <option value="satellite">Satellite Imagery</option>
              </select>

              <button
                type="button"
                onClick={() => setCenterTick((t) => t + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                title="Center Own Ship"
              >
                <Crosshair className="h-3.5 w-3.5 text-[#db4040]" />
                <span className="hidden sm:inline">Center</span>
              </button>

              <Link
                to="/marine-traffic"
                className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-bold text-[#db4040] hover:bg-red-100 transition"
              >
                <span>Full Map</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Interactive Map Container */}
          <div className="relative h-[380px] w-full bg-slate-100">
            <OpenMapTilesMarineMap
              selectedVessel={activeVessel}
              aisTargets={aisTargets}
              isOwnShipSelected={true}
              onSelectTarget={() => {}}
              onSelectOwnShip={() => {}}
              ports={REGIONAL_PORTS}
              track={activeTrack}
              showTrack={true}
              showRangeRings={true}
              theme={mapTheme}
              centerTick={centerTick}
              showNavControl={true}
              showAttribution={false}
            />

            {/* Floating Live Vessel Badge overlay on Map */}
            {activeVessel && (
              <div className="absolute bottom-3 left-3 z-10 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-md backdrop-blur-sm text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-slate-900">{activeVessel.name}</span>
                  <StatusBadge status={activeVessel.status} />
                </div>
                <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-slate-600">
                  <span>
                    SOG: <strong>{activeVessel.sog.toFixed(1)} kn</strong>
                  </span>
                  <span>
                    HDG: <strong>{Math.round(activeVessel.heading ?? 0)}°</strong>
                  </span>
                  <span>
                    {activeVessel.position ? `${activeVessel.position.lat.toFixed(4)}°, ${activeVessel.position.lng.toFixed(4)}°` : "No GPS"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right (4 Cols): ACTIVE VESSEL DIGITAL TWIN SNAPSHOT */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    {activeVessel ? activeVessel.name : "Vessel Digital Twin"}
                  </h2>
                  {activeVessel && <StatusBadge status={activeVessel.status} />}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400 font-mono">
                  MMSI: {activeVessel?.mmsi || "—"} • {activeVessel?.type || "Vessel"}
                </p>
              </div>
              <Link to="/monitoring" className="text-xs font-bold text-[#db4040] hover:underline">
                Full HUD →
              </Link>
            </div>

            {/* Active Vessel Quick Telemetry Grid */}
            {activeVessel ? (
              <div className="mt-4 space-y-2.5">
                {/* 1. Speed (SOG / STW) */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                      <Gauge className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Speed (SOG / STW)</div>
                      <div className="font-mono text-sm font-extrabold text-slate-900 mt-0.5">
                        {activeVessel.sog.toFixed(1)} <span className="text-xs font-semibold text-slate-500">kn SOG</span>
                        {activeVessel.stw !== null && activeVessel.stw !== undefined && (
                          <span className="text-slate-400 font-normal text-xs ml-1.5">
                            • {activeVessel.stw.toFixed(1)} kn STW
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    COG: {Math.round(activeVessel.cog || 0)}°
                  </span>
                </div>

                {/* 2. Heading & Compass */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                      <Compass className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Compass & Heading</div>
                      <div className="font-mono text-sm font-extrabold text-slate-900 mt-0.5">
                        {Math.round(activeVessel.heading ?? 0)}° <span className="text-xs font-semibold text-slate-500">True HDG</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {activeVessel.rot !== null && activeVessel.rot !== undefined ? `ROT ${activeVessel.rot.toFixed(1)}°/s` : "Steady"}
                  </span>
                </div>

                {/* 3. Water Depth & Environment */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                      <Database className="h-3.5 w-3.5 text-cyan-600" />
                      <span>Water Depth</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-800 mt-1">
                      {activeVessel.depth !== null && activeVessel.depth !== undefined ? `${activeVessel.depth.toFixed(1)} m` : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                      <Thermometer className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Sea Temp</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-800 mt-1">
                      {activeVessel.waterTemp !== null && activeVessel.waterTemp !== undefined ? `${activeVessel.waterTemp.toFixed(1)} °C` : "—"}
                    </div>
                  </div>
                </div>

                {/* 4. Motion / Attitude (Pitch & Roll) */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Waves className="h-4 w-4 text-indigo-500" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Attitude Dynamics</div>
                      <div className="font-mono text-xs font-bold text-slate-800 mt-0.5">
                        Pitch: {activeVessel.pitch !== null && activeVessel.pitch !== undefined ? `${activeVessel.pitch.toFixed(1)}°` : "0.0°"}
                        {" • "}
                        Roll: {activeVessel.roll !== null && activeVessel.roll !== undefined ? `${activeVessel.roll.toFixed(1)}°` : "0.0°"}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    DST810
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No active vessel telemetry available.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400">
              Synced: {formatDateTime(activeVessel?.updatedAt)}
            </span>
            <Link
              to="/monitoring"
              className="inline-flex items-center gap-1 font-bold text-[#db4040] hover:text-[#b92b2b] transition"
            >
              <span>Inspect All Instruments</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. BOTTOM ROW: FLEET TELEMETRY MATRIX & SITUATIONAL INSIGHTS */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left (8 Cols): Fleet Telemetry & Status Matrix */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Fleet Telemetry & Status Matrix
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Overview of vessels assigned to your account. Click any row to focus on map.
              </p>
            </div>
            <Link to="/vessels" className="text-xs font-bold text-[#db4040] hover:underline">
              Vessel Assets →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="bg-slate-50/80 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Vessel & Type</th>
                  <th className="px-4 py-3">Navigation (SOG / HDG)</th>
                  <th className="px-4 py-3">Depth & Sea Temp</th>
                  <th className="px-4 py-3">Attitude (Pitch/Roll)</th>
                  <th className="px-4 py-3">Data Status</th>
                  <th className="px-4 py-3">Last Received</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {vessels.map((v) => {
                  const isSelected = v.id === selectedVesselId
                  return (
                    <tr
                      key={v.id}
                      onClick={() => {
                        setSelectedVesselId(v.id)
                        setCenterTick((t) => t + 1)
                      }}
                      className={`cursor-pointer transition ${
                        isSelected ? "bg-red-50/40 font-semibold" : "hover:bg-slate-50/70"
                      }`}
                    >
                      {/* Vessel */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-[#db4040]" : "bg-slate-300"}`} />
                          <div>
                            <div className="font-bold text-slate-900">{v.name}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
                              MMSI: {v.mmsi || "—"} • {v.type || "Vessel"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Navigation */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">
                          {v.sog.toFixed(1)} kn • {Math.round(v.heading ?? 0)}°
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 font-mono">
                          {v.position ? `${v.position.lat.toFixed(4)}°, ${v.position.lng.toFixed(4)}°` : "No GPS"}
                        </div>
                      </td>

                      {/* Depth & Temp */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-700 font-mono">
                          {v.depth !== null && v.depth !== undefined ? (
                            <span>{v.depth.toFixed(1)} m</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          <span>•</span>
                          {v.waterTemp !== null && v.waterTemp !== undefined ? (
                            <span>{v.waterTemp.toFixed(1)} °C</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          Wind: {v.windSpeed !== null && v.windSpeed !== undefined ? `${v.windSpeed.toFixed(1)} kn` : "—"}
                        </div>
                      </td>

                      {/* Attitude */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-700">
                        P: {v.pitch !== null && v.pitch !== undefined ? `${v.pitch.toFixed(1)}°` : "0.0°"}
                        {" / "}
                        R: {v.roll !== null && v.roll !== undefined ? `${v.roll.toFixed(1)}°` : "0.0°"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={v.quality} />
                      </td>

                      {/* Last Received */}
                      <td className="px-4 py-3.5 font-mono text-[11px] font-semibold text-slate-700">
                        {formatDateTime(v.updatedAt)}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to="/monitoring"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 transition"
                        >
                          <span>Monitor</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (4 Cols): Surrounding AIS Targets & Proximity Alerts */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Surrounding AIS Targets
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Real-time AIS targets around {activeVessel?.name || "Active Ship"} ({aisTargets.length} in range)
                </p>
              </div>
              <Link to="/marine-traffic" className="text-xs font-bold text-[#db4040] hover:underline">
                AIS Traffic View →
              </Link>
            </div>

            {/* Proximity Warning Alert if danger targets exist */}
            {dangerTargets.length > 0 && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-900 flex items-start gap-2.5 animate-pulse">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">Collision Risk / Proximity Warning</div>
                  <div className="text-[11px] text-red-700 mt-0.5">
                    {dangerTargets.length} AIS target within 1.0 Nautical Mile of {activeVessel?.name}.
                  </div>
                </div>
              </div>
            )}

            {/* List of Closest Surrounding AIS Targets (Sorted by Distance) */}
            <div className="mt-3.5 space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {sortedAisTargets.slice(0, 8).map((target) => (
                <div
                  key={target.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-100/70 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 truncate text-xs">
                        {target.name}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase px-1 py-0.2 bg-white rounded border border-slate-200">
                        {target.type || "Ship"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 font-mono">
                      MMSI: {target.mmsi} • BRG: {target.bearing}°
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-extrabold text-slate-800">
                      {target.distanceNm !== undefined ? `${target.distanceNm.toFixed(1)} NM` : "—"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {target.sog !== undefined ? `${target.sog.toFixed(1)} kn` : "0.0 kn"}
                    </div>
                  </div>
                </div>
              ))}

              {sortedAisTargets.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  No AIS targets detected around {activeVessel?.name}.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Live AIS Reception ({aisTargets.length} Active Targets)
            </span>
            <Link to="/marine-traffic" className="font-bold text-slate-700 hover:text-[#db4040]">
              Open Marine Traffic (AIS) →
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
