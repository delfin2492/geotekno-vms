import { useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CircleGauge,
  Compass,
  Cpu,
  Crosshair,
  Database,
  ExternalLink,
  Fuel,
  MapPin,
  Radio,
  Server,
  Ship,
  Signal,
  Waves,
  Wind,
} from "lucide-react"
import { Link } from "react-router"
import { PageHeader, StatusBadge } from "@/components/common/UI"
import { useFleet } from "@/state/FleetProvider"
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
  return date.toLocaleString("en-US", {
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
  const { vessels, agents, aisTargets, alerts, logs, tracks, acknowledgeAlert } = useFleet()

  const [selectedVesselId, setSelectedVesselId] = useState<string>(vessels[0]?.id || "")
  const [mapTheme, setMapTheme] = useState<OpenMapTilesTheme>("liberty")
  const [centerTick, setCenterTick] = useState<number>(0)

  const activeVessel = vessels.find((v) => v.id === selectedVesselId) || vessels[0] || null
  const activeTrack = activeVessel ? tracks[activeVessel.id] || [] : []

  // Perhitungan KPI Riil
  const underwayCount = vessels.filter((v) => v.status === "Underway").length
  const portCount = vessels.length - underwayCount
  const connectedAgents = agents.filter((a) => a.status === "connected" || a.status === "testing").length
  const totalPacketsPerMin = agents.reduce((sum, a) => sum + (a.packetsPerMinute || 0), 0)
  const closeTargets = aisTargets.filter((t) => t.distanceNm !== undefined && t.distanceNm < 3.0)
  const activeAlerts = alerts.filter((a) => !a.acknowledged)

  // Port Agent String
  const agentPorts = agents.map((a) => a.port).filter(Boolean)
  const agentPortsStr = agentPorts.length > 0 ? `Ports: ${agentPorts.join(", ")}` : "No gateway assigned"

  return (
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8 space-y-6">
      {/* 1. HERO HEADER WITH PLATFORM STATUS & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#db4040]">
            <Ship className="h-4 w-4" />
            <span>GeoTekno VMS • Vessel Monitoring System</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Fleet Operations Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
            Real-time digital twin monitoring, maritime traffic situational awareness, and hardware gateway telemetry diagnostics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Platform Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-700">Platform Online</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-[11px] text-slate-500">PostGIS + WS Live</span>
          </div>

          <Link
            to="/marine-traffic"
            className="inline-flex items-center gap-2 rounded-xl bg-[#db4040] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#b92b2b] transition active:scale-[0.99]"
          >
            <Radio className="h-4 w-4" />
            <span>Marine Traffic Map</span>
          </Link>

          <Link
            to="/vessels"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition active:scale-[0.99]"
          >
            <Ship className="h-4 w-4" />
            <span>Manage Vessels</span>
          </Link>
        </div>
      </div>

      {/* 2. OPERATIONAL KPI SUMMARY CARDS (Top Row - 4 Real-Data Metric Cards) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Registered Fleet */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registered Fleet
            </span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-[#db4040]">
              <Ship className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {vessels.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">Vessels</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {underwayCount} Underway
            </span>
            <span>•</span>
            <span className="text-slate-500">{portCount} In Port / Anchor</span>
          </div>
        </div>

        {/* Card 2: Surrounding Marine Traffic */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Marine Traffic (AIS)
            </span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Radio className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {aisTargets.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">Nearby Vessels</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span className="font-semibold text-blue-600">
              {closeTargets.length} targets &lt; 3.0 NM
            </span>
            <Link to="/marine-traffic" className="text-[11px] font-bold text-[#db4040] hover:underline">
              Radar view →
            </Link>
          </div>
        </div>

        {/* Card 3: Connectivity Gateways & Agents */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              TCP Gateways
            </span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Server className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {connectedAgents}/{agents.length}
            </span>
            <span className="text-xs font-semibold text-emerald-600">Active</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span className="truncate font-mono text-[11px] text-slate-500">
              {agentPortsStr}
            </span>
            <Link to="/vessels" className="text-[11px] font-bold text-[#db4040] hover:underline">
              Config →
            </Link>
          </div>
        </div>

        {/* Card 4: Data Ingestion & Throughput */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Data Throughput
            </span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {totalPacketsPerMin.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500">Packets/min</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span className="inline-flex items-center gap-1 font-semibold text-violet-700">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>
              Live Bus Decoding
            </span>
            <Link to="/logs" className="text-[11px] font-bold text-[#db4040] hover:underline">
              Stream log →
            </Link>
          </div>
        </div>
      </section>

      {/* 3. MIDDLE ROW: FLEET GEOGRAPHIC GLANCE (PETA MINI) & GATEWAYS STATUS */}
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
                Live positions of Own Ship and surrounding AIS traffic in real time.
              </p>
            </div>

            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              {/* Vessel selector */}
              {vessels.length > 1 && (
                <select
                  value={selectedVesselId}
                  onChange={(e) => {
                    setSelectedVesselId(e.target.value)
                    setCenterTick((t) => t + 1)
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
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
                <option value="dark">Dark Radar</option>
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
          <div className="relative h-[360px] w-full bg-slate-100">
            <OpenMapTilesMarineMap
              selectedVessel={activeVessel}
              aisTargets={aisTargets}
              isOwnShipSelected={true}
              onSelectTarget={() => { }}
              onSelectOwnShip={() => { }}
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
                  <span>SOG: <strong>{activeVessel.sog.toFixed(1)} kn</strong></span>
                  <span>HDG: <strong>{Math.round(activeVessel.heading ?? 0)}°</strong></span>
                  <span>
                    {activeVessel.position?.lat.toFixed(4)}°, {activeVessel.position?.lng.toFixed(4)}°
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right (4 Cols): Gateways & Active Protocol Decoders */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Connectivity Gateways
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Hardware TCP ports & active payload decoders
                </p>
              </div>
              <Link to="/vessels" className="text-xs font-bold text-[#db4040] hover:underline">
                Manage →
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {agents.map((agent) => {
                const isOnline = agent.status === "connected" || agent.status === "testing"
                const tplName =
                  agent.decoderTemplate === "HYBRID"
                    ? "Hybrid CAN (N2K) + RS-485"
                    : agent.decoderTemplate === "NMEA2000"
                      ? "NMEA 2000 (CAN bus)"
                      : agent.decoderTemplate === "NMEA0183"
                        ? "NMEA 0183 (RS-485)"
                        : agent.decoderTemplate === "MODBUS"
                          ? "Modbus TCP Engine"
                          : agent.decoders?.join(" + ") || "Standard Decoder"

                return (
                  <div
                    key={agent.id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">{agent.name}</span>
                      <StatusBadge status={agent.status} />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                        {agent.host}:{agent.port}
                      </span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        {agent.packetsPerMinute || 0} pkt/min
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span className="truncate max-w-[180px] font-medium" title={tplName}>
                        Decoder: {tplName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {agent.lastPacketAt ? new Date(agent.lastPacketAt).toLocaleTimeString() : "No packets"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Dynamic Codecs Active</span>
            <Link to="/vessels" className="font-semibold text-slate-700 hover:text-[#db4040]">
              Edit Codecs Function →
            </Link>
          </div>
        </div>
      </section>

      {/* 4. BOTTOM ROW: FLEET TELEMETRY MATRIX & LIVE STREAM FEED */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left (8 Cols): Registered Vessels Telemetry Matrix */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Fleet Telemetry & Status Matrix
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Live navigation feeds, machinery health, and actual packet reception timestamp.
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
                  <th className="px-4 py-3">Machinery / Env</th>
                  <th className="px-4 py-3">Data Status</th>
                  <th className="px-4 py-3">Last Received</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {vessels.map((v) => {
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition">
                      {/* Vessel */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{v.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
                          MMSI: {v.mmsi || "—"} • {v.type || "Vessel"}
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

                      {/* Machinery & Env */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-700">
                          {v.rpm !== null && v.rpm !== undefined && (
                            <span className="inline-flex items-center gap-0.5">
                              <CircleGauge className="h-3 w-3 text-orange-500" />
                              <strong>{Math.round(v.rpm)}</strong> RPM
                            </span>
                          )}
                          {v.depth !== null && v.depth !== undefined && (
                            <span className="inline-flex items-center gap-0.5">
                              <Database className="h-3 w-3 text-cyan-600" />
                              <strong>{v.depth.toFixed(1)}</strong> m
                            </span>
                          )}
                          {v.windSpeed !== null && v.windSpeed !== undefined && (
                            <span className="inline-flex items-center gap-0.5">
                              <Wind className="h-3 w-3 text-teal-600" />
                              <strong>{v.windSpeed.toFixed(1)}</strong> kn
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          Destination: {v.destination || "Not set"}
                        </div>
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

        {/* Right (4 Cols): Live Stream Log Feed & Active Alerts */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Live Telemetry Feed
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Decoded NMEA sentences and CAN PGN packets
                </p>
              </div>
              <Link to="/logs" className="text-xs font-bold text-[#db4040] hover:underline">
                View logs →
              </Link>
            </div>

            {/* Active Alerts if any */}
            {activeAlerts.length > 0 && (
              <div className="mt-3 space-y-2">
                {activeAlerts.slice(0, 2).map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start justify-between gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[11px]">{alert.message}</div>
                        <div className="text-[10px] text-amber-700 mt-0.5">
                          {vessels.find((v) => v.id === alert.vesselId)?.name}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="font-bold text-[10px] text-amber-800 hover:underline shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Log Stream */}
            <div className="mt-3.5 space-y-2.5">
              {logs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono text-[10px] text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        {log.decoder}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-700 truncate">
                        {log.summary}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                      {vessels.find((v) => v.id === log.vesselId)?.name || "Own Fleet"}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Live Buffer Streaming
            </span>
            <Link to="/logs" className="font-bold text-slate-600 hover:text-[#db4040]">
              Full Logs Inspector →
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
