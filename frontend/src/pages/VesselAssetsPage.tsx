import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Activity,
  AlertCircle,
  Cable,
  Check,
  ChevronRight,
  CircleGauge,
  Compass,
  Cpu,
  Database,
  Edit3,
  Fuel,
  Layers,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Ship,
  Sparkles,
  Trash2,
  Waves,
  Wind,
  X,
  Zap,
  Thermometer,
  Code,
  Play,
  RotateCcw,
  FileCode,
} from "lucide-react"
import { Link } from "react-router"
import {
  OpenMapTilesMarineMap,
  type OpenMapTilesTheme,
} from "@/components/map/OpenMapTilesMarineMap"
import {
  Modal,
  ConfirmModal,
  StatusBadge,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/common/UI"
import { useFleet } from "@/state/FleetProvider"
import { useAuth } from "@/state/AuthProvider"
import { api } from "@/services/api"
import { DECODER_TEMPLATES } from "@/data/decoderTemplates"
import type {
  AgentDraft,
  AssetAttribute,
  AssetAttributeDraft,
  DiscoveredSignal,
  Vessel,
  VesselDraft,
} from "@/domain/types"

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

function getAttributeIcon(namespace: string, keyName: string) {
  const k = keyName.toLowerCase()
  const ns = namespace.toLowerCase()
  if (k.includes("sog") || k.includes("speed")) return <Waves className="h-3.5 w-3.5 text-blue-500" />
  if (k.includes("heading") || k.includes("compass")) return <Compass className="h-3.5 w-3.5 text-rose-500" />
  if (k.includes("cog") || k.includes("course") || k.includes("rot") || k.includes("turn")) return <CircleGauge className="h-3.5 w-3.5 text-amber-500" />
  if (k.includes("depth")) return <Database className="h-3.5 w-3.5 text-cyan-600" />
  if (k.includes("wind")) return <Wind className="h-3.5 w-3.5 text-teal-500" />
  if (k.includes("rpm") || k.includes("engine") || k.includes("boost")) return <Activity className="h-3.5 w-3.5 text-orange-500" />
  if (k.includes("fuel") || k.includes("tank")) return <Fuel className="h-3.5 w-3.5 text-emerald-500" />
  if (k.includes("battery") || k.includes("volt") || k.includes("current") || ns.includes("electr")) return <Zap className="h-3.5 w-3.5 text-yellow-500" />
  if (k.includes("temp")) return <Thermometer className="h-3.5 w-3.5 text-red-500" />
  if (k.includes("position") || k.includes("coord") || k.includes("alt") || k.includes("hdop")) return <Radio className="h-3.5 w-3.5 text-indigo-500" />
  if (ns === "motion") return <CircleGauge className="h-3.5 w-3.5 text-purple-500" />
  return <Activity className="h-3.5 w-3.5 text-slate-400" />
}

const blankVessel: VesselDraft = {
  name: "",
  type: "Container Ship",
  imo: "",
  mmsi: "",
  callSign: "",
  registerContent: "",
  agentIds: [],
  destination: "",
}

const blankAgent: AgentDraft = {
  name: "",
  host: "0.0.0.0",
  port: 20005,
  decoders: ["NMEA2000", "NMEA0183"],
  decoderTemplate: "HYBRID",
  decoderCode: DECODER_TEMPLATES.HYBRID.code,
}

export function VesselAssetsPage() {
  const { isSuperadmin, canAccessPage, canAccessFeature } = useAuth()
  const canWriteVessel = isSuperadmin || canAccessPage("vessels", "write")
  const canManageAgent = isSuperadmin || canAccessFeature("vessel.agent", "write")
  const canEditDecoder = isSuperadmin || canAccessFeature("vessel.decoder", "write")

  const {
    vessels,
    agents,
    addVessel,
    updateVessel,
    deleteVessel,
    addAgent,
    updateAgent,
    deleteAgent,
    setAgentStatus,
  } = useFleet()

  const [selectedId, setSelectedId] = useState(vessels[0]?.id ?? "")
  const [query, setQuery] = useState("")

  const [vesselModal, setVesselModal] = useState(false)
  const [agentModal, setAgentModal] = useState(false)
  const [editingVessel, setEditingVessel] = useState<Vessel>()
  const [editingAgentId, setEditingAgentId] = useState<string>()
  const [vesselDraft, setVesselDraft] = useState<VesselDraft>(blankVessel)
  const [agentDraft, setAgentDraft] = useState<AgentDraft>(blankAgent)
  const [testPayload, setTestPayload] = useState<string>("")
  const [testResult, setTestResult] = useState<{ success: boolean; output?: any; error?: string } | null>(null)
  const [testingDecoder, setTestingDecoder] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [mapTheme, setMapTheme] = useState<OpenMapTilesTheme>("liberty")
  const [centerTick, setCenterTick] = useState(0)

  const selected =
    vessels.find((vessel) => vessel.id === selectedId) ?? vessels[0]

  const filteredVessels = useMemo(
    () =>
      vessels.filter((vessel) =>
        `${vessel.name} ${vessel.mmsi} ${vessel.type}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [vessels, query],
  )

  useEffect(() => {
    if (!selected && vessels[0]) {
      setSelectedId(vessels[0].id)
    }
  }, [selected, vessels])

  useEffect(() => {
    if (selected?.id) {
      setCenterTick((t) => t + 1)
    }
  }, [selected?.id])

  function openVessel(vessel?: Vessel) {
    setEditingVessel(vessel)
    setVesselDraft(
      vessel
        ? {
          name: vessel.name,
          type: vessel.type,
          imo: vessel.imo || "",
          mmsi: vessel.mmsi,
          callSign: vessel.callSign,
          registerContent: vessel.registerContent || "",
          agentIds: vessel.agentIds,
          destination: vessel.destination,
        }
        : blankVessel,
    )
    setErrors({})
    setVesselModal(true)
  }

  function submitVessel(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!vesselDraft.name.trim()) nextErrors.name = "Vessel name is required."
    const cleanMmsi = vesselDraft.mmsi ? vesselDraft.mmsi.trim() : ""
    if (cleanMmsi.length > 0) {
      if (!/^\d{9}$/.test(cleanMmsi)) {
        nextErrors.mmsi = "MMSI must contain exactly 9 digits."
      } else if (
        vessels.some(
          (vessel) =>
            vessel.mmsi === cleanMmsi && vessel.id !== editingVessel?.id,
        )
      ) {
        nextErrors.mmsi = "This MMSI is already registered."
      }
    }
    const cleanImo = vesselDraft.imo ? vesselDraft.imo.trim() : ""
    if (cleanImo.length > 0 && !/^\d{7}$/.test(cleanImo)) {
      nextErrors.imo = "IMO must contain exactly 7 digits (e.g. 9123456)."
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (editingVessel) updateVessel(editingVessel.id, vesselDraft)
    else {
      const vessel = addVessel(vesselDraft)
      setSelectedId(vessel.id)
    }
    setVesselModal(false)
  }

  function openAgent(agentId?: string) {
    const agent = agents.find((item) => item.id === agentId)
    setEditingAgentId(agentId)
    const tplKey = agent?.decoderTemplate || (agent?.decoders?.includes("NMEA0183") && agent?.decoders?.includes("NMEA2000") ? "HYBRID" : (agent?.decoders?.includes("NMEA0183") ? "NMEA0183" : "NMEA2000"))
    const defaultCode = DECODER_TEMPLATES[tplKey]?.code || DECODER_TEMPLATES.HYBRID.code

    setAgentDraft(
      agent
        ? {
          name: agent.name,
          host: agent.host,
          port: agent.port,
          decoders: agent.decoders || ["NMEA2000", "NMEA0183"],
          decoderTemplate: tplKey,
          decoderCode: agent.decoderCode || defaultCode,
        }
        : blankAgent,
    )
    setTestPayload(DECODER_TEMPLATES[tplKey]?.samplePayload || "")
    setTestResult(null)
    setErrors({})
    setAgentModal(true)
  }

  function handleSelectTemplate(tplId: string) {
    const tpl = DECODER_TEMPLATES[tplId]
    if (!tpl) return
    setAgentDraft((prev) => ({
      ...prev,
      decoderTemplate: tpl.id,
      decoders: tpl.decoders,
      decoderCode: tpl.code,
    }))
    setTestPayload(tpl.samplePayload)
    setTestResult(null)
  }

  function handleResetCode() {
    const tplId = agentDraft.decoderTemplate || "HYBRID"
    const tpl = DECODER_TEMPLATES[tplId] || DECODER_TEMPLATES.HYBRID
    setAgentDraft((prev) => ({
      ...prev,
      decoderCode: tpl.code,
    }))
    setTestResult(null)
  }

  async function handleTestDecoder() {
    if (!agentDraft.decoderCode) return
    setTestingDecoder(true)
    setTestResult(null)
    try {
      const res = await api.testDecoder(agentDraft.decoderCode, testPayload)
      setTestResult({ success: true, output: res.output })
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || "Execution error" })
    } finally {
      setTestingDecoder(false)
    }
  }

  function submitAgent(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!agentDraft.name.trim())
      nextErrors.agentName = "Agent name is required."
    if (
      agents.some(
        (agent) =>
          agent.name.toLowerCase() === agentDraft.name.toLowerCase() &&
          agent.id !== editingAgentId,
      )
    )
      nextErrors.agentName = "Agent name must be unique."
    if (!agentDraft.host.trim()) nextErrors.host = "Host address is required."
    if (
      !Number.isInteger(Number(agentDraft.port)) ||
      agentDraft.port < 1 ||
      agentDraft.port > 65535
    )
      nextErrors.port = "Port must be between 1 and 65535."
    if (!agentDraft.decoders || !agentDraft.decoders.length)
      nextErrors.decoders = "Enable at least one payload decoder."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (editingAgentId) updateAgent(editingAgentId, agentDraft)
    else addAgent(agentDraft)
    setAgentModal(false)
  }

  function testAgent(id: string) {
    setAgentStatus(id, "testing")
    window.setTimeout(() => setAgentStatus(id, "connected"), 1100)
  }

  const isOnline = Boolean(
    agents.some(
      (agent) =>
        selected?.agentIds?.includes(agent.id) &&
        agent.status === "connected",
    ),
  )

  const activePosition = selected?.position ?? {
    lat: 1.212,
    lng: 103.718,
  }

  // --- Confirmation Dialog State ---
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: React.ReactNode
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  })

  // --- Asset Attributes State & Handlers ---
  const [activeTab, setActiveTab] = useState<"overview" | "attributes">("overview")
  const [attributes, setAttributes] = useState<AssetAttribute[]>([])
  const [loadingAttributes, setLoadingAttributes] = useState(false)
  const [attrSearch, setAttrSearch] = useState("")
  const [selectedNamespace, setSelectedNamespace] = useState<string>("all")

  const [attrModal, setAttrModal] = useState(false)
  const [editingAttr, setEditingAttr] = useState<AssetAttribute | null>(null)
  const [attrDraft, setAttrDraft] = useState<AssetAttributeDraft>({
    namespace: "navigation",
    keyName: "",
    displayName: "",
    unit: "",
    pointingSource: "",
  })
  const [attrErrors, setAttrErrors] = useState<Record<string, string>>({})

  const [scanModal, setScanModal] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [discoveredSignals, setDiscoveredSignals] = useState<DiscoveredSignal[]>([])

  const loadAttributes = async (vesselId: string) => {
    if (!vesselId) return
    setLoadingAttributes(true)
    try {
      const data = await api.getAttributes(vesselId)
      setAttributes(data)
    } catch (err) {
      console.error("Failed to load vessel attributes:", err)
    } finally {
      setLoadingAttributes(false)
    }
  }

  useEffect(() => {
    if (!selected?.id) return
    loadAttributes(selected.id)
    const interval = setInterval(() => {
      api.getAttributes(selected.id).then(setAttributes).catch(() => { })
    }, 2000)
    return () => clearInterval(interval)
  }, [selected?.id])

  function openAddAttribute() {
    setEditingAttr(null)
    setAttrDraft({
      namespace: "navigation",
      keyName: "",
      displayName: "",
      unit: "",
      pointingSource: "",
    })
    setAttrErrors({})
    setAttrModal(true)
  }

  function openEditAttribute(attr: AssetAttribute) {
    setEditingAttr(attr)
    setAttrDraft({
      namespace: attr.namespace,
      keyName: attr.keyName,
      displayName: attr.displayName,
      unit: attr.unit,
      pointingSource: attr.pointingSource || attr.pgnSource || "",
    })
    setAttrErrors({})
    setAttrModal(true)
  }

  async function submitAttribute(e: FormEvent) {
    e.preventDefault()
    if (!selected?.id) return
    const errs: Record<string, string> = {}
    if (!attrDraft.keyName.trim()) errs.keyName = "Variable key is required."
    if (!attrDraft.displayName.trim()) errs.displayName = "Display label is required."
    setAttrErrors(errs)
    if (Object.keys(errs).length > 0) return

    try {
      if (editingAttr) {
        await api.updateAttribute(selected.id, editingAttr.id, attrDraft)
      } else {
        await api.createAttribute(selected.id, attrDraft)
      }
      await loadAttributes(selected.id)
      setAttrModal(false)
    } catch (err: any) {
      setAttrErrors({ submit: err.message || "Failed to save attribute" })
    }
  }

  function handleDeleteAttribute(attrId: string, attrName: string) {
    if (!selected?.id) return
    setConfirmDialog({
      open: true,
      title: "Delete Telemetry Attribute",
      message: (
        <span>
          Are you sure you want to delete telemetry attribute <strong>"{attrName}"</strong>? This will remove its historical database entries and binding sources.
        </span>
      ),
      confirmLabel: "Delete Attribute",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        try {
          await api.deleteAttribute(selected.id, attrId)
          setAttributes((prev) => prev.filter((a) => a.id !== attrId))
        } catch (err) {
          console.error("Failed to delete attribute:", err)
        }
      },
    })
  }

  async function handleStartScan() {
    if (!selected?.id) return
    setScanModal(true)
    setScanning(true)
    try {
      const signals = await api.scanAvailableSignals(selected.id)
      setDiscoveredSignals(signals)
    } catch (err) {
      console.error("Failed to scan sensor signals:", err)
    } finally {
      setScanning(false)
    }
  }

  async function handleAddDiscoveredSignal(sig: DiscoveredSignal) {
    if (!selected?.id) return
    try {
      await api.createAttribute(selected.id, {
        namespace: sig.namespace,
        keyName: sig.keyName,
        displayName: sig.displayName,
        unit: sig.unit,
        pointingSource: sig.pointingSource || sig.pgnSource || "",
      })
      setDiscoveredSignals((prev) =>
        prev.filter((p) => !(p.namespace === sig.namespace && p.keyName === sig.keyName))
      )
      await loadAttributes(selected.id)
    } catch (err) {
      console.error("Failed to add discovered signal:", err)
    }
  }

  const filteredAttributes = useMemo(() => {
    return attributes.filter((a) => {
      const matchesNs = selectedNamespace === "all" || a.namespace === selectedNamespace
      const q = attrSearch.toLowerCase()
      const matchesSearch =
        !q ||
        a.displayName.toLowerCase().includes(q) ||
        a.keyName.toLowerCase().includes(q) ||
        (a.pointingSource || a.pgnSource || "").toLowerCase().includes(q) ||
        a.namespace.toLowerCase().includes(q)
      return matchesNs && matchesSearch
    })
  }, [attributes, selectedNamespace, attrSearch])

  const groupedAttributes = useMemo(() => {
    const groups: Record<string, AssetAttribute[]> = {}
    for (const attr of filteredAttributes) {
      const ns = attr.namespace.toLowerCase()
      if (!groups[ns]) groups[ns] = []
      groups[ns].push(attr)
    }
    return groups
  }, [filteredAttributes])

  function getNamespaceMeta(ns: string) {
    switch (ns.toLowerCase()) {
      case "navigation":
        return {
          title: "Navigation & Position",
          icon: Compass,
          badge: "bg-blue-50 text-blue-700 border-blue-200",
        }
      case "motion":
        return {
          title: "Motion & Attitude",
          icon: CircleGauge,
          badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        }
      case "environment":
        return {
          title: "Environment & Weather",
          icon: Waves,
          badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
        }
      case "engine":
      case "propulsion":
        return {
          title: "Propulsion & Machinery",
          icon: Cpu,
          badge: "bg-orange-50 text-orange-700 border-orange-200",
        }
      case "tanks":
        return {
          title: "Tanks & Fluid Levels",
          icon: Fuel,
          badge: "bg-amber-50 text-amber-700 border-amber-200",
        }
      case "electrical":
        return {
          title: "Electrical & Power",
          icon: Zap,
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        }
      default:
        return {
          title: ns.toUpperCase(),
          icon: Radio,
          badge: "bg-slate-50 text-slate-700 border-slate-200",
        }
    }
  }

  return (
    <div className="flex h-[calc(100vh-68px)] w-full overflow-hidden bg-[#f4f6f8]">
      {/* Sidebar - Clean GeoTekno Fleet Panel */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
        {/* Sidebar Header with Actions */}
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Registered Fleet
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {vessels.length} {vessels.length === 1 ? "vessel" : "vessels"}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {canWriteVessel && (
              <button
                onClick={() => openVessel()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#db4040] py-2.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-[#b92b2b] transition active:scale-[0.99]"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Register Vessel</span>
              </button>
            )}
            {canManageAgent && (
              <button
                onClick={() => setAgentModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition active:scale-[0.99]"
              >
                <Server className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>Manage Connectivity Agents</span>
              </button>
            )}
          </div>

          {/* Search Input */}
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 focus-within:border-[#db4040] focus-within:bg-white focus-within:text-slate-600 focus-within:shadow-sm transition">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Search vessel or MMSI..."
            />
          </label>
        </div>

        {/* Vessel List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredVessels.map((vessel) => {
            const online = agents.some(
              (agent) =>
                vessel.agentIds.includes(agent.id) &&
                agent.status === "connected",
            )
            const isSelected = selected?.id === vessel.id
            return (
              <button
                key={vessel.id}
                onClick={() => setSelectedId(vessel.id)}
                className={`mb-2 w-full rounded-xl border p-3 text-left transition ${isSelected
                  ? "border-red-200 bg-red-50/40 shadow-sm ring-1 ring-[#db4040]/30"
                  : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/70"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${isSelected
                      ? "bg-[#db4040] text-white"
                      : "bg-slate-100 text-slate-600"
                      }`}
                  >
                    <Ship className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-bold text-slate-800">
                        {vessel.name}
                      </span>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-emerald-500" : "bg-red-400"
                          }`}
                        title={online ? "Connected" : "Offline"}
                      />
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {vessel.mmsi ? `MMSI ${vessel.mmsi}` : "No MMSI"} •{" "}
                      {vessel.type || "Vessel"}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[9px]">
                      <span
                        className={`font-bold ${online ? "text-emerald-600" : "text-slate-400"
                          }`}
                      >
                        {online ? "CONNECTED" : "OFFLINE"}
                      </span>
                      <span className="text-slate-400 font-medium">
                        {(vessel.sog ?? 0).toFixed(1)} kn • {Math.round(vessel.heading ?? 0)}°
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}

          {!filteredVessels.length && (
            <div className="p-8 text-center">
              <Ship className="mx-auto h-7 w-7 text-slate-300" />
              <div className="mt-2 text-xs font-bold text-slate-600">
                No vessels found
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Try a different search term or register a new vessel.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>{agents.length} TCP Gateways configured</span>
          <button
            onClick={() => setAgentModal(true)}
            className="font-bold text-[#db4040] hover:underline"
          >
            Manage →
          </button>
        </div>
      </aside>

      {/* Main Content Area - Standalone floating cards directly on canvas */}
      <main className="flex-1 overflow-y-auto p-5 sm:p-6">
        {selected ? (
          <>
            {/* Top Vessel Header Row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-[#db4040]">
                  <Ship className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">
                      {selected.name}
                    </h1>
                    <StatusBadge status={selected.quality} />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                      {selected.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    MMSI {selected.mmsi} • Call Sign {selected.callSign} • IMO{" "}
                    {selected.imo || "Not set"} • {selected.type}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 hidden lg:inline">
                  Last update: {formatDateTime(selected.updatedAt)}
                </span>
                {canWriteVessel && (
                  <button
                    onClick={() => openVessel(selected)}
                    className={buttonSecondary}
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit Vessel
                  </button>
                )}
                {isSuperadmin && (
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        open: true,
                        title: "Delete Vessel Asset",
                        message: (
                          <span>
                            Are you sure you want to permanently delete vessel <strong>"{selected.name}"</strong>? All associated telemetry attributes and agent bindings will be detached.
                          </span>
                        ),
                        confirmLabel: "Delete Vessel",
                        cancelLabel: "Cancel",
                        onConfirm: () => {
                          deleteVessel(selected.id)
                          setSelectedId(
                            vessels.find((v) => v.id !== selected.id)?.id ?? "",
                          )
                        },
                      })
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                    title="Delete vessel (Superadmin only)"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 mt-3 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${activeTab === "overview"
                  ? "border-[#db4040] text-[#db4040]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("attributes")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${activeTab === "attributes"
                  ? "border-[#db4040] text-[#db4040]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
              >
                <Radio className="h-3.5 w-3.5" />
                <span>Attributes & Telemetry</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeTab === "attributes"
                    ? "bg-red-100 text-[#db4040]"
                    : "bg-slate-100 text-slate-600"
                    }`}
                >
                  {attributes.length}
                </span>
              </button>
            </div>

            {activeTab === "overview" ? (
              /* Standalone Floating Cards Grid (No enclosing container div) */
              <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Left Column Cards */}
                <div className="space-y-6 lg:col-span-7">
                  {/* Card 1: Vessel Information */}
                  <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-800">
                      Vessel Identification & Details
                    </h2>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <div className="text-[10px] font-semibold text-slate-400">
                          Vessel Type
                        </div>
                        <div className="mt-1 text-xs font-bold text-slate-800">
                          {selected.type}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <div className="text-[10px] font-semibold text-slate-400">
                          Destination
                        </div>
                        <div className="mt-1 text-xs font-bold text-slate-800">
                          {selected.destination || "Not Assigned"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <div className="text-[10px] font-semibold text-slate-400">
                          Navigation Status
                        </div>
                        <div className="mt-1 text-xs font-bold text-slate-800">
                          {selected.status}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <div className="text-[10px] font-semibold text-slate-400">
                          MMSI
                        </div>
                        <div className="mt-1 font-mono text-xs font-bold text-slate-800">
                          {selected.mmsi}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <div className="text-[10px] font-semibold text-slate-400">
                          Call Sign
                        </div>
                        <div className="mt-1 font-mono text-xs font-bold text-slate-800">
                          {selected.callSign}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <div className="text-[10px] font-semibold text-slate-400">
                          IMO Number
                        </div>
                        <div className="mt-1 font-mono text-xs font-bold text-slate-800">
                          {selected.imo || "—"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <div className="text-[10px] font-semibold text-slate-400">
                          Register Content (TCP)
                        </div>
                        <div className="mt-1 font-mono text-xs font-bold text-slate-800 truncate" title={selected.registerContent || "Auto / ID Match"}>
                          {selected.registerContent || "Auto / Default"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Navigation & Engine Telemetry (Menampilkan Semua Data Attribute Payload Agent) */}
                  <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-sm font-bold text-slate-800">
                          Navigation & Engine Telemetry
                        </h2>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-600">
                          {attributes.length} SIGNALS
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab("attributes")}
                          className="text-[10px] font-bold text-[#db4040] hover:underline transition"
                        >
                          Manage Signals →
                        </button>
                      </div>
                    </div>

                    {/* Grid Semua Data Attributes dari Payload Agent */}
                    {attributes.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {attributes.map((attr) => {
                          const isLive = attr.status === "live"
                          const hasVal = attr.liveValue !== null && attr.liveValue !== undefined
                          const displayVal = hasVal ? String(attr.liveValue) : "—"
                          return (
                            <div
                              key={attr.id}
                              className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 hover:bg-slate-50 hover:border-slate-300 transition"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <span
                                  className="truncate text-[10px] font-bold text-slate-600"
                                  title={attr.displayName}
                                >
                                  {attr.displayName}
                                </span>
                                <span className="shrink-0 p-1 rounded-md bg-white border border-slate-200/80 shadow-xs">
                                  {getAttributeIcon(attr.namespace, attr.keyName)}
                                </span>
                              </div>

                              <div className="my-1.5 flex items-baseline gap-1">
                                <span className="font-mono text-base font-bold text-slate-900 truncate">
                                  {displayVal}
                                </span>
                                {attr.unit && (
                                  <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                    {attr.unit}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-200/50 pt-1.5 text-[8px]">
                                <span
                                  className="truncate font-mono text-slate-400 max-w-[100px]"
                                  title={attr.pointingSource || attr.pgnSource || "Agent Feed"}
                                >
                                  {attr.pointingSource || attr.pgnSource || "Agent Feed"}
                                </span>
                                <span
                                  className={`flex items-center gap-1 font-bold ${isLive ? "text-emerald-600" : hasVal ? "text-amber-600" : "text-slate-400"
                                    }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : hasVal ? "bg-amber-400" : "bg-slate-300"
                                      }`}
                                  />
                                  {isLive ? "LIVE" : hasVal ? "LAST KNOWN" : "OFFLINE"}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      /* Fallback telemetri standar saat atribut belum dimuat */
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400">
                              Speed (SOG)
                            </span>
                            <Waves className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                          <div className="mt-1 text-base font-bold text-slate-800">
                            {selected.sog.toFixed(1)} <span className="text-[10px] text-slate-400">kn</span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400">
                              Heading
                            </span>
                            <CircleGauge className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                          <div className="mt-1 text-base font-bold text-slate-800">
                            {Math.round(selected.heading)}°
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400">
                              Course (COG)
                            </span>
                            <Activity className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                          <div className="mt-1 text-base font-bold text-slate-800">
                            {Math.round(selected.cog)}°
                          </div>
                        </div>
                        {selected.depth !== null && selected.depth !== undefined && (
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-slate-400">
                                Water Depth
                              </span>
                              <Database className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <div className="mt-1 text-base font-bold text-slate-800">
                              {selected.depth.toFixed(1)} <span className="text-[10px] text-slate-400">m</span>
                            </div>
                          </div>
                        )}
                        {selected.rpm !== null && selected.rpm !== undefined && (
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="text-[10px] font-semibold text-slate-400">
                              Engine RPM
                            </div>
                            <div className="mt-1 text-base font-bold text-slate-800">
                              {Math.round(selected.rpm)}
                            </div>
                          </div>
                        )}
                        {selected.engineLoad !== null && selected.engineLoad !== undefined && (
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="text-[10px] font-semibold text-slate-400">
                              Engine Load
                            </div>
                            <div className="mt-1 text-base font-bold text-slate-800">
                              {selected.engineLoad.toFixed(1)}%
                            </div>
                          </div>
                        )}
                        {selected.fuel !== null && selected.fuel !== undefined && (
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-slate-400">
                                Fuel Level
                              </span>
                              <Fuel className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <div className="mt-1 text-base font-bold text-slate-800">
                              {selected.fuel.toFixed(0)}%
                            </div>
                          </div>
                        )}
                        {selected.windSpeed !== null && selected.windSpeed !== undefined && (
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-slate-400">
                                Wind Speed
                              </span>
                              <Wind className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <div className="mt-1 text-base font-bold text-slate-800">
                              {selected.windSpeed.toFixed(1)} <span className="text-[10px] text-slate-400">kn</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* Right Column Cards */}
                <div className="space-y-6 lg:col-span-5">
                  {/* Card: 3D Marine Map Location */}
                  <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-800">
                          Current Location
                        </h2>
                        <span className="rounded bg-sky-50 px-2 py-0.5 text-[9px] font-bold text-sky-700 border border-sky-200">
                          3D MAP VIEW
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCenterTick((t) => t + 1)}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          title="Pusatkan Kamera ke Kapal"
                        >
                          Center
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMapTheme(mapTheme === "liberty" ? "dark" : "liberty")
                          }
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          title="Ganti Tampilan 3D / Dark Nautical"
                        >
                          {mapTheme === "liberty" ? "3D Liberty" : "Dark"}
                        </button>
                      </div>
                    </div>

                    <div className="relative h-72 w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner">
                      <OpenMapTilesMarineMap
                        selectedVessel={selected}
                        aisTargets={[]}
                        ports={[]}
                        track={[]}
                        isOwnShipSelected={true}
                        onSelectTarget={() => { }}
                        onSelectOwnShip={() => setCenterTick((t) => t + 1)}
                        theme={mapTheme}
                        showRangeRings={true}
                        showTrack={false}
                        centerTick={centerTick}
                      />
                      <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 rounded-lg bg-slate-900/90 text-white px-2.5 py-1 text-[10px] font-semibold shadow border border-slate-700 backdrop-blur-sm pointer-events-none">
                        <span className="h-2 w-2 rounded-full bg-[#db4040] animate-pulse" />
                        <span className="font-bold text-white">
                          {selected.name}
                        </span>
                        <span className="text-slate-400 font-mono text-[9px] ml-1">
                          {activePosition.lat.toFixed(5)}°, {activePosition.lng.toFixed(5)}°
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        Updated: {formatDateTime(selected.updatedAt)}
                      </span>
                      <Link
                        to="/marine-traffic"
                        className="font-bold text-[#db4040] hover:underline transition"
                      >
                        Open Full Marine Traffic Map →
                      </Link>
                    </div>
                  </div>

                  {/* Card 5: Assigned Connectivity Agents */}
                  <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-bold text-slate-800">
                        Linked Gateways & TCP Agents
                      </h2>
                      <button
                        onClick={() => setAgentModal(true)}
                        className="text-[10px] font-bold text-[#db4040] hover:underline"
                      >
                        Manage All →
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {agents
                        .filter((agent) => selected.agentIds.includes(agent.id))
                        .map((agent) => (
                          <div
                            key={agent.id}
                            className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-blue-600" />
                                <span className="text-xs font-bold text-slate-800">
                                  {agent.name}
                                </span>
                              </div>
                              <StatusBadge status={agent.status} />
                            </div>
                            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
                              <span>
                                tcp://{agent.host}:{agent.port}
                              </span>
                              <span>{agent.packetsPerMinute} pkt/min</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[10px]">
                              <span className="text-slate-400">
                                Decoders: {agent.decoders.join(" + ")}
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => testAgent(agent.id)}
                                  className="font-bold text-[#db4040] hover:underline"
                                >
                                  Test connection
                                </button>
                                <button
                                  onClick={() => openAgent(agent.id)}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                      {!selected.agentIds.length && (
                        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                          <Cable className="mx-auto h-6 w-6 text-slate-300" />
                          <div className="mt-2 text-xs font-bold text-slate-600">
                            No connectivity gateway linked
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Edit this vessel to link a TCP agent.
                          </p>
                          <button
                            onClick={() => openVessel(selected)}
                            className="mt-3 text-[10px] font-bold text-[#db4040] hover:underline"
                          >
                            Assign Gateway Now →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Attributes & Telemetry Registry View */
              <div className="mt-5 space-y-6">
                {/* Control Bar */}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {/* Search */}
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-400 focus-within:border-[#db4040] focus-within:bg-white focus-within:text-slate-600 focus-within:shadow-sm transition text-xs w-full sm:w-64">
                      <Search className="h-3.5 w-3.5 shrink-0" />
                      <input
                        value={attrSearch}
                        onChange={(e) => setAttrSearch(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
                        placeholder="Search attribute, key, PGN..."
                      />
                    </label>

                    {/* Namespace Filter */}
                    <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
                      {[
                        { id: "all", label: "All Namespaces" },
                        { id: "navigation", label: "Navigation" },
                        { id: "motion", label: "Motion" },
                        { id: "environment", label: "Environment" },
                        { id: "engine", label: "Engine" },
                        { id: "tanks", label: "Tanks" },
                        { id: "electrical", label: "Electrical" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedNamespace(item.id)}
                          className={`rounded-lg px-2.5 py-1 font-medium transition text-[11px] whitespace-nowrap ${selectedNamespace === item.id
                            ? "bg-slate-900 text-white font-bold"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleStartScan}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 transition active:scale-[0.99]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Scan Sensors</span>
                    </button>
                    <button
                      type="button"
                      onClick={openAddAttribute}
                      className="flex items-center gap-1.5 rounded-xl bg-[#db4040] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#b92b2b] transition active:scale-[0.99]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Attribute</span>
                    </button>
                  </div>
                </div>

                {/* Grouped Attributes Accordion/Cards */}
                {Object.keys(groupedAttributes).length > 0 ? (
                  <div className="space-y-5">
                    {Object.entries(groupedAttributes).map(([ns, items]) => {
                      const meta = getNamespaceMeta(ns)
                      const IconComponent = meta.icon
                      return (
                        <div
                          key={ns}
                          className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
                        >
                          {/* Group Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`grid h-7 w-7 place-items-center rounded-lg border ${meta.badge}`}
                              >
                                <IconComponent className="h-3.5 w-3.5" />
                              </span>
                              <div>
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  {meta.title}
                                </h3>
                              </div>
                            </div>
                            <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                              {items.length}{" "}
                              {items.length === 1 ? "attribute" : "attributes"}
                            </span>
                          </div>

                          {/* Table of attributes */}
                          <div className="divide-y divide-slate-100">
                            {items.map((attr) => (
                              <div
                                key={attr.id}
                                className="flex flex-col gap-3 p-4 hover:bg-slate-50/60 transition sm:flex-row sm:items-center sm:justify-between"
                              >
                                {/* Attribute Info */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900">
                                      {attr.displayName}
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {attr.namespace}.{attr.keyName}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700 font-semibold">
                                      {(attr.pointingSource || attr.pgnSource) || "Manual Feed"}
                                    </span>
                                    {attr.unit && (
                                      <span>
                                        Unit: <strong>{attr.unit}</strong>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Live Value & Status Badge */}
                                <div className="flex items-center gap-6 shrink-0">
                                  <div className="text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {attr.status === "live" ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                          LIVE
                                        </span>
                                      ) : attr.status === "stale" ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                                          LAST KNOWN
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                                          OFFLINE
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-0.5 font-mono text-base font-extrabold text-slate-900">
                                      {attr.liveValue !== null &&
                                        attr.liveValue !== undefined ? (
                                        <span>
                                          {attr.liveValue}{" "}
                                          <span className="text-xs font-normal text-slate-500">
                                            {attr.unit}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 font-normal text-sm">
                                          —
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1 border-l border-slate-100 pl-4">
                                    <button
                                      type="button"
                                      onClick={() => openEditAttribute(attr)}
                                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                                      title="Edit attribute"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteAttribute(
                                          attr.id,
                                          attr.displayName,
                                        )
                                      }
                                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                                      title="Delete attribute"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                    <Radio className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-3 text-sm font-bold text-slate-800">
                      No attributes found
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                      {attrSearch
                        ? "No configured attributes match your search filter."
                        : "This vessel does not have any telemetry attributes registered yet."}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={openAddAttribute}
                        className={buttonPrimary}
                      >
                        <Plus className="h-4 w-4" /> Add Attribute
                      </button>
                      <button
                        type="button"
                        onClick={handleStartScan}
                        className={buttonSecondary}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Scan Incoming Signals
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div>
              <Ship className="mx-auto h-12 w-12 text-slate-300" />
              <h2 className="mt-3 text-base font-bold text-slate-700">
                No vessel selected
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Register a vessel or select one from the left sidebar.
              </p>
              <button
                onClick={() => openVessel()}
                className={`${buttonPrimary} mt-4`}
              >
                <Plus className="h-4 w-4" /> Register vessel
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Vessel Modal */}
      <Modal
        open={vesselModal}
        onClose={() => setVesselModal(false)}
        title={editingVessel ? "Edit vessel" : "Register vessel"}
        description="Create the digital identity and assign connectivity agents."
      >
        <form onSubmit={submitVessel} className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Vessel name
              </span>
              <input
                value={vesselDraft.name}
                onChange={(event) =>
                  setVesselDraft({ ...vesselDraft, name: event.target.value })
                }
                className={inputClass}
                placeholder="MV Vessel Name"
              />
              {errors.name && (
                <span className="mt-1 block text-[9px] text-red-600">
                  {errors.name}
                </span>
              )}
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Vessel type
              </span>
              <select
                value={vesselDraft.type}
                onChange={(event) =>
                  setVesselDraft({ ...vesselDraft, type: event.target.value })
                }
                className={inputClass}
              >
                <option>Container Ship</option>
                <option>Oil Tanker</option>
                <option>Bulk Carrier</option>
                <option>Passenger Vessel</option>
                <option>Offshore Support</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Destination
              </span>
              <input
                value={vesselDraft.destination}
                onChange={(event) =>
                  setVesselDraft({
                    ...vesselDraft,
                    destination: event.target.value,
                  })
                }
                className={inputClass}
                placeholder="Singapore"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                MMSI <span className="font-normal text-slate-400">(Optional - Auto-fills from AIS)</span>
              </span>
              <input
                value={vesselDraft.mmsi}
                onChange={(event) =>
                  setVesselDraft({
                    ...vesselDraft,
                    mmsi: event.target.value.replace(/\D/g, "").slice(0, 9),
                  })
                }
                className={inputClass}
                placeholder="Auto-detected or 9 digits"
              />
              {errors.mmsi && (
                <span className="mt-1 block text-[9px] text-red-600">
                  {errors.mmsi}
                </span>
              )}
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Call sign <span className="font-normal text-slate-400">(Optional - Auto-fills from AIS)</span>
              </span>
              <input
                value={vesselDraft.callSign}
                onChange={(event) =>
                  setVesselDraft({
                    ...vesselDraft,
                    callSign: event.target.value.toUpperCase(),
                  })
                }
                className={inputClass}
                placeholder="Auto-detected or e.g. YBXT2"
              />
              {errors.callSign && (
                <span className="mt-1 block text-[9px] text-red-600">
                  {errors.callSign}
                </span>
              )}
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                IMO number <span className="font-normal text-slate-400">(Optional - Auto-fills from AIS)</span>
              </span>
              <input
                value={vesselDraft.imo || ""}
                onChange={(event) =>
                  setVesselDraft({
                    ...vesselDraft,
                    imo: event.target.value.replace(/\D/g, "").slice(0, 7),
                  })
                }
                className={inputClass}
                placeholder="Auto-detected or 7 digits (e.g. 9123456)"
              />
              {errors.imo && (
                <span className="mt-1 block text-[9px] text-red-600">
                  {errors.imo}
                </span>
              )}
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Register Content <span className="font-normal text-slate-400"></span>
              </span>
              <input
                value={vesselDraft.registerContent || ""}
                onChange={(event) =>
                  setVesselDraft({
                    ...vesselDraft,
                    registerContent: event.target.value.trim(),
                  })
                }
                className={inputClass}
                placeholder="e.g. KM_GEO_TEKNO_01 or USR_CANET_01"
              />
            </label>
            <div className="sm:col-span-2">
              <span className="mb-2 block text-[10px] font-bold text-slate-600">
                Connectivity agents
              </span>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                {agents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={vesselDraft.agentIds.includes(agent.id)}
                        onChange={() =>
                          setVesselDraft({
                            ...vesselDraft,
                            agentIds: vesselDraft.agentIds.includes(agent.id)
                              ? vesselDraft.agentIds.filter(
                                  (id: string) => id !== agent.id,
                                )
                              : [...vesselDraft.agentIds, agent.id],
                          })
                        }
                      />
                      <span className="text-[10px] font-semibold text-slate-700">
                        {agent.name}
                      </span>
                    </span>
                    <StatusBadge status={agent.status} />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setVesselModal(false)}
              className={buttonSecondary}
            >
              Cancel
            </button>
            <button className={buttonPrimary}>
              {editingVessel ? "Save changes" : "Register vessel"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Agents Modal */}
      <Modal
        open={agentModal}
        onClose={() => setAgentModal(false)}
        title="Connectivity agents"
        description="Manage TCP gateways and payload decoders."
        wide
      >
        <div className="grid md:grid-cols-[260px_1fr]">
          <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <button
              onClick={() => openAgent()}
              className={`${buttonSecondary} w-full`}
            >
              <Plus className="h-4 w-4" /> New agent
            </button>
            <div className="mt-3 space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => openAgent(agent.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${editingAgentId === agent.id
                    ? "border-red-300 bg-red-50/50"
                    : "border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold">{agent.name}</span>
                    <StatusBadge status={agent.status} />
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-slate-400">
                    {agent.host}:{agent.port}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={submitAgent} className="p-5 max-h-[80vh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                  Agent name
                </span>
                <input
                  value={agentDraft.name}
                  onChange={(event) =>
                    setAgentDraft({ ...agentDraft, name: event.target.value })
                  }
                  className={inputClass}
                  placeholder="Bridge Gateway 01"
                />
                {errors.agentName && (
                  <span className="mt-1 block text-[9px] text-red-600">
                    {errors.agentName}
                  </span>
                )}
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                  Host address
                </span>
                <input
                  value={agentDraft.host}
                  onChange={(event) =>
                    setAgentDraft({ ...agentDraft, host: event.target.value })
                  }
                  className={inputClass}
                  placeholder="192.168.40.84"
                />
                {errors.host && (
                  <span className="mt-1 block text-[9px] text-red-600">
                    {errors.host}
                  </span>
                )}
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                  Port
                </span>
                <input
                  type="number"
                  value={agentDraft.port}
                  onChange={(event) =>
                    setAgentDraft({
                      ...agentDraft,
                      port: Number(event.target.value),
                    })
                  }
                  className={inputClass}
                  placeholder="20005"
                />
                {errors.port && (
                  <span className="mt-1 block text-[9px] text-red-600">
                    {errors.port}
                  </span>
                )}
              </label>

              {/* 1. Decoder Template Selection */}
              <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-[11px] font-bold text-slate-700">
                    Payload Decoder Template
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Pilih template bawaan untuk auto-generate kode decode
                  </span>
                </div>
                <select
                  value={agentDraft.decoderTemplate || "HYBRID"}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className={`${inputClass} font-semibold text-slate-800 bg-white`}
                >
                  {Object.values(DECODER_TEMPLATES).map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {DECODER_TEMPLATES[agentDraft.decoderTemplate || "HYBRID"]?.description}
                </p>
              </div>

              {/* 2. Custom Function Decoder Code Editor */}
              <div className="sm:col-span-2 space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <Code className="h-3.5 w-3.5 text-blue-600" />
                    <span>Decoder Function Definition (JavaScript)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetCode}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-red-600 transition cursor-pointer"
                    title="Kembalikan kode ke template bawaan awal"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Template</span>
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-900 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3 py-1.5 text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                      decode.js
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">
                      {canEditDecoder ? "ES6 Function (Writable)" : "Read Only"}
                    </span>
                  </div>
                  <textarea
                    rows={9}
                    readOnly={!canEditDecoder}
                    value={agentDraft.decoderCode || ""}
                    onChange={(e) =>
                      setAgentDraft({ ...agentDraft, decoderCode: e.target.value })
                    }
                    className={`w-full resize-y bg-transparent p-3 font-mono text-[11px] leading-relaxed text-emerald-300 outline-none selection:bg-blue-600 selection:text-white ${!canEditDecoder ? "cursor-not-allowed opacity-80" : ""}`}
                    placeholder="function decode(payload, context) { ... }"
                    spellCheck={false}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {canEditDecoder
                    ? "You can customize and edit the decode logic above to support custom sensor payloads."
                    : "You have read-only access to this decoder function. Contact a Superadmin to request modification rights."}
                </p>
              </div>

              {/* 3. Interactive Live Test Panel */}
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <Play className="h-3 w-3 text-emerald-600" />
                    <span>Live Test Decoder Function</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestDecoder}
                    disabled={testingDecoder}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    {testingDecoder ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Test Run</span>
                  </button>
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-semibold text-slate-500">
                    Sample Raw Payload Input
                  </span>
                  <input
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    className={`${inputClass} bg-white text-[11px] font-mono`}
                    placeholder="Paste sample raw frame string or sentence..."
                  />
                </div>

                {testResult && (
                  <div className={`rounded-lg p-2.5 text-[10px] font-mono border ${testResult.success ? "bg-emerald-50 text-emerald-900 border-emerald-200" : "bg-red-50 text-red-900 border-red-200"}`}>
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span>{testResult.success ? "✓ Execution Output (Return JSON):" : "✕ Execution Error:"}</span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap max-h-28 text-[10px]">
                      {testResult.success
                        ? JSON.stringify(testResult.output, null, 2)
                        : testResult.error}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              {editingAgentId && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: "Delete Gateway Agent",
                      message: "Are you sure you want to delete this gateway agent connection? Any incoming TCP stream on its port will be terminated.",
                      confirmLabel: "Delete Agent",
                      cancelLabel: "Cancel",
                      onConfirm: () => {
                        deleteAgent(editingAgentId)
                        setAgentModal(false)
                      },
                    })
                  }}
                  className="mr-auto inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setAgentModal(false)}
                className={buttonSecondary}
              >
                Cancel
              </button>
              <button className={buttonPrimary}>
                {editingAgentId ? "Save changes" : "Create agent"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Attribute Modal */}
      <Modal
        open={attrModal}
        onClose={() => setAttrModal(false)}
        title={editingAttr ? "Edit vessel attribute" : "Add vessel attribute"}
        description="Configure digital twin metric mapping and sensor telemetry source."
      >
        <form onSubmit={submitAttribute} className="p-5">
          {attrErrors.submit && (
            <div className="mb-4 rounded-lg bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
              {attrErrors.submit}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Namespace / Category
              </span>
              <select
                value={attrDraft.namespace}
                onChange={(e) =>
                  setAttrDraft({ ...attrDraft, namespace: e.target.value })
                }
                className={inputClass}
              >
                <option value="navigation">Navigation & Position</option>
                <option value="motion">Motion & Attitude</option>
                <option value="environment">Environment & Weather</option>
                <option value="engine">Propulsion & Engine</option>
                <option value="tanks">Tanks & Levels</option>
                <option value="electrical">Electrical & Power</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Variable Key Name
              </span>
              <input
                value={attrDraft.keyName}
                onChange={(e) =>
                  setAttrDraft({ ...attrDraft, keyName: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. coolant_temp"
              />
              {attrErrors.keyName && (
                <span className="mt-1 block text-[9px] text-red-600">
                  {attrErrors.keyName}
                </span>
              )}
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Display Label (UI)
              </span>
              <input
                value={attrDraft.displayName}
                onChange={(e) =>
                  setAttrDraft({ ...attrDraft, displayName: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. Main Engine Coolant Temp"
              />
              {attrErrors.displayName && (
                <span className="mt-1 block text-[9px] text-red-600">
                  {attrErrors.displayName}
                </span>
              )}
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Unit of Measurement
              </span>
              <input
                value={attrDraft.unit}
                onChange={(e) =>
                  setAttrDraft({ ...attrDraft, unit: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. °C, kn, m, RPM, %"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                Pointing Source (PGN / Sentence / Topic / Address)
              </span>
              <input
                value={attrDraft.pointingSource}
                onChange={(e) =>
                  setAttrDraft({ ...attrDraft, pointingSource: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. PGN 127489 #0, RS485 #1 Reg 40001, GPRMC"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAttrModal(false)}
              className={buttonSecondary}
            >
              Cancel
            </button>
            <button className={buttonPrimary}>
              {editingAttr ? "Save changes" : "Add attribute"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Scan Modal */}
      <Modal
        open={scanModal}
        onClose={() => setScanModal(false)}
        title="Scan Incoming Signals"
        description="Auto-detect active sensor PGNs and NMEA sentences streaming from connected agents."
        wide
      >
        <div className="p-5">
          {scanning ? (
            <div className="py-12 text-center">
              <RefreshCw className="mx-auto h-8 w-8 text-emerald-500 animate-spin" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">
                Scanning NMEA Bus & TCP Agents...
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Listening for live PGN frames and sentences on ports 20005 & 20006...
              </p>
            </div>
          ) : discoveredSignals.length > 0 ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between">
                <span>
                  Found <strong>{discoveredSignals.length}</strong> available unmapped sensor signals for this vessel.
                </span>
              </div>
              <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {discoveredSignals.map((sig, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {sig.displayName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {sig.namespace}.{sig.keyName}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {sig.pointingSource || sig.pgnSource}
                        </span>
                        <span>Default Unit: {sig.unit || "—"}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddDiscoveredSignal(sig)}
                      className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition active:scale-[0.98]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to Vessel</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Check className="mx-auto h-8 w-8 text-emerald-500" />
              <h3 className="mt-2 text-sm font-bold text-slate-800">
                All Known Signals are Already Registered!
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                All candidate sensor signals have already been added to this vessel's attribute registry.
              </p>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setScanModal(false)}
              className={buttonSecondary}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmModal
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
