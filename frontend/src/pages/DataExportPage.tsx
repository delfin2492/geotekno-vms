import { useState, useEffect, useMemo } from "react"
import {
  Download,
  Calendar,
  Layers,
  FileSpreadsheet,
  FileJson,
  FileText,
  Clock,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  Ship,
  SlidersHorizontal,
  ChevronDown,
  Database,
  History,
  Eye,
  Sparkles,
  Waves,
  Compass,
  Activity,
  Zap,
  FilterX,
  Radio,
  ExternalLink,
  Tag,
} from "lucide-react"
import { Link } from "react-router"
import { useFleet } from "@/state/FleetProvider"
import { api } from "@/services/api"
import { PageHeader, StatusBadge, buttonPrimary, buttonSecondary, inputClass } from "@/components/common/UI"
import * as XLSX from "xlsx"
import type { AssetAttribute, Vessel } from "@/domain/types"

export interface ExportAttribute {
  id: string
  label: string
  category: "Navigation" | "Environment" | "Engine" | "Diagnostics"
  unit?: string
  field: string
  pointingSource?: string
  format?: (val: any) => string
}

const BASE_TIMESTAMP_ATTRIBUTES: ExportAttribute[] = [
  { id: "ts_utc", label: "Timestamp (UTC)", category: "Navigation", field: "timestamp_utc" },
  { id: "ts_local", label: "Timestamp (Local)", category: "Navigation", field: "timestamp_local" },
]

function mapAssetAttributeToExport(attr: AssetAttribute): ExportAttribute[] {
  const ns = (attr.namespace || "").toLowerCase()
  const k = (attr.keyName || "").toLowerCase()
  const pgn = attr.pointingSource || attr.pgnSource || ""

  let category: "Navigation" | "Environment" | "Engine" | "Diagnostics" = "Navigation"
  if (ns === "environment") category = "Environment"
  else if (ns === "engine" || ns === "propulsion" || ns === "electrical") category = "Engine"
  else if (ns === "motion") category = "Navigation"
  else if (ns === "diagnostics") category = "Diagnostics"

  // Position special handling: coordinates gives both Latitude and Longitude
  if (k === "position" || k === "coordinates") {
    return [
      {
        id: `${attr.id}_lat`,
        label: `${attr.displayName || "Latitude"} (Lat)`,
        category: "Navigation",
        unit: "°",
        field: "latitude",
        pointingSource: pgn,
        format: (v) => (v !== null && v !== undefined ? Number(v).toFixed(6) : "—"),
      },
      {
        id: `${attr.id}_lng`,
        label: `${attr.displayName || "Longitude"} (Lng)`,
        category: "Navigation",
        unit: "°",
        field: "longitude",
        pointingSource: pgn,
        format: (v) => (v !== null && v !== undefined ? Number(v).toFixed(6) : "—"),
      },
    ]
  }

  let targetField = k
  let formatFn: ((v: any) => string) | undefined = undefined

  if (k === "sog") {
    targetField = "sog_knots"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "—")
  } else if (k === "cog") {
    targetField = "cog_deg"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "heading") {
    targetField = "heading_deg"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "depth") {
    targetField = "depth_m"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "—")
  } else if (k === "water_temp") {
    targetField = "water_temp_c"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "air_temp") {
    targetField = "air_temp_c"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "wind_speed") {
    targetField = "wind_speed_kn"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "wind_angle") {
    targetField = "wind_angle_deg"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "baro_pressure") {
    targetField = "baro_pressure_hpa"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "rpm") {
    targetField = "engine_rpm"
    formatFn = (v) => (v !== null && v !== undefined ? String(Math.round(v)) : "—")
  } else if (k === "pitch") {
    targetField = "pitch_deg"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "—")
  } else if (k === "roll") {
    targetField = "roll_deg"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "—")
  } else if (k === "rot" || k === "rate_of_turn") {
    targetField = "rot_deg_s"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "—")
  } else if (k === "altitude") {
    targetField = "altitude_m"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "hdop") {
    targetField = "hdop"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "—")
  } else if (k === "satellites") {
    targetField = "satellites"
    formatFn = (v) => (v !== null && v !== undefined ? String(v) : "—")
  } else if (k === "fuel" || k === "fuel_level") {
    targetField = "fuel_level"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "engine_load") {
    targetField = "engine_load"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(1) : "—")
  } else if (k === "battery_volts") {
    targetField = "battery_volts"
    formatFn = (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "—")
  }

  return [
    {
      id: `${attr.id}_${k}`,
      label: attr.displayName || `${attr.namespace}.${attr.keyName}`,
      category,
      unit: attr.unit || "",
      pointingSource: pgn,
      field: targetField,
      format: formatFn,
    },
  ]
}

