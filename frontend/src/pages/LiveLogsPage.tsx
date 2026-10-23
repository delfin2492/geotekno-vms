import { useEffect, useMemo, useState } from "react"
import {
  Braces,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Download,
  FilterX,
  Radio,
  Search,
  Trash2,
} from "lucide-react"
import {
  Modal,
  PageHeader,
  StatusBadge,
  buttonSecondary,
  inputClass,
} from "@/components/common/UI"
import { useFleet } from "@/state/FleetProvider"
import { useAuth } from "@/state/AuthProvider"
import type { RawLog } from "@/domain/types"

export function LiveLogsPage() {
  const { user, isSuperadmin } = useAuth()
  const { logs, vessels, agents } = useFleet()
  const [live, setLive] = useState(true)
  const [snapshot, setSnapshot] = useState<RawLog[]>([])
  const [agentId, setAgentId] = useState("all")
  const [vesselId, setVesselId] = useState<string>(() => {
    return vessels.length === 1 ? vessels[0].id : "all"
  })
  const [decoder, setDecoder] = useState("all")
  const [severity, setSeverity] = useState("all")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<RawLog>()

  // Auto-sync vesselId with permitted vessels
  useEffect(() => {
    if (vessels.length === 1 && vesselId === "all") {
      setVesselId(vessels[0].id)
    } else if (vessels.length > 0 && vesselId !== "all" && !vessels.some((v) => v.id === vesselId)) {
      setVesselId(vessels[0].id)
    }
  }, [vessels, vesselId])

  const source = live ? logs : snapshot
  const pending = live ? 0 : Math.max(0, logs.length - snapshot.length)

  const permittedVesselIds = useMemo(() => new Set(vessels.map((v) => v.id)), [vessels])

  const filtered = useMemo(
    () =>
      source.filter((log) => {
        // Enforce vessel access permissions strictly
        if (!isSuperadmin && (!log.vesselId || !permittedVesselIds.has(log.vesselId))) {
          return false
        }
        return (
          (agentId === "all" || log.agentId === agentId) &&
          (vesselId === "all" ? true : log.vesselId === vesselId) &&
          (decoder === "all" || log.decoder === decoder) &&
          (severity === "all" || log.severity === severity) &&
          `${log.payload} ${log.summary}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
      }),
    [source, agentId, vesselId, decoder, severity, query, isSuperadmin, permittedVesselIds],
  )

  function toggleLive() {
    if (live) {
      setSnapshot(logs)
      setLive(false)
    } else {
      setLive(true)
      setSnapshot([])
    }
  }

  function reset() {
    setAgentId("all")
    setVesselId("all")
    setDecoder("all")
    setSeverity("all")
    setQuery("")
  }

  function exportCsv() {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
    const rows = [
      [
        "Timestamp",
        "Vessel",
        "Agent",
        "Decoder",
        "Severity",
        "Summary",
        "Payload",
      ],
      ...filtered.map((log) => [
        log.timestamp,
        vessels.find((v) => v.id === log.vesselId)?.name ?? "",
        agents.find((a) => a.id === log.agentId)?.name ?? "",
        log.decoder,
        log.severity,
        log.summary,
        log.payload,
      ]),
    ]
    const blob = new Blob(
      [rows.map((row) => row.map(escape).join(",")).join("\n")],
      { type: "text/csv" },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `nauticore-logs-${Date.now()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (vessels.length === 0) {
    return (
      <main className="grid min-h-[600px] place-items-center text-center p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-inner">
            <Radio className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-base font-bold text-slate-800">No Vessels Assigned to this Account</h1>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Your account ({user?.email}) does not have permission to access logs for any fleet vessels yet. Please contact your Fleet Administrator to assign vessel permissions.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1800px] p-4 sm:p-6 xl:p-8">
      <PageHeader
        eyebrow="Connectivity diagnostics"
        title="Live Logs"
        description={
          vessels.length === 1
            ? `Inspect decoded and raw payloads streaming for ${vessels[0].name}.`
            : `Inspect decoded and raw payloads streaming for your assigned fleet (${vessels.length} vessels).`
        }
        actions={
          <>
            <button onClick={exportCsv} className={buttonSecondary}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              onClick={toggleLive}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${
                live
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                  : "bg-amber-500 text-white shadow-lg shadow-amber-200"
              }`}
            >
              {live ? (
                <CirclePause className="h-4 w-4" />
              ) : (
                <CirclePlay className="h-4 w-4" />
              )}
              {live
                ? "Live stream"
                : `Resume${pending ? ` • ${pending} new` : ""}`}
            </button>
          </>
        }
      />

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-[10px] outline-none"
                placeholder="Search raw payload or decoded summary..."
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                className={`${inputClass} min-w-36`}
              >
                <option value="all">All agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <select
                value={vesselId}
                onChange={(event) => setVesselId(event.target.value)}
                className={`${inputClass} min-w-36`}
              >
                {vessels.length > 1 && (
                  <option value="all">All permitted vessels ({vessels.length})</option>
                )}
                {vessels.map((vessel) => (
                  <option key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </option>
                ))}
              </select>
              <select
                value={decoder}
                onChange={(event) => setDecoder(event.target.value)}
                className={inputClass}
              >
                <option value="all">All decoders</option>
                <option value="NMEA2000">NMEA 2000</option>
                <option value="NMEA0183">NMEA 0183</option>
              </select>
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
                className={inputClass}
              >
                <option value="all">All levels</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <button
              onClick={reset}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"
              aria-label="Reset filters"
            >
              <FilterX className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[9px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  live && logs.length > 0
                    ? "animate-pulse bg-emerald-500"
                    : live
                    ? "bg-slate-400"
                    : "bg-amber-500"
                }`}
              />
              {live
                ? logs.length > 0
                  ? "Receiving data"
                  : "Awaiting data stream"
                : "Stream paused"}
            </span>
            <span>{filtered.length} visible records</span>
            <span>Buffer capped at 1,000 rows</span>
            <span className="ml-auto">Newest records first</span>
          </div>
        </div>
        <div className="max-h-[650px] overflow-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Vessel / Agent</th>
                <th className="px-4 py-3">Decoder</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Decoded summary</th>
                <th className="px-4 py-3">Raw payload</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-slate-100 text-[10px] hover:bg-slate-50/70"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString("en-GB", {
                      hour12: false,
                    })}
                    <div className="mt-0.5 text-[8px] text-slate-300">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-700">
                      {vessels.find((vessel) => vessel.id === log.vesselId)
                        ?.name ?? "Unknown vessel"}
                    </div>
                    <div className="mt-0.5 text-[8px] text-slate-400">
                      {agents.find((agent) => agent.id === log.agentId)?.name ??
                        "Unknown agent"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-[8px] font-bold ${
                        log.decoder === "NMEA2000"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-violet-50 text-violet-600"
                      }`}
                    >
                      {log.decoder === "NMEA2000"
                        ? "CAN • N2K"
                        : "RS485 • 0183"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.severity} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {log.summary}
                  </td>
                  <td className="max-w-[360px] truncate px-4 py-3 font-mono text-[9px] text-slate-400">
                    {log.payload}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(log)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-teal-600"
                      aria-label="Inspect payload"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="grid h-72 place-items-center text-center">
              <div>
                <Braces className="mx-auto h-9 w-9 text-slate-300" />
                <div className="mt-3 text-xs font-bold text-slate-600">
                  {logs.length === 0
                    ? "No incoming raw telemetry packets"
                    : "No logs match these filters"}
                </div>
                <p className="mt-1 max-w-sm text-[11px] text-slate-400">
                  {logs.length === 0
                    ? "Connect your USR hardware / TCP gateway agent on port 20005 or 20006 to stream live NMEA & CAN telemetry."
                    : "Try adjusting or clearing your filters to view buffered records."}
                </p>
                {logs.length > 0 && (
                  <button
                    onClick={reset}
                    className="mt-2 text-[10px] font-bold text-teal-600"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      <div className="mt-3 flex items-center justify-between px-1 text-[9px] text-slate-400">
        <span>Production TCP Gateway • Listening on ports 20005 & 20006</span>
        <span className="flex items-center gap-1.5">
          <Radio className="h-3 w-3" />{" "}
          {agents.filter((agent) => agent.status === "connected").length} agents
          connected
        </span>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        title="Raw payload inspector"
        description="Decoded frame and source metadata."
      >
        {selected && (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-[10px]">
              {[
                [
                  "Vessel",
                  vessels.find((v) => v.id === selected.vesselId)?.name,
                ],
                ["Agent", agents.find((a) => a.id === selected.agentId)?.name],
                ["Decoder", selected.decoder],
                ["Timestamp", new Date(selected.timestamp).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-slate-400">{label}</div>
                  <div className="mt-1 font-bold text-slate-700">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="text-[10px] font-bold text-slate-600">
                Decoded summary
              </div>
              <div className="mt-2 rounded-xl border border-slate-200 p-3 text-[11px] text-slate-600">
                {selected.summary}
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[10px] font-bold text-slate-600">
                Raw payload
              </div>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-[10px] leading-5 text-teal-300">
                {selected.payload}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </main>
  )
}