type TimeRangePreset = "1h" | "6h" | "24h" | "7d" | "30d" | "custom"
type FileFormat = "csv" | "excel" | "json"
type SamplingInterval = "raw" | "10s" | "1m" | "5m" | "15m" | "1h"

interface ExportHistoryItem {
  id: string
  vesselName: string
  fileName: string
  format: FileFormat
  timestamp: string
  recordCount: number
  fileSizeBytes: number
  attributesCount: number
  blobUrl?: string
}

export function DataExportPage() {
  const { vessels } = useFleet()

  // Selection states
  const [selectedVesselId, setSelectedVesselId] = useState<string>(() => {
    return vessels[0]?.id || "all"
  })
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("24h")
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 16)
  })
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16)
  })
  const [samplingInterval, setSamplingInterval] = useState<SamplingInterval>("raw")
  const [fileFormat] = useState<FileFormat>("excel")

  // Dynamic vessel registered attributes
  const [registeredAttributes, setRegisteredAttributes] = useState<ExportAttribute[]>([])
  const [loadingAttributes, setLoadingAttributes] = useState<boolean>(true)
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<Set<string>>(new Set())

  // Data fetching & Preview states
  const [previewRecords, setPreviewRecords] = useState<any[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<"preview" | "history">("preview")
  const [searchFilter, setSearchFilter] = useState("")
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Export History (localStorage backed)
  const [history, setHistory] = useState<ExportHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem("nauticore:export_history")
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const saveHistory = (items: ExportHistoryItem[]) => {
    setHistory(items)
    try {
      localStorage.setItem("nauticore:export_history", JSON.stringify(items.slice(0, 20)))
    } catch {
      // ignore
    }
  }

  // Active vessel object
  const currentVessel = useMemo(() => {
    if (selectedVesselId === "all") return null
    return vessels.find((v) => v.id === selectedVesselId) || null
  }, [selectedVesselId, vessels])

  // Stable vessel IDs key to avoid re-triggering attribute fetches on real-time telemetry updates
  const fleetVesselIdsKey = useMemo(() => {
    return vessels.map((v) => v.id).sort().join(",")
  }, [vessels.length, vessels.map((v) => v.id).join(",")])

  // Fetch actual registered attributes for the selected vessel
  useEffect(() => {
    let isCancelled = false
    async function loadVesselAttributes() {
      // Only show full loading state if we have no attributes yet to prevent screen blinking
      setLoadingAttributes(true)
      try {
        let rawAttrs: AssetAttribute[] = []

        if (selectedVesselId === "all") {
          // If all vessels selected, aggregate attributes registered across fleet vessels
          const attrPromises = vessels.map((v) => api.getAttributes(v.id).catch(() => []))
          const results = await Promise.all(attrPromises)
          const seenKeys = new Set<string>()

          for (const list of results) {
            for (const item of list) {
              const signature = `${item.namespace}:${item.keyName}`
              if (!seenKeys.has(signature)) {
                seenKeys.add(signature)
                rawAttrs.push(item)
              }
            }
          }
        } else {
          rawAttrs = await api.getAttributes(selectedVesselId)
        }

        if (isCancelled) return

        // Map registered attributes to export attributes
        const dynamicAttrs: ExportAttribute[] = []
        for (const item of rawAttrs) {
          const mapped = mapAssetAttributeToExport(item)
          dynamicAttrs.push(...mapped)
        }

        const combined = [...BASE_TIMESTAMP_ATTRIBUTES, ...dynamicAttrs]
        setRegisteredAttributes(combined)

        // Select all attributes by default so user can immediately preview and export
        setSelectedAttributeIds(new Set(combined.map((a) => a.id)))
      } catch (err: any) {
        if (!isCancelled) {
          setNotification({
            type: "error",
            message: `Failed to load attributes for selected vessel: ${err.message}`,
          })
        }
      } finally {
        if (!isCancelled) {
          setLoadingAttributes(false)
        }
      }
    }

    loadVesselAttributes()
    return () => {
      isCancelled = true
    }
  }, [selectedVesselId, fleetVesselIdsKey])

  // Calculate actual time boundaries based on preset or custom
  const dateRange = useMemo(() => {
    const now = new Date()
    let fromDate: Date
    let toDate: Date = now

    if (timePreset === "custom") {
      fromDate = new Date(customStart)
      toDate = new Date(customEnd)
    } else if (timePreset === "1h") {
      fromDate = new Date(now.getTime() - 60 * 60 * 1000)
    } else if (timePreset === "6h") {
      fromDate = new Date(now.getTime() - 6 * 60 * 60 * 1000)
    } else if (timePreset === "24h") {
      fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    } else if (timePreset === "7d") {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else {
      // 30d
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      fromLabel: fromDate.toLocaleDateString() + " " + fromDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      toLabel: toDate.toLocaleDateString() + " " + toDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
  }, [timePreset, customStart, customEnd])

  // Fetch preview records
  const loadPreview = async () => {
    setLoadingPreview(true)
    setNotification(null)
    try {
      const resp = await api.getTelemetryHistory({
        assetId: selectedVesselId === "all" ? undefined : selectedVesselId,
        from: dateRange.from,
        to: dateRange.to,
        limit: 150,
      })
      setPreviewRecords(resp.records || [])
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to load telemetry preview",
      })
    } finally {
      setLoadingPreview(false)
    }
  }

  // Reload preview when vessel or time preset changes
  useEffect(() => {
    loadPreview()
  }, [selectedVesselId, timePreset])

  // Attribute toggle handlers
  const toggleAttribute = (id: string) => {
    setSelectedAttributeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAllAttributes = () => {
    setSelectedAttributeIds(new Set(registeredAttributes.map((a) => a.id)))
  }

  const clearAllAttributes = () => {
    // Keep timestamp essentials
    setSelectedAttributeIds(new Set(BASE_TIMESTAMP_ATTRIBUTES.map((a) => a.id)))
  }

  // Filtered attributes list based on user checkbox selection
  const activeAttributes = useMemo(() => {
    return registeredAttributes.filter((a) => selectedAttributeIds.has(a.id))
  }, [registeredAttributes, selectedAttributeIds])

  // Filtered preview rows by search input
  const filteredPreviewRows = useMemo(() => {
    if (!searchFilter.trim()) return previewRecords
    const q = searchFilter.toLowerCase()
    return previewRecords.filter((row) => {
      return Object.values(row).some((val) => String(val).toLowerCase().includes(q))
    })
  }, [previewRecords, searchFilter])

  // Downsample or aggregate records based on selected interval
  const processRecordsForExport = (records: any[]): any[] => {
    if (samplingInterval === "raw") return records

    const intervalMap: Record<SamplingInterval, number> = {
      raw: 0,
      "10s": 10000,
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "1h": 3600000,
    }
    const bucketMs = intervalMap[samplingInterval]
    if (!bucketMs) return records

    const buckets = new Map<number, any[]>()
    for (const row of records) {
      const ts = new Date(row.timestamp_utc || row.timestamp_local || Date.now()).getTime()
      const bucketKey = Math.floor(ts / bucketMs) * bucketMs
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, [])
      buckets.get(bucketKey)!.push(row)
    }

    const aggregated: any[] = []
    for (const [bucketTs, group] of buckets.entries()) {
      const first = group[0]
      const avgRow: Record<string, any> = { ...first }
      avgRow.timestamp_utc = new Date(bucketTs).toISOString()
      avgRow.timestamp_local = new Date(bucketTs).toLocaleString("sv-SE").replace("T", " ")

      for (const attr of registeredAttributes) {
        const val = group[0][attr.field]
        if (typeof val === "number") {
          const validNums = group.map((g) => Number(g[attr.field])).filter((n) => !isNaN(n) && n !== null)
          if (validNums.length > 0) {
            const sum = validNums.reduce((a, b) => a + b, 0)
            avgRow[attr.field] = Number((sum / validNums.length).toFixed(4))
          }
        }
      }
      aggregated.push(avgRow)
    }

    return aggregated.sort((a, b) => new Date(b.timestamp_utc).getTime() - new Date(a.timestamp_utc).getTime())
  }

  // Trigger export download
  const handleExport = async () => {
    setExporting(true)
    setNotification(null)

    try {
      const resp = await api.getTelemetryHistory({
        assetId: selectedVesselId === "all" ? undefined : selectedVesselId,
        from: dateRange.from,
        to: dateRange.to,
        limit: 2000,
      })

      const rawData = resp.records && resp.records.length > 0 ? resp.records : previewRecords
      const processedData = processRecordsForExport(rawData)

      if (processedData.length === 0) {
        throw new Error("No data records found for the selected vessel and time criteria.")
      }

      const vesselTag = selectedVesselId === "all" ? "Fleet_All" : (currentVessel?.name || "Vessel").replace(/\s+/g, "_")
      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "")
      const fileName = `export_${vesselTag}_${dateTag}_${Date.now().toString().slice(-4)}.xlsx`

      // Format data into structured columns for native Excel
      const worksheetData = processedData.map((row) => {
        const item: Record<string, any> = {}
        for (const attr of activeAttributes) {
          const colHeader = `${attr.label}${attr.unit ? ` (${attr.unit})` : ""}`
          const raw = row[attr.field]
          if (raw === null || raw === undefined) {
            item[colHeader] = ""
          } else if (typeof raw === "number") {
            item[colHeader] = raw
          } else {
            item[colHeader] = String(raw)
          }
        }
        return item
      })

      const worksheet = XLSX.utils.json_to_sheet(worksheetData)

      // Auto-fit column widths so text and numbers are properly visible
      const colWidths = activeAttributes.map((attr) => {
        const headerLen = `${attr.label}${attr.unit ? ` (${attr.unit})` : ""}`.length
        return { wch: Math.max(headerLen + 4, 16) }
      })
      worksheet["!cols"] = colWidths

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Telemetry Data")

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      const downloadUrl = URL.createObjectURL(blob)
      const downloadLink = document.createElement("a")
      downloadLink.href = downloadUrl
      downloadLink.download = fileName
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)

      const newHistoryItem: ExportHistoryItem = {
        id: "exp_" + Date.now(),
        vesselName: selectedVesselId === "all" ? "All Fleet Vessels" : (currentVessel?.name || "Vessel"),
        fileName: fileName,
        format: fileFormat,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        recordCount: processedData.length,
        fileSizeBytes: blob.size,
        attributesCount: activeAttributes.length,
        blobUrl: downloadUrl,
      }

      saveHistory([newHistoryItem, ...history])

      setNotification({
        type: "success",
        message: `Successfully exported ${fileName} (${processedData.length} rows, ${(blob.size / 1024).toFixed(1)} KB)`,
      })
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to generate export file",
      })
    } finally {
      setExporting(false)
    }
  }

  // Estimated file size calculation
  const estimatedSizeKb = useMemo(() => {
    const rowEstimate = previewRecords.length || 50
    const colEstimate = activeAttributes.length
    const bytesPerRow = colEstimate * 14
    return ((rowEstimate * bytesPerRow) / 1024).toFixed(1)
  }, [previewRecords.length, activeAttributes.length])

  return (
    <main className="mx-auto max-w-[1800px] p-4 sm:p-6 xl:p-8 space-y-6">
      {/* 1. HERO PAGE HEADER (NautiCore Theme) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#db4040]">
            <Download className="h-4 w-4" />
            <span>Telemetry & Attribute Archives • Fleet Analytics</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Data Export
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
            Extract, filter, preview, and download vessel telemetry parameters, sensor feeds, and navigation history in CSV or JSON format.
          </p>
        </div>

        {/* Global Action Header Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadPreview}
            disabled={loadingPreview}
            className={buttonSecondary}
            title="Refresh preview data"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loadingPreview ? "animate-spin text-[#db4040]" : ""}`} />
            <span>Refresh Preview</span>
          </button>

          <button
            onClick={handleExport}
            disabled={exporting || loadingPreview}
            className={buttonPrimary}
          >
            {exporting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Exporting Data...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Export File ({activeAttributes.length} Attributes)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alert Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl p-4 text-xs font-medium border shadow-sm transition ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-500 hover:text-slate-700 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. MAIN LAYOUT: LEFT CONFIG CARDS + RIGHT PREVIEW/HISTORY */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ======================================================== */}
        {/* LEFT COLUMN: PARAMETERS & ATTRIBUTES (Col Span 5 on LG)   */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Target Vessel & Time Filter */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-[#db4040]">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Export Parameters</h2>
                  <p className="text-[11px] text-slate-500">Configure vessel target and time scope</p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                Step 1 of 2
              </span>
            </div>

            {/* Target Vessel Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Ship className="h-3.5 w-3.5 text-[#db4040]" />
                Target Vessel
              </label>
              <div className="relative">
                <select
                  value={selectedVesselId}
                  onChange={(e) => setSelectedVesselId(e.target.value)}
                  className={inputClass}
                >
                  <option value="all">Fleet Aggregation (All Vessels)</option>
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.type || "Vessel"} • MMSI: {v.mmsi || "N/A"})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
              </div>

              {currentVessel && (
                <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{currentVessel.name}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">MMSI: {currentVessel.mmsi || "525015359"}</span>
                  </div>
                  <StatusBadge status={currentVessel.status || "Underway"} />
                </div>
              )}
            </div>

            {/* Time Period Filter */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#db4040]" />
                  Time Period
                </label>
                <span className="font-mono text-[10px] text-slate-500">
                  {dateRange.fromLabel} → {dateRange.toLabel}
                </span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {[
                  { key: "1h", label: "1 Hour" },
                  { key: "6h", label: "6 Hours" },
                  { key: "24h", label: "24 Hours" },
                  { key: "7d", label: "7 Days" },
                  { key: "30d", label: "30 Days" },
                  { key: "custom", label: "Custom" },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setTimePreset(preset.key as TimeRangePreset)}
                    className={`rounded-xl py-2 text-xs font-bold transition active:scale-[0.98] ${
                      timePreset === preset.key
                        ? "bg-[#db4040] text-white shadow-md shadow-red-500/25"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs */}
              {timePreset === "custom" && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">From Timestamp</span>
                    <input
                      type="datetime-local"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">To Timestamp</span>
                    <input
                      type="datetime-local"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sampling Interval & File Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  Sampling Interval
                </label>
                <div className="relative">
                  <select
                    value={samplingInterval}
                    onChange={(e) => setSamplingInterval(e.target.value as SamplingInterval)}
                    className={inputClass}
                  >
                    <option value="raw">Raw (Full Frequency)</option>
                    <option value="10s">10 Seconds Avg</option>
                    <option value="1m">1 Minute Avg</option>
                    <option value="5m">5 Minutes Avg</option>
                    <option value="15m">15 Minutes Avg</option>
                    <option value="1h">1 Hour Avg</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  Export Format
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold border-2 border-emerald-600 bg-emerald-50/70 text-emerald-800 shadow-2xs select-none">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span>Microsoft Excel (.xlsx)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Registered Telemetry Attributes for Selected Vessel */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-[#db4040]">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Telemetry Attributes</h2>
                  <p className="text-[11px] text-slate-500">
                    {selectedVesselId === "all"
                      ? "Attributes registered across fleet vessels"
                      : `Registered attributes for ${currentVessel?.name || "selected vessel"}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllAttributes}
                  className="text-xs font-bold text-[#db4040] hover:text-[#b92b2b]"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={clearAllAttributes}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Vessel Context Header & Attributes Count */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                {activeAttributes.length} of {registeredAttributes.length} attributes selected
              </span>
              <div className="flex items-center gap-1.5 text-slate-500">
                <Link
                  to="/vessels"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#db4040] hover:underline"
                  title="Configure attributes in Vessel Assets"
                >
                  Manage in Vessel Assets
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Categorized Attributes Checklist */}
            {loadingAttributes ? (
              <div className="flex h-44 flex-col items-center justify-center gap-2 text-slate-400">
                <RefreshCw className="h-5 w-5 animate-spin text-[#db4040]" />
                <p className="text-xs font-medium">Loading registered vessel attributes...</p>
              </div>
            ) : registeredAttributes.length <= 2 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                <AlertCircle className="h-6 w-6 text-slate-400" />
                <p className="text-xs font-bold text-slate-700">No additional attributes registered</p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  This vessel currently only has basic timestamps. You can register NMEA PGNs, sensors, and telemetry signals in Vessel Assets.
                </p>
                <Link
                  to="/vessels"
                  className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[#db4040] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#b92b2b] transition"
                >
                  Configure Vessel Attributes →
                </Link>
              </div>
            ) : (
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {(["Navigation", "Environment", "Engine", "Diagnostics"] as const).map((cat) => {
                  const catAttrs = registeredAttributes.filter((a) => a.category === cat)
                  if (catAttrs.length === 0) return null

                  const selectedInCat = catAttrs.filter((a) => selectedAttributeIds.has(a.id)).length

                  return (
                    <div key={cat} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">
                        <span>{cat}</span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {selectedInCat} / {catAttrs.length} selected
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {catAttrs.map((attr) => {
                          const isChecked = selectedAttributeIds.has(attr.id)
                          return (
                            <button
                              key={attr.id}
                              type="button"
                              onClick={() => toggleAttribute(attr.id)}
                              className={`flex items-center justify-between rounded-xl p-2.5 text-left transition border ${
                                isChecked
                                  ? "border-red-200 bg-red-50/50 text-slate-900 font-medium shadow-xs"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-1">
                                {isChecked ? (
                                  <CheckSquare className="h-4 w-4 text-[#db4040] shrink-0" />
                                ) : (
                                  <Square className="h-4 w-4 text-slate-300 shrink-0" />
                                )}
                                <div className="truncate">
                                  <span className="text-xs truncate block">{attr.label}</span>
                                  {attr.pointingSource && (
                                    <span className="text-[9px] text-slate-400 font-mono block truncate">
                                      {attr.pointingSource}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {attr.unit && (
                                <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600 border border-slate-200/60">
                                  {attr.unit}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: PREVIEW TABLE & EXPORT HISTORY (Col Span 7) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col h-full min-h-[580px]">
            {/* Tabs Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 pt-3.5">
              <div className="flex items-center gap-8">
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-2 pb-3.5 text-xs font-bold border-b-2 transition ${
                    activeTab === "preview"
                      ? "border-[#db4040] text-[#db4040]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span>Live Data Preview</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                    {previewRecords.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`flex items-center gap-2 pb-3.5 text-xs font-bold border-b-2 transition ${
                    activeTab === "history"
                      ? "border-[#db4040] text-[#db4040]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>Export History</span>
                  {history.length > 0 && (
                    <span className="rounded-full bg-red-50 text-[#db4040] px-2 py-0.5 text-[10px] font-bold border border-red-100">
                      {history.length}
                    </span>
                  )}
                </button>
              </div>

              {activeTab === "preview" && (
                <div className="relative pb-2.5">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search preview rows..."
                    className="w-48 sm:w-60 rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none transition focus:bg-white focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                  />
                </div>
              )}
            </div>

            {/* Tab 1 Content: Live Preview Table */}
            {activeTab === "preview" && (
              <div className="flex-1 flex flex-col p-5">
                {/* Meta Summary Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-slate-50 border border-slate-200/80 p-3 mb-3.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[#db4040]" />
                    <span>
                      Vessel: <strong className="text-slate-900">{selectedVesselId === "all" ? "All Fleet Vessels" : (currentVessel?.name || "Vessel")}</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Interval: <strong className="text-slate-800 font-mono">{samplingInterval.toUpperCase()}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-slate-700 border border-slate-200 shadow-xs">
                      {activeAttributes.length} columns active
                    </span>
                  </div>
                </div>

                {/* Table Viewport */}
                <div className="flex-1 relative overflow-auto rounded-xl border border-slate-200 bg-white">
                  {loadingPreview ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
                      <RefreshCw className="h-7 w-7 animate-spin text-[#db4040]" />
                      <p className="text-xs font-medium">Fetching telemetry records from database...</p>
                    </div>
                  ) : filteredPreviewRows.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
                      <AlertCircle className="h-7 w-7 text-slate-400" />
                      <p className="text-xs font-semibold">No telemetry records match the current filters.</p>
                      <button
                        onClick={loadPreview}
                        className="text-xs text-[#db4040] hover:underline font-bold"
                      >
                        Refresh Preview
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-xs">
                        <tr>
                          <th className="py-3 px-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            #
                          </th>
                          {activeAttributes.map((attr) => (
                            <th
                              key={attr.id}
                              className="py-3 px-3.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap"
                            >
                              <div className="flex items-center gap-1">
                                <span>{attr.label}</span>
                                {attr.unit && (
                                  <span className="text-slate-400 font-mono font-normal">({attr.unit})</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPreviewRows.slice(0, 50).map((row, idx) => (
                          <tr key={row.id || idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3.5 text-[11px] font-mono text-slate-400">
                              {idx + 1}
                            </td>
                            {activeAttributes.map((attr) => {
                              const rawVal = row[attr.field]
                              const formatted = attr.format ? attr.format(rawVal) : (rawVal !== null && rawVal !== undefined ? String(rawVal) : "—")
                              return (
                                <td
                                  key={attr.id}
                                  className="py-2.5 px-3.5 whitespace-nowrap font-mono text-xs text-slate-900"
                                >
                                  {formatted}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Table Footer info */}
                <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
                  <span>
                    Previewing {Math.min(filteredPreviewRows.length, 50)} of {previewRecords.length} records
                  </span>
                  <span>Full export will compile all samples in time period</span>
                </div>
              </div>
            )}

            {/* Tab 2 Content: Export History */}
            {activeTab === "history" && (
              <div className="flex-1 p-6">
                {history.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center gap-2.5 text-slate-500">
                    <History className="h-8 w-8 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-700">No export logs recorded in this session yet.</p>
                    <p className="text-[11px] text-slate-400">
                      Downloaded files will be listed here for convenient re-downloading.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-700">Recent Exports ({history.length})</span>
                      <button
                        onClick={() => saveHistory([])}
                        className="text-xs font-semibold text-slate-400 hover:text-red-600 transition"
                      >
                        Clear History
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 hover:border-slate-300 hover:bg-slate-50 transition shadow-xs"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-xs">
                              {item.format === "json" ? (
                                <FileJson className="h-5 w-5 text-amber-600" />
                              ) : (
                                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-900">
                                  {item.fileName}
                                </span>
                                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] uppercase font-bold text-slate-700 shadow-2xs">
                                  {item.format}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                <span className="font-medium text-slate-700">{item.vesselName}</span>
                                <span>•</span>
                                <span>{item.recordCount} rows</span>
                                <span>•</span>
                                <span>{(item.fileSizeBytes / 1024).toFixed(1)} KB</span>
                                <span>•</span>
                                <span>{item.timestamp}</span>
                              </div>
                            </div>
                          </div>

                          {item.blobUrl && (
                            <a
                              href={item.blobUrl}
                              download={item.fileName}
                              className={buttonSecondary}
                            >
                              <Download className="h-3.5 w-3.5 text-slate-500" />
                              <span>Download</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
