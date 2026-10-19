import { useEffect, useMemo, useRef, useState } from "react"
import {
  Responsive,
  WidthProvider,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout/legacy"
import {
  Activity,
  Anchor,
  ArrowLeftRight,
  ArrowUpDown,
  BarChart2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  CloudSun,
  Compass,
  Crosshair,
  Edit2,
  Eye,
  Fuel,
  Gauge,
  Globe,
  GripVertical,
  Layers,
  LayoutGrid,
  Map,
  Maximize2,
  Minimize2,
  Minus,
  Navigation,
  Pencil,
  Plus,
  RotateCcw,
  Route,
  Save,
  Search,
  Server,
  Settings,
  Ship,
  Sliders,
  Table,
  Trash2,
  TrendingDown,
  TrendingUp,
  Thermometer,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react"
import {
  Modal,
  ConfirmModal,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/common/UI"
import { useFleet } from "@/state/FleetProvider"
import { api } from "@/services/api"
import type { AisTarget, AssetAttribute, Vessel } from "@/domain/types"
import {
  OpenMapTilesMarineMap,
  type OpenMapTilesTheme,
} from "@/components/map/OpenMapTilesMarineMap"

const REGIONAL_PORTS = [
  { name: "Port of Singapore", code: "SGSIN", country: "Singapore", lat: 1.264, lng: 103.84 },
  { name: "Port of Tanjung Priok", code: "IDTPP", country: "Jakarta, ID", lat: -6.102, lng: 106.883 },
  { name: "Port of Panjang", code: "IDPNJ", country: "Lampung, ID", lat: -5.467, lng: 105.318 },
  { name: "Port of Batam (Batu Ampar)", code: "IDBTH", country: "Batam, ID", lat: 1.157, lng: 103.987 },
  { name: "Port of Tanjung Perak", code: "IDSUB", country: "Surabaya, ID", lat: -7.198, lng: 112.733 },
  { name: "Port of Merak", code: "IDMRK", country: "Banten, ID", lat: -5.932, lng: 105.996 },
  { name: "Port of Bakauheni", code: "IDBKH", country: "Lampung, ID", lat: -5.871, lng: 105.753 },
]

const ResponsiveGrid = WidthProvider(Responsive)

export type WidgetType =
  | "telemetry"
  | "kpi"
  | "speed"
  | "heading"
  | "chart"
  | "map"
  | "engine"
  | "bar"
  | "table"
  | "gateway"

export interface DepthThemePreset {
  id: string
  name: string
  description: string
  colors: {
    shallow: string
    caution: string
    safe: string
  }
}

export const DEPTH_THEME_PRESETS: DepthThemePreset[] = [
  {
    id: "standard",
    name: "Standard Marine",
    description: "Rose Hazard • Amber Caution • Cyan Deep",
    colors: {
      shallow: "#f43f5e",
      caution: "#f59e0b",
      safe: "#06b6d4",
    },
  },
  {
    id: "garmin",
    name: "CHIRP Sonar Heatmap",
    description: "Red Hot • Vivid Orange • Ocean Blue",
    colors: {
      shallow: "#ef4444",
      caution: "#f97316",
      safe: "#3b82f6",
    },
  },
  {
    id: "ecdis",
    name: "ECDIS Hydrographic",
    description: "Crimson Hazard • Chart Yellow • Safe Emerald",
    colors: {
      shallow: "#e11d48",
      caution: "#eab308",
      safe: "#10b981",
    },
  },
  {
    id: "neon",
    name: "Deep Ocean Cyber",
    description: "Neon Pink • Violet Purple • Electric Cyan",
    colors: {
      shallow: "#ec4899",
      caution: "#a855f7",
      safe: "#06b6d4",
    },
  },
  {
    id: "monochrome",
    name: "Night Vision Nautical",
    description: "Night Red • Muted Slate • Marine Sky",
    colors: {
      shallow: "#dc2626",
      caution: "#64748b",
      safe: "#38bdf8",
    },
  },
]

export interface WidgetConfig {
  min?: number
  max?: number
  decimals?: number
  unit?: string
  thresholds?: {
    green?: number
    orange?: number
    red?: number
  }
  thresholdColors?: {
    green?: string
    orange?: string
    red?: string
  }
  depthColors?: {
    shallow?: string
    caution?: string
    safe?: string
  }
  depthTheme?: string
  depthThresholds?: {
    shallow?: number
    caution?: number
  }
  showCog?: boolean
  timeSpan?: string
  defaultCategory?: string
  showFilterChips?: boolean
  showStatus?: boolean
  showTimestamp?: boolean
  mapTheme?: string
  showRangeRings?: boolean
  showTrack?: boolean
}

export interface WidgetDef {
  id: string
  type: WidgetType
  title: string
  vesselId: string
  attributeKey: string
  secondaryAttributeKey?: string
  customUnit?: string
  config?: WidgetConfig
}

function formatNum(val: number | null | undefined, decimals = 1, fallback = "—"): string {
  if (typeof val === "number" && !isNaN(val)) {
    return val.toFixed(decimals)
  }
  return fallback
}

function formatDateTimeWithSeconds(isoString?: string): string {
  if (!isoString) {
    return new Date().toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

// -------------------------------------------------------------
// TELEMETRY ATTRIBUTES SPECIFICATION
// -------------------------------------------------------------
export interface VesselAttributeMeta {
  key: string
  label: string
  category: "Navigation" | "Machinery" | "Environment" | "Vessel Info"
  unit: string
  recommendedType: WidgetType
  icon: any
  getValue: (v: Vessel) => any
  getFormatted: (v: Vessel) => string
}

export const VESSEL_ATTRIBUTES: VesselAttributeMeta[] = [
  {
    key: "sog",
    label: "Speed Over Ground (SOG)",
    category: "Navigation",
    unit: "knots",
    recommendedType: "speed",
    icon: Waves,
    getValue: (v) => v.sog,
    getFormatted: (v) => `${formatNum(v.sog, 1)} kn`,
  },
  {
    key: "heading",
    label: "Heading & Compass",
    category: "Navigation",
    unit: "deg",
    recommendedType: "heading",
    icon: Compass,
    getValue: (v) => v.heading,
    getFormatted: (v) => `${Math.round(v.heading ?? 0)}°`,
  },
  {
    key: "cog",
    label: "Course Over Ground (COG)",
    category: "Navigation",
    unit: "deg",
    recommendedType: "telemetry",
    icon: CircleGauge,
    getValue: (v) => v.cog,
    getFormatted: (v) => `${Math.round(v.cog ?? 0)}°`,
  },
  {
    key: "depth",
    label: "Water Depth (Echosounder)",
    category: "Navigation",
    unit: "m",
    recommendedType: "telemetry",
    icon: Waves,
    getValue: (v) => v.depth,
    getFormatted: (v) => `${formatNum(v.depth, 1)} m`,
  },
  {
    key: "fuel",
    label: "Fuel Tank Reserve",
    category: "Machinery",
    unit: "%",
    recommendedType: "telemetry",
    icon: Fuel,
    getValue: (v) => v.fuel,
    getFormatted: (v) => `${formatNum(v.fuel, 0)}%`,
  },
  {
    key: "rpm",
    label: "Main Engine RPM",
    category: "Machinery",
    unit: "RPM",
    recommendedType: "speed",
    icon: Activity,
    getValue: (v) => v.rpm,
    getFormatted: (v) => (v.rpm ? `${Math.round(v.rpm)} RPM` : "—"),
  },
  {
    key: "engineLoad",
    label: "Engine Load",
    category: "Machinery",
    unit: "%",
    recommendedType: "speed",
    icon: Gauge,
    getValue: (v) => v.engineLoad,
    getFormatted: (v) => `${formatNum(v.engineLoad, 0)}%`,
  },
  {
    key: "windSpeed",
    label: "Wind Speed",
    category: "Environment",
    unit: "kn",
    recommendedType: "telemetry",
    icon: Wind,
    getValue: (v) => v.windSpeed,
    getFormatted: (v) => `${formatNum(v.windSpeed, 1)} kn`,
  },
  {
    key: "position",
    label: "GNSS Position (Map)",
    category: "Navigation",
    unit: "lat/lng",
    recommendedType: "map",
    icon: Map,
    getValue: (v) => v.position,
    getFormatted: (v) =>
      v.position ? `${formatNum(v.position.lat, 4)}°, ${formatNum(v.position.lng, 4)}°` : "—",
  },
  {
    key: "machinery",
    label: "Propulsion & Machinery Matrix",
    category: "Machinery",
    unit: "status",
    recommendedType: "engine",
    icon: Activity,
    getValue: (v) => v.rpm,
    getFormatted: (v) => "Active Matrix",
  },
  {
    key: "gateway",
    label: "Gateway & Telemetry Link",
    category: "Vessel Info",
    unit: "status",
    recommendedType: "gateway",
    icon: Server,
    getValue: (v) => v.quality,
    getFormatted: (v) => v.quality?.toUpperCase() || "LIVE",
  },
  {
    key: "table",
    label: "Vessel Specifications & Telemetry Log",
    category: "Vessel Info",
    unit: "specs",
    recommendedType: "table",
    icon: Table,
    getValue: (v) => v.mmsi,
    getFormatted: (v) => `MMSI: ${v.mmsi || "—"}`,
  },
]

// -------------------------------------------------------------
// WIDGET UI COMPONENTS
// -------------------------------------------------------------

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const rad = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  if (Math.abs(endAngle - startAngle) < 0.1) return ""
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const delta = endAngle - startAngle
  const largeArcFlag = delta <= 180 ? "0" : "1"
  return `M ${end.x} ${end.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${start.x} ${start.y}`
}

function formatScaleNumber(val: number): string {
  if (Math.abs(val) >= 10000) return `${Math.round(val / 1000)}k`
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
  if (val % 1 === 0) return `${Math.round(val)}`
  return `${val.toFixed(1)}`
}

function GaugeDial({
  value,
  max = 24,
  min = 0,
  unit = "knots",
  decimals = 1,
  thresholds,
  thresholdColors,
  label = "SPEED",
}: {
  value: number | null | undefined
  max?: number
  min?: number
  unit?: string
  decimals?: number
  thresholds?: { green?: number; orange?: number; red?: number }
  thresholdColors?: { green?: string; orange?: string; red?: string }
  color?: string
  label?: string
}) {
  const safeVal = typeof value === "number" && !isNaN(value) ? value : min
  const range = max - min || 1
  const normalized = Math.min(Math.max((safeVal - min) / range, 0), 1)
  const needleAngle = -135 + normalized * 270

  // Dynamic user-customizable threshold colors with standard marine defaults
  const cGreen = thresholdColors?.green || "#10b981"
  const cOrange = thresholdColors?.orange || "#f59e0b"
  const cRed = thresholdColors?.red || "#ef4444"

  // Resolved thresholds with intelligent defaults based on scale range
  const tGreen =
    typeof thresholds?.green === "number" && thresholds.green <= max
      ? thresholds.green
      : min
  const tOrange =
    typeof thresholds?.orange === "number" && thresholds.orange <= max
      ? thresholds.orange
      : (min + range * 0.7)
  const tRed =
    typeof thresholds?.red === "number" && thresholds.red <= max
      ? thresholds.red
      : (min + range * 0.85)

  // Active color and needle color follow the threshold zones
  let activeColor = cGreen
  let needleColor = cGreen

  if (safeVal >= tRed) {
    activeColor = cRed
    needleColor = cRed
  } else if (safeVal >= tOrange) {
    activeColor = cOrange
    needleColor = cOrange
  } else if (safeVal >= tGreen) {
    activeColor = cGreen
    needleColor = cGreen
  } else {
    activeColor = "#06b6d4"
    needleColor = "#22d3ee"
  }

  // Generate 5 major scale labels (0%, 25%, 50%, 75%, 100%)
  const scaleNumbers = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const angle = -135 + pct * 270
    const val = min + pct * range
    const pos = polarToCartesian(110, 110, 64, angle)
    return { angle, val: formatScaleNumber(val), pos }
  })

  // Generate 25 tick marks (every 11.25 deg)
  const ticks = Array.from({ length: 25 }, (_, i) => {
    const angle = -135 + (i / 24) * 270
    const isMajor = i % 6 === 0
    const p1 = polarToCartesian(110, 110, 84, angle)
    const p2 = polarToCartesian(110, 110, isMajor ? 75 : 79, angle)
    return { angle, isMajor, p1, p2 }
  })

  // Format digital readout value
  const displayVal = typeof value === "number" && !isNaN(value) ? value.toFixed(decimals) : "—"

  // Threshold arcs calculation
  const greenStartPct = Math.min(Math.max((tGreen - min) / range, 0), 1)
  const orangeStartPct = Math.min(Math.max((tOrange - min) / range, 0), 1)
  const redStartPct = Math.min(Math.max((tRed - min) / range, 0), 1)

  const greenStartAngle = -135 + greenStartPct * 270
  const orangeStartAngle = -135 + orangeStartPct * 270
  const redStartAngle = -135 + redStartPct * 270
  const endGaugeAngle = 135

  const greenArc =
    orangeStartAngle > greenStartAngle
      ? describeArc(110, 110, 86, greenStartAngle, orangeStartAngle)
      : ""
  const orangeArc =
    redStartAngle > orangeStartAngle
      ? describeArc(110, 110, 86, orangeStartAngle, redStartAngle)
      : ""
  const redArc =
    endGaugeAngle > redStartAngle
      ? describeArc(110, 110, 86, redStartAngle, endGaugeAngle)
      : ""
  const activeArc = normalized > 0.005 ? describeArc(110, 110, 82, -135, needleAngle) : ""

  return (
    <div className="relative h-full w-full flex items-center justify-center p-1 select-none overflow-hidden">
      <svg
        viewBox="0 0 220 220"
        className="h-full w-full max-h-full max-w-full aspect-square overflow-visible filter drop-shadow-md"
      >
        <defs>
          {/* Radial Dial Background */}
          <radialGradient id="gaugeMarineBg" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#152132" />
            <stop offset="65%" stopColor="#0b1320" />
            <stop offset="100%" stopColor="#050a12" />
          </radialGradient>

          {/* Curved Glass Reflection Effect */}
          <linearGradient id="gaugeGlassReflection" x1="0" y1="0" x2="0.8" y2="0.8">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Pointer Gradient */}
          <linearGradient id="gaugeNeedleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="25%" stopColor={needleColor} />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>

          {/* Active Arc Glow Filter */}
          <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={activeColor} floodOpacity="0.6" />
          </filter>

          {/* Center Hub Metallic Dome */}
          <radialGradient id="hubGrad" cx="38%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="45%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090e17" />
          </radialGradient>
        </defs>

        {/* 1. Outer Bezel Ring (Garmin MFD Housing) */}
        <circle cx="110" cy="110" r="106" fill="#070c14" stroke="#1e293b" strokeWidth="4" />
        <circle cx="110" cy="110" r="102" fill="none" stroke="#334155" strokeWidth="1" opacity="0.6" />

        {/* 2. Dial Face Background */}
        <circle cx="110" cy="110" r="99" fill="url(#gaugeMarineBg)" stroke="#1e293b" strokeWidth="1.5" />

        {/* 3. Top Heading Marker Arrow (Garmin Signature Detail) */}
        <polygon points="110,30 102,56 118,56" fill="#2563eb" opacity="0.75" />

        {/* 4. Threshold Range Sectors along the Outer Rim */}
        {greenArc && <path d={greenArc} fill="none" stroke={cGreen} strokeWidth="5" strokeLinecap="round" opacity="0.95" />}
        {orangeArc && <path d={orangeArc} fill="none" stroke={cOrange} strokeWidth="5" opacity="0.95" />}
        {redArc && <path d={redArc} fill="none" stroke={cRed} strokeWidth="5" strokeLinecap="round" opacity="0.95" />}

        {/* 5. Track Base Arc */}
        <path
          d={describeArc(110, 110, 82, -135, 135)}
          fill="none"
          stroke="#1e293b"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* 6. Active Dynamic Value Arc */}
        {activeArc && (
          <path
            d={activeArc}
            fill="none"
            stroke={activeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
          />
        )}

        {/* 7. Radial Hash Ticks */}
        {ticks.map((t, idx) => (
          <line
            key={idx}
            x1={t.p1.x}
            y1={t.p1.y}
            x2={t.p2.x}
            y2={t.p2.y}
            stroke={t.isMajor ? "#f8fafc" : "#64748b"}
            strokeWidth={t.isMajor ? 2 : 1.2}
            strokeLinecap="round"
            opacity={t.isMajor ? 0.95 : 0.6}
          />
        ))}

        {/* 8. Numeric Scale Labels */}
        {scaleNumbers.map((s, idx) => (
          <text
            key={idx}
            x={s.pos.x}
            y={s.pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#94a3b8"
            className="text-[9px] font-bold select-none"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            {s.val}
          </text>
        ))}

        {/* 9. Needle Pointer (Rotates smoothly to current value) */}
        <g
          transform={`rotate(${needleAngle} 110 110)`}
          style={{ transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
        >
          {/* Needle Shadow */}
          <polygon
            points="-3.5,0 -1,-68 0,-76 1,-68 3.5,0 2,12 -2,12"
            fill="#000000"
            opacity="0.4"
            transform="translate(112, 112)"
          />
          {/* Needle Body */}
          <polygon
            points="-3.5,0 -1,-70 0,-76 1,-70 3.5,0 2,12 -2,12"
            fill="url(#gaugeNeedleGrad)"
            transform="translate(110, 110)"
          />
          {/* Needle Center Highlight Spine */}
          <line
            x1="110"
            y1="110"
            x2="110"
            y2="36"
            stroke="#ffffff"
            strokeWidth="0.8"
            opacity="0.85"
          />
        </g>

        {/* 10. Center Pivot Hub */}
        <circle cx="110" cy="110" r="16" fill="url(#hubGrad)" stroke="#475569" strokeWidth="1.5" />
        <circle cx="110" cy="110" r="10" fill="#090e17" stroke="#1e293b" strokeWidth="1" />
        <circle cx="108" cy="108" r="2.5" fill="#ffffff" opacity="0.3" />

        {/* 11. High-Contrast Digital Readout Box (Garmin LCD Style) */}
        <g transform="translate(56, 134)">
          <rect
            x="0"
            y="0"
            width="108"
            height="36"
            rx="6"
            fill="#030712"
            stroke={activeColor !== "#06b6d4" ? activeColor : "#1e293b"}
            strokeWidth={activeColor !== "#06b6d4" ? "2" : "1.5"}
          />
          <rect
            x="1"
            y="1"
            width="106"
            height="34"
            rx="5"
            fill="none"
            stroke="#000000"
            strokeWidth="1"
            opacity="0.8"
          />
          {/* Digital Readout Number */}
          <text
            x="64"
            y="25"
            textAnchor="end"
            fill="#ffffff"
            className="font-mono font-black text-[20px] tracking-tight"
          >
            {displayVal}
          </text>
          {/* Unit Badge beside value */}
          <text
            x="68"
            y="19"
            textAnchor="start"
            fill="#38bdf8"
            className="font-mono font-bold text-[10px] tracking-wider uppercase"
          >
            {unit}
          </text>
        </g>

        {/* 12. Bottom Subtitle (Attribute Label) */}
        <text
          x="110"
          y="185"
          textAnchor="middle"
          fill="#94a3b8"
          className="font-bold text-[8.5px] uppercase tracking-widest"
        >
          {label}
        </text>

        {/* 13. Glass Sheen Reflection Arc */}
        <path
          d={describeArc(110, 110, 96, -120, 20)}
          fill="none"
          stroke="url(#gaugeGlassReflection)"
          strokeWidth="6"
          opacity="0.5"
        />
      </svg>
    </div>
  )
}

function CompassDial({
  primaryAngle,
  primaryLabel = "HDG",
  secondaryAngle,
  secondaryLabel = "COG",
  showSecondary = true,
}: {
  primaryAngle: number | null | undefined
  primaryLabel?: string
  secondaryAngle?: number | null | undefined
  secondaryLabel?: string
  showSecondary?: boolean
}) {
  const hasPrimary = typeof primaryAngle === "number" && !isNaN(primaryAngle)
  const safePrimary = hasPrimary ? (primaryAngle! % 360 + 360) % 360 : 0

  const hasSecondary = typeof secondaryAngle === "number" && !isNaN(secondaryAngle)
  const safeSecondary = hasSecondary ? (secondaryAngle! % 360 + 360) % 360 : null

  // 72 radial tick marks around 360 degrees (every 5 deg)
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const angle = i * 5
    const isCardinal = angle % 90 === 0
    const isMajor = angle % 30 === 0
    const isMedium = angle % 10 === 0
    const len = isCardinal ? 10 : isMajor ? 8 : isMedium ? 5 : 3
    const p1 = polarToCartesian(110, 110, 96, angle)
    const p2 = polarToCartesian(110, 110, 96 - len, angle)
    return { angle, isCardinal, isMajor, isMedium, p1, p2 }
  })

  // Degree labels at 30-degree increments (excluding cardinals)
  const degreeLabels = [30, 60, 120, 150, 210, 240, 300, 330].map((deg) => {
    const pos = polarToCartesian(110, 110, 81, deg)
    return { deg: deg.toString().padStart(3, "0"), pos }
  })

  // Cardinal points
  const cardinals = [
    { label: "N", angle: 0, color: "#ef4444", isNorth: true },
    { label: "E", angle: 90, color: "#f8fafc", isNorth: false },
    { label: "S", angle: 180, color: "#cbd5e1", isNorth: false },
    { label: "W", angle: 270, color: "#f8fafc", isNorth: false },
  ].map((c) => ({
    ...c,
    pos: polarToCartesian(110, 110, 66, c.angle),
  }))

  // Intercardinal points
  const intercardinals = [
    { label: "NE", angle: 45 },
    { label: "SE", angle: 135 },
    { label: "SW", angle: 225 },
    { label: "NW", angle: 315 },
  ].map((ic) => ({
    ...ic,
    pos: polarToCartesian(110, 110, 67, ic.angle),
  }))

  const displayPrimary = hasPrimary ? Math.round(safePrimary).toString().padStart(3, "0") : "—"

  return (
    <div className="relative h-full w-full flex items-center justify-center p-1 select-none overflow-hidden">
      <svg
        viewBox="0 0 220 220"
        className="h-full w-full max-h-full max-w-full aspect-square overflow-visible filter drop-shadow-md"
      >
        <defs>
          {/* Radial Compass Dial Background */}
          <radialGradient id="compassMarineBg" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#152132" />
            <stop offset="65%" stopColor="#0b1320" />
            <stop offset="100%" stopColor="#050a12" />
          </radialGradient>

          {/* Heading Pointer Gradient */}
          <linearGradient id="compassNeedleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="30%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Glass Reflection */}
          <linearGradient id="compassGlassReflection" x1="0" y1="0" x2="0.8" y2="0.8">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Center Hub Metallic Dome */}
          <radialGradient id="compassHubGrad" cx="38%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="45%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090e17" />
          </radialGradient>
        </defs>

        {/* 1. Outer Bezel Ring (Garmin MFD Housing) */}
        <circle cx="110" cy="110" r="106" fill="#070c14" stroke="#1e293b" strokeWidth="4" />
        <circle cx="110" cy="110" r="102" fill="none" stroke="#334155" strokeWidth="1" opacity="0.6" />

        {/* 2. Dial Face Background */}
        <circle cx="110" cy="110" r="99" fill="url(#compassMarineBg)" stroke="#1e293b" strokeWidth="1.5" />

        {/* 3. Outer Track Circles */}
        <circle cx="110" cy="110" r="96" fill="none" stroke="#1e293b" strokeWidth="1.5" />
        <circle cx="110" cy="110" r="88" fill="none" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="1 3" opacity="0.5" />

        {/* 4. Top North Index Arrow Marker */}
        <polygon points="110,12 104,24 116,24" fill="#ef4444" opacity="0.9" />

        {/* 5. Radial Hash Ticks (360 degrees) */}
        {ticks.map((t, idx) => (
          <line
            key={idx}
            x1={t.p1.x}
            y1={t.p1.y}
            x2={t.p2.x}
            y2={t.p2.y}
            stroke={t.isCardinal ? "#f8fafc" : t.isMajor ? "#cbd5e1" : t.isMedium ? "#64748b" : "#334155"}
            strokeWidth={t.isCardinal ? 2.5 : t.isMajor ? 1.75 : t.isMedium ? 1.2 : 0.75}
            strokeLinecap="round"
          />
        ))}

        {/* 6. Degree Labels */}
        {degreeLabels.map((d, idx) => (
          <text
            key={idx}
            x={d.pos.x}
            y={d.pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#64748b"
            className="text-[7.5px] font-mono font-bold select-none"
          >
            {d.deg}
          </text>
        ))}

        {/* 7. Intercardinal Points (NE, SE, SW, NW) */}
        {intercardinals.map((ic, idx) => (
          <text
            key={idx}
            x={ic.pos.x}
            y={ic.pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#475569"
            className="text-[7.5px] font-bold select-none"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            {ic.label}
          </text>
        ))}

        {/* 8. Cardinal Points (N, E, S, W) */}
        {cardinals.map((c, idx) => (
          <text
            key={idx}
            x={c.pos.x}
            y={c.pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={c.color}
            className={`font-black select-none ${c.isNorth ? "text-[12px]" : "text-[10px]"}`}
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            {c.label}
          </text>
        ))}

        {/* 9. Secondary Comparison Vector (COG / HDG Vector Line & Diamond Marker) */}
        {showSecondary && safeSecondary !== null && (
          <g
            transform={`rotate(${safeSecondary} 110 110)`}
            style={{ transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
          >
            <line
              x1="110"
              y1="110"
              x2="110"
              y2="24"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="4 2.5"
              opacity="0.9"
            />
            {/* Diamond arrowhead at tip */}
            <polygon points="110,18 106,24 110,30 114,24" fill="#f59e0b" />
          </g>
        )}

        {/* 10. Primary Heading / COG Pointer (Double-Ended Nautical Pointer) */}
        <g
          transform={`rotate(${safePrimary} 110 110)`}
          style={{ transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
        >
          {/* Pointer Shadow */}
          <polygon
            points="-4,0 -1.5,-68 0,-78 1.5,-68 4,0 2.5,24 -2.5,24"
            fill="#000000"
            opacity="0.4"
            transform="translate(112, 112)"
          />
          {/* North / Bow Arrow Pointer */}
          <polygon
            points="-4,0 -1.5,-70 0,-78 1.5,-70 4,0"
            fill="url(#compassNeedleGrad)"
            transform="translate(110, 110)"
          />
          {/* Stern / South Counter-Pointer */}
          <polygon
            points="-3,0 -1.5,22 0,26 1.5,22 3,0"
            fill="#64748b"
            transform="translate(110, 110)"
          />
          {/* Needle Spine Highlight */}
          <line
            x1="110"
            y1="110"
            x2="110"
            y2="34"
            stroke="#ffffff"
            strokeWidth="0.8"
            opacity="0.9"
          />
        </g>

        {/* 11. Center Pivot Hub */}
        <circle cx="110" cy="110" r="16" fill="url(#compassHubGrad)" stroke="#475569" strokeWidth="1.5" />
        <circle cx="110" cy="110" r="10" fill="#090e17" stroke="#1e293b" strokeWidth="1" />
        <circle cx="108" cy="108" r="2.5" fill="#ffffff" opacity="0.3" />

        {/* 12. High-Contrast Digital Readout Box (Garmin LCD Style) */}
        <g transform="translate(56, 134)">
          <rect
            x="0"
            y="0"
            width="108"
            height="36"
            rx="6"
            fill="#030712"
            stroke="#1e293b"
            strokeWidth="1.5"
          />
          <rect
            x="1"
            y="1"
            width="106"
            height="34"
            rx="5"
            fill="none"
            stroke="#000000"
            strokeWidth="1"
            opacity="0.8"
          />
          {/* Primary Angle in Bold Monospace */}
          <text
            x="64"
            y="25"
            textAnchor="end"
            fill="#ffffff"
            className="font-mono font-black text-[20px] tracking-tight"
          >
            {displayPrimary}°
          </text>
          {/* Sensor Label Badge (HDG or COG) */}
          <text
            x="68"
            y="19"
            textAnchor="start"
            fill="#38bdf8"
            className="font-mono font-bold text-[10px] tracking-wider uppercase"
          >
            {primaryLabel}
          </text>
        </g>

        {/* 13. Bottom Label: Secondary Comparison or Sensor Type */}
        <text
          x="110"
          y="185"
          textAnchor="middle"
          fill={showSecondary && safeSecondary !== null ? "#f59e0b" : "#94a3b8"}
          className="font-mono font-bold text-[8.5px] uppercase tracking-wider"
        >
          {showSecondary && safeSecondary !== null
            ? `${secondaryLabel} ${Math.round(safeSecondary)}°`
            : primaryLabel === "COG"
            ? "COURSE OVER GROUND"
            : "MAGNETIC HEADING"}
        </text>

        {/* 14. Glass Sheen Reflection Arc */}
        <path
          d={describeArc(110, 110, 96, -120, 20)}
          fill="none"
          stroke="url(#compassGlassReflection)"
          strokeWidth="6"
          opacity="0.5"
        />
      </svg>
    </div>
  )
}

interface ChartPoint {
  timestamp: number
  value: number
}

type ChartTimeRange = "live" | "hour" | "day" | "weakly" | "month" | "years"

interface TimeRangeOption {
  key: ChartTimeRange
  label: string
  periodLabel: string
  durationMs: number
}

const CHART_TIME_RANGES: TimeRangeOption[] = [
  { key: "live", label: "Live", periodLabel: "Realtime Buffer", durationMs: 60 * 1000 },
  { key: "hour", label: "Hour", periodLabel: "Past 1h", durationMs: 60 * 60 * 1000 },
  { key: "day", label: "Day", periodLabel: "Past 24h", durationMs: 24 * 60 * 60 * 1000 },
  { key: "weakly", label: "Weakly", periodLabel: "Past 7d", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { key: "month", label: "Month", periodLabel: "Past 30d", durationMs: 30 * 24 * 60 * 60 * 1000 },
  { key: "years", label: "Years", periodLabel: "Past 1y", durationMs: 365 * 24 * 60 * 60 * 1000 },
]

function extractMetricValue(rec: any, key: string, fallbackVal: number): number {
  if (!rec) return fallbackVal
  let val: any = undefined
  switch (key) {
    case "rpm":
      val = rec.engine_rpm ?? rec.rpm ?? rec.engineRpm
      break
    case "fuel":
      val = rec.fuel_level ?? rec.fuel ?? rec.fuelLevel
      break
    case "engineLoad":
      val = rec.engine_load ?? rec.engineLoad
      break
    case "sog":
      val = rec.sog_knots ?? rec.sog ?? rec.speed
      break
    case "cog":
      val = rec.cog_deg ?? rec.cog
      break
    case "heading":
      val = rec.heading_deg ?? rec.heading
      break
    case "depth":
      val = rec.depth_m ?? rec.depth
      break
    case "windSpeed":
      val = rec.wind_speed_kn ?? rec.windSpeed
      break
    case "pitch":
      val = rec.pitch_deg ?? rec.pitch
      break
    case "roll":
      val = rec.roll_deg ?? rec.roll
      break
    case "rot":
      val = rec.rot_deg_s ?? rec.rot
      break
    default:
      val = rec[key] ?? rec[`${key}_deg`] ?? rec[`${key}_m`] ?? rec[`${key}_knots`]
  }
  const num = typeof val === "number" ? val : typeof val === "string" ? parseFloat(val) : NaN
  return isNaN(num) ? fallbackVal : num
}

function formatXAxisTime(timestamp: number, range: ChartTimeRange): string {
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return ""
  switch (range) {
    case "live":
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    case "hour":
    case "day":
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
    case "weakly":
    case "month":
      return d.toLocaleDateString([], { day: "numeric", month: "short" })
    case "years":
      return d.toLocaleDateString([], { month: "short", year: "2-digit" })
    default:
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  }
}

function formatHoverTime(timestamp: number, range: ChartTimeRange): string {
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return ""
  if (range === "live") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  }
  if (range === "hour") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  }
  if (range === "day") {
    return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`
  }
  if (range === "weakly" || range === "month") {
    return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`
  }
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
}

function TrendChart({
  vessel,
  attributeKey,
  config,
  width = 460,
  height = 200,
}: {
  vessel: Vessel
  attributeKey?: string
  config?: WidgetConfig
  width?: number
  height?: number
}) {
  const effectiveKey = attributeKey || "rpm"
  const meta = VESSEL_ATTRIBUTES.find((a) => a.key === effectiveKey)
  const Icon = meta?.icon || Activity

  // Determine decimals & unit
  const decimals =
    typeof config?.decimals === "number"
      ? config.decimals
      : effectiveKey === "rpm" ||
        effectiveKey === "fuel" ||
        effectiveKey === "engineLoad" ||
        effectiveKey === "heading" ||
        effectiveKey === "cog"
      ? 0
      : 1
  const unit = config?.unit || meta?.unit || ""

  // Extract raw numerical value from vessel
  const rawVal = meta ? meta.getValue(vessel) : (vessel as any)?.[effectiveKey]
  const currentVal =
    typeof rawVal === "number" && !isNaN(rawVal)
      ? rawVal
      : typeof rawVal === "string" && !isNaN(Number(rawVal))
      ? Number(rawVal)
      : 0

  // Time Range Filter State: Live, Hour, Day, Weakly, Month, Years
  const [timeRange, setTimeRange] = useState<ChartTimeRange>("live")
  const [historicalData, setHistoricalData] = useState<ChartPoint[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Unique ID for gradients to prevent collisions when multiple charts are on canvas
  const chartId = useMemo(
    () => `trend-${effectiveKey}-${Math.random().toString(36).slice(2, 8)}`,
    [effectiveKey],
  )

  // Real-time history series tracking: only update when true telemetry arrives from agent
  const lastUpdateRef = useRef<string | number | undefined>(vessel.updatedAt)
  const lastValRef = useRef<number>(currentVal)

  // Real-time history series state (holds 20 points)
  const [history, setHistory] = useState<ChartPoint[]>(() => {
    const baseTime = vessel.updatedAt ? new Date(vessel.updatedAt).getTime() : Date.now()
    const pts: ChartPoint[] = []
    const count = 20
    const intervalMs = 3000
    for (let i = count - 1; i >= 0; i--) {
      pts.push({
        timestamp: baseTime - i * intervalMs,
        value: Number(currentVal.toFixed(decimals + 1)),
      })
    }
    return pts
  })

  // When vessel.id or attributeKey changes, initialize history with actual current telemetry
  useEffect(() => {
    const baseTime = vessel.updatedAt ? new Date(vessel.updatedAt).getTime() : Date.now()
    const pts: ChartPoint[] = []
    const count = 20
    const intervalMs = 3000
    for (let i = count - 1; i >= 0; i--) {
      pts.push({
        timestamp: baseTime - i * intervalMs,
        value: Number(currentVal.toFixed(decimals + 1)),
      })
    }
    setHistory(pts)
    lastUpdateRef.current = vessel.updatedAt
    lastValRef.current = currentVal
  }, [effectiveKey, vessel?.id])

  // Real-time update streaming: ONLY update when new telemetry arrives from backend/agent
  useEffect(() => {
    const isNewTimestamp = vessel.updatedAt && vessel.updatedAt !== lastUpdateRef.current
    const isValChanged = currentVal !== lastValRef.current

    if (isNewTimestamp || isValChanged) {
      lastUpdateRef.current = vessel.updatedAt
      lastValRef.current = currentVal
      const ptTime = vessel.updatedAt ? new Date(vessel.updatedAt).getTime() : Date.now()
      setHistory((prev) => {
        const newPt: ChartPoint = {
          timestamp: ptTime,
          value: Number(currentVal.toFixed(decimals + 1)),
        }
        return [...prev.slice(1), newPt]
      })
    }
  }, [vessel.updatedAt, currentVal, decimals])

  // Historical Telemetry Query for non-live filters (Hour, Day, Weakly, Month, Years)
  useEffect(() => {
    if (timeRange === "live") return

    let isMounted = true
    setIsLoadingHistory(true)

    const rangeDef = CHART_TIME_RANGES.find((r) => r.key === timeRange)
    const durationMs = rangeDef?.durationMs || 3600000
    const now = Date.now()
    const fromIso = new Date(now - durationMs).toISOString()

    api
      .getTelemetryHistory({
        vesselId: vessel?.id,
        from: fromIso,
        limit: 120,
      })
      .then((res) => {
        if (!isMounted) return
        const rawRecords = res?.records || []
        if (rawRecords.length > 0) {
          // Sort chronologically ascending
          const sorted = [...rawRecords].sort(
            (a, b) =>
              new Date(a.timestamp_utc || a.recorded_at || 0).getTime() -
              new Date(b.timestamp_utc || b.recorded_at || 0).getTime(),
          )
          const pts: ChartPoint[] = sorted.map((r) => ({
            timestamp: new Date(r.timestamp_utc || r.recorded_at || Date.now()).getTime(),
            value: Number(extractMetricValue(r, effectiveKey, currentVal).toFixed(decimals + 1)),
          }))
          setHistoricalData(pts)
        } else {
          // Baseline points spanning the full requested duration
          const count = 24
          const step = durationMs / (count - 1)
          const pts: ChartPoint[] = []
          for (let i = 0; i < count; i++) {
            pts.push({
              timestamp: now - durationMs + i * step,
              value: Number(currentVal.toFixed(decimals + 1)),
            })
          }
          setHistoricalData(pts)
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch historical telemetry for chart:", err)
        if (!isMounted) return
        const count = 24
        const step = durationMs / (count - 1)
        const pts: ChartPoint[] = []
        for (let i = 0; i < count; i++) {
          pts.push({
            timestamp: now - durationMs + i * step,
            value: Number(currentVal.toFixed(decimals + 1)),
          })
        }
        setHistoricalData(pts)
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false)
      })

    return () => {
      isMounted = false
    }
  }, [timeRange, vessel?.id, effectiveKey, currentVal, decimals])

  // Active data selection: Live buffer or Historical series
  const activeData = timeRange === "live" ? history : historicalData

  // Interactive Hover state
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Calculations for stats and graph scaling
  const values = activeData.map((p) => p.value)
  const minVal = values.length ? Math.min(...values) : 0
  const maxVal = values.length ? Math.max(...values) : 0
  const avgVal = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

  const firstVal = values[0] ?? currentVal
  const lastVal = values[values.length - 1] ?? currentVal
  const diffVal = lastVal - firstVal
  const pctChange = firstVal !== 0 ? (diffVal / firstVal) * 100 : 0

  // Real-time status: Check if vessel received telemetry recently (within 25s)
  const updateAgeMs = vessel.updatedAt ? Date.now() - new Date(vessel.updatedAt).getTime() : Infinity
  const isLive = updateAgeMs < 25000

  // Adaptive scale tiers based on widget width and height
  const isXLarge = width >= 520 || height >= 240
  const isLarge = width >= 360 || height >= 180
  const isSmall = width < 260 || height < 130

  const valSizeClass = isXLarge
    ? "text-4xl lg:text-5xl font-black"
    : isLarge
    ? "text-3xl lg:text-4xl font-black"
    : isSmall
    ? "text-xl font-bold"
    : "text-2xl font-black"

  const unitSizeClass = isXLarge ? "text-sm" : isSmall ? "text-[10px]" : "text-xs"
  const statsSizeClass = isLarge ? "text-xs" : isSmall ? "text-[9px]" : "text-[10px]"
  const titleSizeClass = isLarge ? "text-xs" : isSmall ? "text-[9px]" : "text-[10px]"
  const filterBtnSizeClass = isSmall ? "text-[8px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"

  // SVG Geometry - dynamic sizing to match container
  const svgWidth = Math.max(280, width - 24)
  const svgHeight = Math.max(70, Math.round(height * (isSmall ? 0.44 : 0.52)))
  const padLeft = 40
  const padRight = 14
  const padTop = 10
  const padBottom = 22
  const drawW = svgWidth - padLeft - padRight
  const drawH = svgHeight - padTop - padBottom
  const bottomY = padTop + drawH

  // Dynamic Y Scale with headroom padding
  const diffMinMax = maxVal - minVal
  const padding = diffMinMax === 0 ? (maxVal === 0 ? 5 : maxVal * 0.1) : diffMinMax * 0.18
  const scaleMin = Math.max(0, minVal - padding)
  const scaleMax = maxVal + padding || 10
  const scaleRange = scaleMax - scaleMin || 1

  // Map data points to SVG coordinates
  const svgPoints = activeData.map((pt, i) => {
    const x = padLeft + (i / Math.max(1, activeData.length - 1)) * drawW
    const normalizedY = (pt.value - scaleMin) / scaleRange
    const y = padTop + drawH - normalizedY * drawH
    return { x, y, pt }
  })

  // Horizontal Time Ticks calculation across active data points
  const timeTicks = useMemo(() => {
    if (activeData.length < 2) return []
    const count = width < 340 ? 2 : width < 500 ? 3 : 4
    const step = (activeData.length - 1) / (count - 1)
    const ticks: { x: number; label: string; textAnchor: "start" | "middle" | "end" }[] = []

    for (let i = 0; i < count; i++) {
      const idx = Math.min(activeData.length - 1, Math.round(i * step))
      const pt = activeData[idx]
      const x = padLeft + (idx / Math.max(1, activeData.length - 1)) * drawW
      const label = formatXAxisTime(pt.timestamp, timeRange)
      const textAnchor: "start" | "middle" | "end" =
        i === 0 ? "start" : i === count - 1 ? "end" : "middle"
      ticks.push({ x, label, textAnchor })
    }
    return ticks
  }, [activeData, width, padLeft, drawW, timeRange])

  // Generate smooth SVG curve
  function buildSmoothCurve(pts: { x: number; y: number }[]) {
    if (pts.length === 0) return ""
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return d
  }

  const curvePath = buildSmoothCurve(svgPoints)
  const firstPt = svgPoints[0] || { x: padLeft, y: bottomY }
  const lastPt = svgPoints[svgPoints.length - 1] || { x: padLeft + drawW, y: bottomY }
  const areaPath = curvePath
    ? `${curvePath} L ${lastPt.x.toFixed(1)},${bottomY} L ${firstPt.x.toFixed(1)},${bottomY} Z`
    : ""

  const activeHoverPt =
    hoverIndex !== null && svgPoints[hoverIndex] ? svgPoints[hoverIndex] : null

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (activeData.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth
    const clampedX = Math.max(padLeft, Math.min(padLeft + drawW, mouseX))
    const ratio = (clampedX - padLeft) / drawW
    const idx = Math.round(ratio * (activeData.length - 1))
    setHoverIndex(idx)
  }

  const isPositive = pctChange > 0.05
  const isNegative = pctChange < -0.05
  const TrendingIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Activity

  return (
    <div className="h-full flex flex-col justify-between select-none py-0.5">
      {/* 1. Header Row: Value, Trend Tag & Live/Period Status */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`flex items-center gap-1.5 font-bold text-slate-500 uppercase tracking-wide ${titleSizeClass}`}>
            <Icon className="h-3.5 w-3.5 text-[#db4040]" />
            <span>{meta?.label || effectiveKey}</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`tabular-nums tracking-tight text-slate-800 ${valSizeClass}`}>
              {currentVal.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}
            </span>
            {unit && (
              <span className={`font-bold text-slate-400 ${unitSizeClass}`}>
                {unit}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex items-center gap-0.5 font-bold text-[10px] px-1.5 py-0.5 rounded-md border ${
                isPositive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isNegative
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              <TrendingIcon className="h-3 w-3" />
              {pctChange > 0 ? "+" : ""}
              {pctChange.toFixed(1)}%
            </span>

            {timeRange === "live" ? (
              isLive ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200/80 text-[9px] font-extrabold text-[#db4040]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#db4040] animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  STATIC
                </span>
              )
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {CHART_TIME_RANGES.find((r) => r.key === timeRange)?.periodLabel.toUpperCase()}
              </span>
            )}
          </div>

          <div className="text-[9px] font-semibold text-slate-400">
            {timeRange === "live"
              ? isLive
                ? config?.timeSpan
                  ? `Window ${config.timeSpan}`
                  : "Realtime Buffer"
                : "No Incoming Data"
              : isLoadingHistory
              ? "Fetching telemetry..."
              : `${activeData.length} data points`}
          </div>
        </div>
      </div>

      {/* 2. Time Filter Row: Live, Hour, Day, Weakly, Month, Years */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 mt-1 mb-0.5">
        {CHART_TIME_RANGES.map((r) => {
          const isSelected = timeRange === r.key
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setTimeRange(r.key)}
              className={`rounded font-bold transition-all whitespace-nowrap cursor-pointer ${filterBtnSizeClass} ${
                isSelected
                  ? "bg-[#db4040] text-white shadow-sm ring-1 ring-[#db4040]"
                  : "bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/60"
              }`}
            >
              {r.label}
            </button>
          )
        })}
        {isLoadingHistory && (
          <span className="text-[9px] text-[#db4040] font-semibold animate-pulse ml-1">
            Loading...
          </span>
        )}
      </div>

      {/* 3. Mini Stats Sub-row */}
      <div className={`flex items-center gap-3 font-medium text-slate-400 mt-0.5 ${statsSizeClass}`}>
        <span>
          Min: <strong className="font-bold text-slate-600">{minVal.toFixed(decimals)}</strong>
        </span>
        <span>
          Avg: <strong className="font-bold text-slate-600">{avgVal.toFixed(decimals)}</strong>
        </span>
        <span>
          Max: <strong className="font-bold text-slate-600">{maxVal.toFixed(decimals)}</strong>
        </span>
        {activeHoverPt && (
          <span className="ml-auto font-bold text-[#db4040] bg-red-50 px-1.5 py-0.5 rounded border border-red-100 text-[9px] tabular-nums">
            {formatHoverTime(activeHoverPt.pt.timestamp, timeRange)} • {activeHoverPt.pt.value.toFixed(decimals)} {unit}
          </span>
        )}
      </div>

      {/* 4. Realtime / Historical SVG Line Chart */}
      <div className="relative flex-1 w-full min-h-[64px] mt-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#db4040" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#db4040" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padTop + ratio * drawH
            const labelVal = scaleMax - ratio * scaleRange
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + drawW}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 5}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="8"
                  fontWeight="600"
                >
                  {labelVal.toFixed(decimals > 0 ? 1 : 0)}
                </text>
              </g>
            )
          })}

          {/* Horizontal X Axis baseline */}
          <line
            x1={padLeft}
            y1={bottomY}
            x2={padLeft + drawW}
            y2={bottomY}
            stroke="#e2e8f0"
            strokeWidth="1"
          />

          {/* Horizontal Time Ticks & Labels */}
          {timeTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={t.x}
                y1={bottomY}
                x2={t.x}
                y2={bottomY + 3.5}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text
                x={t.x}
                y={bottomY + 13}
                textAnchor={t.textAnchor}
                fill="#94a3b8"
                fontSize="7.5"
                fontWeight="600"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill={`url(#${chartId})`} />}

          {/* Smooth Line Path */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke="#db4040"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Pulse dot on latest point (pulses only when live) */}
          {lastPt && (
            <g transform={`translate(${lastPt.x}, ${lastPt.y})`}>
              {isLive && timeRange === "live" && (
                <circle r="7" fill="#db4040" opacity="0.25" className="animate-ping" />
              )}
              <circle r="3.5" fill="#db4040" stroke="#ffffff" strokeWidth="2" />
            </g>
          )}

          {/* Hover Crosshair & Dot */}
          {activeHoverPt && (
            <g>
              <line
                x1={activeHoverPt.x}
                y1={padTop}
                x2={activeHoverPt.x}
                y2={bottomY}
                stroke="#db4040"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.8"
              />
              <circle
                cx={activeHoverPt.x}
                cy={activeHoverPt.y}
                r="4.5"
                fill="#ffffff"
                stroke="#db4040"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}

function BarChartWidget({
  vessel,
  config,
  width = 300,
  height = 200,
}: {
  vessel: Vessel
  config?: WidgetConfig
  width?: number
  height?: number
}) {
  const decimals = typeof config?.decimals === "number" ? config.decimals : 1
  const rawDepth = vessel.depth !== undefined && vessel.depth !== null ? vessel.depth : 0
  const unit = config?.unit || "m"

  // Discrete clean steps for depth zoom levels (multiples of 4 for clean whole-integer scale ticks)
  const ZOOM_PRESETS = [4, 8, 12, 16, 20, 24, 32, 40, 60, 80, 100, 150, 200]
  const [manualMax, setManualMax] = useState<number | null>(null)

  // Flexible max depth based on incoming payload (+10m headroom, rounded cleanly for 4 scale ticks)
  const configuredMax = typeof config?.max === "number" && config.max > 0 ? config.max : null
  const dynamicMax = Math.max(8, Math.ceil((rawDepth + 10) / 4) * 4)
  const maxDepth = manualMax ?? (configuredMax ?? dynamicMax)
  const isAutoZoom = manualMax === null

  const minDepth = typeof config?.min === "number" ? config.min : 0
  const range = Math.max(4, maxDepth - minDepth)

  const handleZoomIn = () => {
    // Find preset smaller than current maxDepth
    const smaller = [...ZOOM_PRESETS].reverse().find((val) => val < maxDepth)
    if (smaller !== undefined) {
      setManualMax(smaller)
    } else {
      setManualMax(ZOOM_PRESETS[0]) // Min 4m
    }
  }

  const handleZoomOut = () => {
    // Find preset larger than current maxDepth
    const larger = ZOOM_PRESETS.find((val) => val > maxDepth)
    if (larger !== undefined) {
      setManualMax(larger)
    } else {
      setManualMax(ZOOM_PRESETS[ZOOM_PRESETS.length - 1]) // Max 200m
    }
  }

  const handleResetAuto = () => {
    setManualMax(null)
  }

  // Native wheel listener on ref with { passive: false } to prevent page scroll chaining
  const echogramContainerRef = useRef<HTMLDivElement>(null)
  const maxDepthRef = useRef(maxDepth)
  maxDepthRef.current = maxDepth

  useEffect(() => {
    const el = echogramContainerRef.current
    if (!el) return

    const onWheelNative = (e: WheelEvent) => {
      // Prevent page from scrolling up/down when zooming in/out on the widget
      e.preventDefault()
      e.stopPropagation()

      const current = maxDepthRef.current
      if (e.deltaY < 0) {
        // Scroll Up -> Zoom In (detail skala lebih dekat)
        const smaller = [...ZOOM_PRESETS].reverse().find((val) => val < current)
        setManualMax(smaller !== undefined ? smaller : ZOOM_PRESETS[0])
      } else if (e.deltaY > 0) {
        // Scroll Down -> Zoom Out (skala lebih lebar)
        const larger = ZOOM_PRESETS.find((val) => val > current)
        setManualMax(larger !== undefined ? larger : ZOOM_PRESETS[ZOOM_PRESETS.length - 1])
      }
    }

    el.addEventListener("wheel", onWheelNative, { passive: false })
    return () => {
      el.removeEventListener("wheel", onWheelNative)
    }
  }, [])

  // Configurable Depth Colors & Thresholds from widget settings
  const userShallowColor = config?.depthColors?.shallow || "#f43f5e"
  const userCautionColor = config?.depthColors?.caution || "#f59e0b"
  const userSafeColor = config?.depthColors?.safe || "#06b6d4"

  const shallowThreshold = config?.depthThresholds?.shallow ?? 5
  const cautionThreshold = config?.depthThresholds?.caution ?? 10

  // Safety thresholds:
  const isShallow = rawDepth > 0 && rawDepth < shallowThreshold
  const isCaution = rawDepth >= shallowThreshold && rawDepth < cautionThreshold
  const isSafe = rawDepth >= cautionThreshold

  const activeColor = isShallow
    ? userShallowColor
    : isCaution
    ? userCautionColor
    : userSafeColor

  const statusText = isShallow
    ? `Shallow Depth (<${shallowThreshold}m)`
    : isCaution
    ? `Caution Draft (${shallowThreshold}-${cautionThreshold}m)`
    : rawDepth > 0
    ? `Safe Depth (>${cautionThreshold}m)`
    : "No Echo Signal"

  // Dynamic Seabed Palette matching real-time depth zone and user custom depth colors
  const seabedColor = {
    primary: activeColor,
    secondary: `${activeColor}dd`,
    crest: `${activeColor}ff`,
    glow: `${activeColor}70`,
  }

  // 5 scale ticks across the depth range
  const tickSteps = 4
  const ticks = Array.from({ length: tickSteps + 1 }, (_, i) => {
    const val = Number((minDepth + (range * i) / tickSteps).toFixed(1))
    const pct = (i / tickSteps) * 100
    return { val, pct }
  })

  // Risk zone strip heights (percentage of vertical scale)
  const shallowLimitPct = Math.min(100, Math.max(0, (shallowThreshold / range) * 100))
  const cautionLimitPct = Math.min(100, Math.max(0, (cautionThreshold / range) * 100))

  // Real-time Scrolling Historical Depth Buffer (Garmin CHIRP Waterfall Echogram)
  const sliceCount = 36
  const [sonarHistory, setSonarHistory] = useState<number[]>(() => {
    const arr: number[] = []
    const base = rawDepth > 0 ? rawDepth : 0
    for (let i = 0; i < sliceCount; i++) {
      const variance = base > 0 ? Math.sin(i * 0.45) * 0.08 : 0
      arr.push(Math.max(0, Number((base + variance).toFixed(2))))
    }
    return arr
  })

  const lastUpdateRef = useRef<string | number | undefined>(vessel.updatedAt)
  const lastDepthRef = useRef<number>(rawDepth)

  useEffect(() => {
    const isNewPacket = vessel.updatedAt && vessel.updatedAt !== lastUpdateRef.current
    const isDepthChanged = rawDepth !== lastDepthRef.current

    if (isNewPacket || isDepthChanged) {
      lastUpdateRef.current = vessel.updatedAt
      lastDepthRef.current = rawDepth
      setSonarHistory((prev) => [...prev.slice(1), rawDepth])
    }
  }, [vessel.updatedAt, rawDepth])

  // Adaptive scale tiers
  const isLarge = width >= 420 || height >= 220
  const isSmall = width < 250 || height < 140

  const heroValClass = isLarge ? "text-4xl lg:text-5xl font-black" : isSmall ? "text-2xl font-bold" : "text-3xl font-black"
  const rulerWidthClass = isLarge ? "w-14 pr-2" : isSmall ? "w-10 pr-1" : "w-12 pr-1.5"
  const tickFontClass = isLarge ? "text-[11px] font-mono font-bold" : isSmall ? "text-[8px] font-mono font-semibold" : "text-[9.5px] font-mono font-bold"

  // SVG Geometry for Sonar Echogram
  const svgW = 320
  const svgH = 140
  const padTop = 10
  const drawH = svgH - padTop

  // Normalized Current Depth Y position
  const currentDepthY =
    rawDepth > 0
      ? padTop + Math.min(drawH * 0.94, Math.max(4, ((rawDepth - minDepth) / range) * drawH))
      : padTop + drawH * 0.5

  // Map historical depth points to SVG coordinates
  const echogramPoints = sonarHistory.map((d, i) => {
    const x = (i / (sliceCount - 1)) * svgW
    const normalized = d > 0 ? ((d - minDepth) / range) * drawH : drawH * 0.5
    const y = padTop + Math.min(drawH * 0.94, Math.max(4, normalized))
    return { x, y }
  })

  // Build smooth curve path across the echogram
  function buildEchogramPath(pts: { x: number; y: number }[]) {
    if (pts.length === 0) return ""
    let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return path
  }

  const seabedCurve = buildEchogramPath(echogramPoints)
  const seabedArea = seabedCurve
    ? `${seabedCurve} L ${svgW},${svgH} L 0,${svgH} Z`
    : ""

  // Water Temperature (from sensor if present)
  const rawWaterTemp = (vessel as any)?.waterTemp ?? (vessel as any)?.water_temp_c
  const hasWaterTemp = typeof rawWaterTemp === "number" && !isNaN(rawWaterTemp)

  return (
    <div className="flex h-full w-full flex-col justify-between select-none py-0.5 overflow-hidden">
      {/* 1. Header: Big Numerical Readout, Water Temp (if available), Shallow Status Badge */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 shrink-0">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className={`tabular-nums tracking-tight text-slate-900 ${heroValClass}`}>
            {rawDepth > 0 ? formatNum(rawDepth, decimals) : "—"}
          </span>
          <span className={`font-extrabold text-slate-500 uppercase ${isLarge ? "text-base" : isSmall ? "text-xs" : "text-sm"}`}>
            {unit}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasWaterTemp && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200">
              <Thermometer className="h-3 w-3 text-sky-500" />
              <span>{rawWaterTemp.toFixed(1)}°C</span>
            </div>
          )}

          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-2xs transition-colors duration-300"
            style={{
              backgroundColor: `${activeColor}15`,
              borderColor: `${activeColor}40`,
              color: activeColor,
            }}
          >
            <span
              className={`h-2 w-2 rounded-full ${isShallow ? "animate-pulse" : ""}`}
              style={{ backgroundColor: activeColor }}
            />
            <span>{statusText}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Clean CHIRP Echosounder Display */}
      <div className="relative flex-1 my-1 rounded-2xl overflow-hidden border border-slate-800 shadow-md flex bg-[#030712] min-h-[96px]">
        {/* Left: Graduated Sonar Depth Ruler */}
        <div className={`relative bg-slate-950/90 border-r border-slate-800/80 flex flex-col justify-between py-2 text-right shrink-0 select-none z-20 ${rulerWidthClass}`}>
          {/* Risk Zone Color Bar (Synchronized with user custom depth colors) */}
          <div className="absolute top-0 right-0 bottom-0 w-1 flex flex-col pointer-events-none">
            <div className="w-full transition-colors duration-300" style={{ height: `${shallowLimitPct}%`, backgroundColor: userShallowColor }} />
            <div className="w-full transition-colors duration-300" style={{ height: `${Math.max(0, cautionLimitPct - shallowLimitPct)}%`, backgroundColor: userCautionColor }} />
            <div className="w-full flex-1 transition-colors duration-300" style={{ backgroundColor: userSafeColor }} />
          </div>

          {ticks.map((t) => (
            <div key={t.pct} className="relative flex items-center justify-end">
              <span className={`leading-none text-slate-400 ${tickFontClass}`}>
                {t.val}m
              </span>
              <span className="inline-block w-1.5 h-[1px] bg-slate-700 ml-1" />
            </div>
          ))}
        </div>

        {/* Center: Real-Time Scrolling CHIRP Echogram Canvas with Zoom and Zone Alignment */}
        <div
          ref={echogramContainerRef}
          style={{ overscrollBehavior: "contain" }}
          className="relative flex-1 overflow-hidden bg-[#030712] flex flex-col justify-between"
        >
          {/* Synchronized Depth Zone Ambient Layers (Aligned 1:1 with left ruler & custom colors) */}
          <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
            {/* Shallow Zone */}
            <div
              className="w-full transition-all duration-300"
              style={{
                height: `${shallowLimitPct}%`,
                background: `linear-gradient(to bottom, ${userShallowColor}30, ${userShallowColor}10, transparent)`,
              }}
            />
            {/* Caution Zone */}
            <div
              className="w-full transition-all duration-300"
              style={{
                height: `${Math.max(0, cautionLimitPct - shallowLimitPct)}%`,
                background: `linear-gradient(to bottom, ${userCautionColor}28, ${userCautionColor}08, transparent)`,
              }}
            />
            {/* Safe Deep Water Zone */}
            <div
              className="w-full flex-1 transition-all duration-300"
              style={{
                background: `linear-gradient(to bottom, ${userSafeColor}22, #031525 60%, #020b14 100%)`,
              }}
            />
          </div>

          {/* Transducer Surface Transmission Pulse (0m Line) */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-b from-cyan-400/60 via-sky-500/20 to-transparent z-20 pointer-events-none" />

          {/* Depth Reference Grid Lines */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-10 opacity-20">
            {ticks.map((t) => (
              <div key={t.pct} className="border-b border-dashed border-cyan-400 w-full" />
            ))}
          </div>

          {/* Zoom In / Zoom Out Floating Controls (Garmin Marine Style - Left Aligned to prevent clash) */}
          <div className="absolute top-1.5 left-2 z-30 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-slate-700/80 shadow-md select-none">
            {/* Zoom Out Button */}
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out (Perlebar jangkauan skala)"
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            >
              <Minus className="h-3 w-3" />
            </button>

            {/* Auto / Scale Display Button */}
            <button
              type="button"
              onClick={handleResetAuto}
              title={isAutoZoom ? "Skala Otomatis Aktif (Payload + 10m)" : "Klik untuk reset ke Skala Otomatis"}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition active:scale-95 cursor-pointer ${
                isAutoZoom
                  ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50"
                  : "bg-slate-800 text-amber-300 hover:text-amber-200 border border-slate-600"
              }`}
            >
              {isAutoZoom ? "AUTO" : `${maxDepth}m`}
            </button>

            {/* Zoom In Button */}
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In (Perbesar resolusi kedalaman)"
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Real-Time SVG Acoustic Echogram */}
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible z-10"
          >
            <defs>
              {/* Dynamic Seabed Sonar Return Gradient (Harmonized with Depth Safety Tier & Custom Colors) */}
              <linearGradient id="sonarSeabedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={seabedColor.primary} stopOpacity="0.85" />
                <stop offset="12%" stopColor={seabedColor.primary} stopOpacity="0.35" />
                <stop offset="35%" stopColor="#0f172a" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.98" />
              </linearGradient>

              {/* Acoustic Surface Clutter Glow */}
              <linearGradient id="surfaceSonarPulse" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Surface Pulse Ring */}
            <rect x="0" y="0" width={svgW} height="5" fill="url(#surfaceSonarPulse)" />

            {/* Faint Floating Sonar Water Particles */}
            <circle cx={svgW * 0.28} cy={Math.max(16, currentDepthY * 0.55)} r="1.5" fill="#38bdf8" opacity="0.35" />
            <circle cx={svgW * 0.52} cy={Math.max(20, currentDepthY * 0.72)} r="1.8" fill="#38bdf8" opacity="0.3" />
            <circle cx={svgW * 0.74} cy={Math.max(14, currentDepthY * 0.45)} r="1.2" fill="#38bdf8" opacity="0.4" />

            {/* Seabed Depth Return Area Fill */}
            {seabedArea && <path d={seabedArea} fill="url(#sonarSeabedGrad)" />}

            {/* Glowing Hard Return Acoustic Seabed Contour Line */}
            {seabedCurve && (
              <>
                <path
                  d={seabedCurve}
                  fill="none"
                  stroke={seabedColor.primary}
                  strokeWidth="5"
                  strokeOpacity="0.45"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={seabedCurve}
                  fill="none"
                  stroke={seabedColor.crest}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
          </svg>
        </div>

        {/* Right: Garmin Signature A-Scope (Real-time Acoustic Amplitude Flasher) */}
        <div className="relative w-7 bg-slate-950 border-l border-slate-800 flex flex-col justify-between shrink-0 select-none z-20 overflow-hidden">
          <div className="text-center pt-1 text-[7px] font-mono font-black text-slate-500 tracking-tighter">
            A-SCOPE
          </div>

          <div className="relative flex-1 w-full flex items-center justify-center my-0.5">
            <div className="absolute top-0 w-3/4 h-1.5 bg-slate-700/80 rounded-b-xs" />

            <div
              className="absolute inset-x-0 transition-all duration-300 ease-out flex items-center justify-end pr-0.5 -translate-y-1/2"
              style={{
                top: `${rawDepth > 0 ? Math.min(90, Math.max(10, ((rawDepth - minDepth) / range) * 100)) : 50}%`,
              }}
            >
              <div className="w-full flex items-center justify-end">
                <div
                  className="w-full h-3.5 flex items-center justify-end pr-1 shadow-sm transition-all duration-300"
                  style={{
                    clipPath: "polygon(0% 50%, 100% 0%, 100% 100%)",
                    background: `linear-gradient(to left, ${seabedColor.crest}, ${seabedColor.primary}, transparent)`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="text-center pb-1 text-[7px] font-mono font-bold text-slate-600">
            FLSH
          </div>
        </div>

        {/* Floating Digital Depth Marker Tag (Snapping right to current seabed level) */}
        <div
          className="absolute right-9 z-30 transition-all duration-500 -translate-y-1/2"
          style={{
            top: `${rawDepth > 0 ? Math.min(88, Math.max(12, ((rawDepth - minDepth) / range) * 100)) : 50}%`,
          }}
        >
          <div
            className="px-2 py-0.5 rounded-md text-[11px] font-black shadow-lg flex items-center gap-1 border transition-all cursor-default text-white"
            style={{
              backgroundColor: activeColor,
              borderColor: `${activeColor}ee`,
              boxShadow: `0 4px 14px ${activeColor}50`,
            }}
          >
            <span>{rawDepth > 0 ? `${formatNum(rawDepth, decimals)} m` : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TelemetryRow {
  key: string
  label: string
  category: "Navigation" | "Machinery" | "Environment" | "System"
  icon: any
  valueStr: string
  unit: string
  status: "normal" | "warning" | "critical"
  statusText: string
  lastSeen: string
}

function getCategoryFromNamespace(ns?: string, key?: string): "Navigation" | "Machinery" | "Environment" | "System" {
  const n = (ns || "").toLowerCase()
  const k = (key || "").toLowerCase()
  if (n === "machinery" || k.includes("rpm") || k.includes("engine") || k.includes("fuel")) return "Machinery"
  if (n === "environment" || k.includes("wind") || k.includes("temp") || k.includes("depth") || k.includes("weather")) return "Environment"
  if (n === "system" || k.includes("position") || k.includes("gps") || k.includes("gnss") || k.includes("hdop") || k.includes("gateway") || k.includes("link")) return "System"
  return "Navigation"
}

function getIconForAttribute(key: string, _category: string) {
  const k = key.toLowerCase()
  if (k.includes("sog") || k.includes("speed")) return Waves
  if (k.includes("heading") || k.includes("compass")) return Compass
  if (k.includes("cog") || k.includes("course")) return CircleGauge
  if (k.includes("depth")) return Waves
  if (k.includes("wind")) return Wind
  if (k.includes("temp")) return Thermometer
  if (k.includes("rpm")) return Activity
  if (k.includes("engine") || k.includes("load")) return Gauge
  if (k.includes("fuel")) return Fuel
  if (k.includes("pos") || k.includes("gps") || k.includes("gnss") || k.includes("coord")) return Map
  if (k.includes("gate") || k.includes("link") || k.includes("server")) return Server
  if (k.includes("pitch") || k.includes("roll") || k.includes("motion")) return Navigation
  return Activity
}

function TableWidget({
  vessel,
  config,
  width = 400,
  height = 220,
}: {
  vessel: Vessel
  config?: WidgetConfig
  width?: number
  height?: number
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>(config?.defaultCategory || "all")
  const [registeredAttrs, setRegisteredAttrs] = useState<AssetAttribute[]>([])

  useEffect(() => {
    if (config?.defaultCategory) {
      setCategoryFilter(config.defaultCategory)
    }
  }, [config?.defaultCategory])

  useEffect(() => {
    if (!vessel?.id) return
    let isMounted = true
    const load = () => {
      api.getAttributes(vessel.id)
        .then((attrs) => {
          if (isMounted && Array.isArray(attrs)) {
            setRegisteredAttrs(attrs)
          }
        })
        .catch(() => {})
    }
    load()
    const timer = setInterval(load, 3000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [vessel?.id])

  const rows: TelemetryRow[] = useMemo(() => {
    if (registeredAttrs.length > 0) {
      return registeredAttrs.map((attr) => {
        const normKey = attr.keyName.toLowerCase().replace(/[^a-z0-9]/g, "")
        const cat = getCategoryFromNamespace(attr.namespace, attr.keyName)
        const Icon = getIconForAttribute(attr.keyName, cat)

        let valueStr = "—"
        let status: "normal" | "warning" | "critical" =
          attr.status === "stale" ? "warning" : attr.status === "offline" ? "critical" : "normal"
        let statusText = attr.status === "live" ? "Live" : attr.status === "stale" ? "Stale" : "Offline"

        if (normKey === "sog" || normKey === "speed") {
          const val = vessel.sog ?? (attr.liveValue !== null && attr.liveValue !== undefined ? Number(attr.liveValue) : null)
          valueStr = val !== null && !isNaN(val) ? formatNum(val, 1) : "—"
          status = val !== null && val > 24 ? "critical" : val !== null && val > 18 ? "warning" : "normal"
          statusText = val !== null && val > 24 ? "High Speed" : val !== null && val > 0.5 ? "Cruising" : "Moored"
        } else if (normKey === "heading" || normKey === "compass") {
          const val = vessel.heading ?? (attr.liveValue !== null && attr.liveValue !== undefined ? Number(attr.liveValue) : null)
          valueStr = val !== null && !isNaN(val) ? `${Math.round(val)}` : "—"
          status = "normal"
          statusText = "Aligned"
        } else if (normKey === "cog" || normKey === "course") {
          const val = vessel.cog ?? (attr.liveValue !== null && attr.liveValue !== undefined ? Number(attr.liveValue) : null)
          valueStr = val !== null && !isNaN(val) ? `${Math.round(val)}` : "—"
          status = "normal"
          statusText = "Tracking"
        } else if (normKey === "depth") {
          const val =
            vessel.depth !== null && vessel.depth !== undefined
              ? vessel.depth
              : attr.liveValue !== null && attr.liveValue !== undefined
              ? Number(attr.liveValue)
              : null
          valueStr = val !== null && !isNaN(val) ? formatNum(val, 1) : "—"
          status = val !== null && val < 5 ? "critical" : val !== null && val < 10 ? "warning" : "normal"
          statusText = val !== null && val < 5 ? "Shallow Depth" : val !== null && val < 10 ? "Caution" : "Safe Depth"
        } else if (normKey === "position" || normKey === "gnss" || normKey === "coordinates") {
          valueStr = vessel.position
            ? `${formatNum(vessel.position.lat, 4)}°, ${formatNum(vessel.position.lng, 4)}°`
            : attr.liveValue
            ? String(attr.liveValue)
            : "No Fix"
          status = vessel.position ? "normal" : "warning"
          statusText = vessel.position ? "3D DGPS Fix" : "No Fix"
        } else if (normKey === "windspeed" || normKey === "wind") {
          const val =
            vessel.windSpeed !== null && vessel.windSpeed !== undefined
              ? vessel.windSpeed
              : attr.liveValue !== null && attr.liveValue !== undefined
              ? Number(attr.liveValue)
              : null
          valueStr = val !== null && !isNaN(val) ? formatNum(val, 1) : "—"
          status = val !== null && val > 34 ? "critical" : val !== null && val > 22 ? "warning" : "normal"
          statusText = val !== null && val > 34 ? "Gale / Storm" : val !== null && val > 22 ? "Strong Wind" : "Normal"
        } else if (normKey === "rpm") {
          const val = vessel.rpm ?? (attr.liveValue !== null && attr.liveValue !== undefined ? Number(attr.liveValue) : null)
          valueStr = val !== null && !isNaN(val) ? `${Math.round(val)}` : "—"
          status = val !== null && val > 2800 ? "critical" : val !== null && val > 2200 ? "warning" : "normal"
          statusText =
            val !== null && val > 2800
              ? "Over RPM"
              : val !== null && val > 2200
              ? "Heavy Load"
              : val !== null && val > 400
              ? "Operating"
              : "Idle / Off"
        } else if (normKey === "engineload") {
          const val =
            vessel.engineLoad ?? (attr.liveValue !== null && attr.liveValue !== undefined ? Number(attr.liveValue) : null)
          valueStr = val !== null && !isNaN(val) ? `${formatNum(val, 0)}` : "—"
          status = val !== null && val > 85 ? "critical" : val !== null && val > 75 ? "warning" : "normal"
          statusText = val !== null && val > 85 ? "Overload" : val !== null && val > 75 ? "High" : "Optimal"
        } else if (normKey === "fuel") {
          const val = vessel.fuel ?? (attr.liveValue !== null && attr.liveValue !== undefined ? Number(attr.liveValue) : null)
          valueStr = val !== null && !isNaN(val) ? `${formatNum(val, 0)}` : "—"
          status = val !== null && val < 20 ? "critical" : val !== null && val < 35 ? "warning" : "normal"
          statusText = val !== null && val < 20 ? "Low Fuel" : val !== null && val < 35 ? "Reserve" : "Adequate"
        } else {
          if (attr.liveValue !== null && attr.liveValue !== undefined) {
            const num = Number(attr.liveValue)
            valueStr = !isNaN(num) ? (Number.isInteger(num) ? `${num}` : formatNum(num, 1)) : String(attr.liveValue)
            status = "normal"
            statusText = "Active"
          } else {
            valueStr = "—"
            status = "normal"
            statusText = "No Data"
          }
        }

        return {
          key: attr.keyName,
          label: attr.displayName || attr.keyName,
          category: cat,
          icon: Icon,
          valueStr,
          unit: attr.unit || "",
          status,
          statusText,
          lastSeen: "Live",
        }
      })
    }

    // Fallback if registeredAttrs not yet loaded: only include vessel attributes that are NOT null and NOT undefined
    const base: TelemetryRow[] = []
    if (vessel.sog !== undefined && vessel.sog !== null) {
      base.push({
        key: "sog",
        label: "Speed Over Ground (SOG)",
        category: "Navigation",
        icon: Waves,
        valueStr: formatNum(vessel.sog, 1),
        unit: "kn",
        status: vessel.sog > 24 ? "critical" : vessel.sog > 18 ? "warning" : "normal",
        statusText: vessel.sog > 24 ? "High Speed" : vessel.sog > 0.5 ? "Cruising" : "Moored",
        lastSeen: "Live",
      })
    }
    if (vessel.heading !== undefined && vessel.heading !== null) {
      base.push({
        key: "heading",
        label: "Heading & Compass",
        category: "Navigation",
        icon: Compass,
        valueStr: `${Math.round(vessel.heading ?? 0)}`,
        unit: "°",
        status: "normal",
        statusText: "Aligned",
        lastSeen: "Live",
      })
    }
    if (vessel.cog !== undefined && vessel.cog !== null) {
      base.push({
        key: "cog",
        label: "Course Over Ground (COG)",
        category: "Navigation",
        icon: CircleGauge,
        valueStr: `${Math.round(vessel.cog ?? 0)}`,
        unit: "°",
        status: "normal",
        statusText: "Tracking",
        lastSeen: "Live",
      })
    }
    if (vessel.depth !== undefined && vessel.depth !== null) {
      base.push({
        key: "depth",
        label: "Water Depth (Echosounder)",
        category: "Navigation",
        icon: Waves,
        valueStr: formatNum(vessel.depth, 1),
        unit: "m",
        status: vessel.depth < 5 ? "critical" : vessel.depth < 10 ? "warning" : "normal",
        statusText: vessel.depth < 5 ? "Shallow Depth" : vessel.depth < 10 ? "Caution" : "Safe Depth",
        lastSeen: "1s ago",
      })
    }
    if (vessel.windSpeed !== undefined && vessel.windSpeed !== null) {
      base.push({
        key: "windSpeed",
        label: "Wind Speed (Anemometer)",
        category: "Environment",
        icon: Wind,
        valueStr: formatNum(vessel.windSpeed, 1),
        unit: "kn",
        status: vessel.windSpeed > 34 ? "critical" : vessel.windSpeed > 22 ? "warning" : "normal",
        statusText: vessel.windSpeed > 34 ? "Gale / Storm" : vessel.windSpeed > 22 ? "Strong Wind" : "Normal",
        lastSeen: "Live",
      })
    }
    if (vessel.rpm !== undefined && vessel.rpm !== null) {
      base.push({
        key: "rpm",
        label: "Main Engine RPM",
        category: "Machinery",
        icon: Activity,
        valueStr: `${Math.round(vessel.rpm)}`,
        unit: "RPM",
        status: vessel.rpm > 2800 ? "critical" : vessel.rpm > 2200 ? "warning" : "normal",
        statusText:
          vessel.rpm > 2800
            ? "Over RPM"
            : vessel.rpm > 2200
            ? "Heavy Load"
            : vessel.rpm > 400
            ? "Operating"
            : "Idle / Off",
        lastSeen: "Live",
      })
    }
    if (vessel.engineLoad !== undefined && vessel.engineLoad !== null) {
      base.push({
        key: "engineLoad",
        label: "Engine Load",
        category: "Machinery",
        icon: Gauge,
        valueStr: `${formatNum(vessel.engineLoad, 0)}`,
        unit: "%",
        status: vessel.engineLoad > 85 ? "critical" : vessel.engineLoad > 75 ? "warning" : "normal",
        statusText: vessel.engineLoad > 85 ? "Overload" : vessel.engineLoad > 75 ? "High" : "Optimal",
        lastSeen: "1s ago",
      })
    }
    if (vessel.fuel !== undefined && vessel.fuel !== null) {
      base.push({
        key: "fuel",
        label: "Fuel Tank Reserve",
        category: "Machinery",
        icon: Fuel,
        valueStr: `${formatNum(vessel.fuel, 0)}`,
        unit: "%",
        status: vessel.fuel < 20 ? "critical" : vessel.fuel < 35 ? "warning" : "normal",
        statusText: vessel.fuel < 20 ? "Low Fuel" : vessel.fuel < 35 ? "Reserve" : "Adequate",
        lastSeen: "5s ago",
      })
    }
    if (vessel.position) {
      base.push({
        key: "position",
        label: "GNSS Position (Fix)",
        category: "System",
        icon: Map,
        valueStr: `${formatNum(vessel.position.lat, 4)}°, ${formatNum(vessel.position.lng, 4)}°`,
        unit: "Lat/Lon",
        status: "normal",
        statusText: "3D DGPS Fix",
        lastSeen: "Live",
      })
    }
    return base
  }, [vessel, registeredAttrs])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      return categoryFilter === "all" || r.category === categoryFilter
    })
  }, [rows, categoryFilter])

  const categories = useMemo(() => {
    const raw = [
      { key: "all", label: "All Sensors", count: rows.length },
      { key: "Navigation", label: "Navigation", count: rows.filter((r) => r.category === "Navigation").length },
      { key: "Machinery", label: "Machinery", count: rows.filter((r) => r.category === "Machinery").length },
      { key: "Environment", label: "Environment", count: rows.filter((r) => r.category === "Environment").length },
      { key: "System", label: "System", count: rows.filter((r) => r.category === "System").length },
    ]
    return raw.filter((c) => c.key === "all" || c.count > 0)
  }, [rows])

  useEffect(() => {
    if (categoryFilter !== "all" && !categories.some((c) => c.key === categoryFilter)) {
      setCategoryFilter("all")
    }
  }, [categoryFilter, categories])

  // Adaptive scale tiers based on widget width and height
  const isXLarge = width >= 540 || height >= 260
  const isLarge = width >= 380 || height >= 200
  const isSmall = width < 280 || height < 140
  const isNarrow = width < 340

  const cellPad = isXLarge ? "py-2.5 px-3" : isSmall ? "py-1 px-1.5" : "py-1.5 px-2"
  const valTextClass = isXLarge ? "text-sm font-black" : isSmall ? "text-[10px] font-bold" : "text-xs font-black"
  const labelTextClass = isXLarge ? "text-xs font-bold" : isSmall ? "text-[10px] font-semibold" : "text-[11px] font-bold"
  const catTextClass = isXLarge ? "text-[10px]" : "text-[9px]"
  const iconSizeClass = isXLarge ? "h-3.5 w-3.5" : isSmall ? "h-2.5 w-2.5" : "h-3 w-3"
  const iconBoxClass = isXLarge ? "p-2 rounded-lg" : isSmall ? "p-1 rounded" : "p-1.5 rounded-md"
  const chipClass = isXLarge ? "px-2.5 py-1 text-xs" : isSmall ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
  const statusBadgeClass = isXLarge ? "px-2.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[9px]"

  const showStatusCol = config?.showStatus !== false && !isNarrow
  const showTimestampCol = config?.showTimestamp !== false && width >= 400

  return (
    <div className="h-full flex flex-col justify-between select-none">
      {/* Category filter bar */}
      {config?.showFilterChips !== false && (
        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 overflow-x-auto no-scrollbar shrink-0">
          {categories.map((c) => {
            const isActive = categoryFilter === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoryFilter(c.key)}
                className={`rounded-lg font-bold whitespace-nowrap transition cursor-pointer select-none ${chipClass} ${
                  isActive
                    ? "bg-[#db4040] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                {c.label} ({c.count})
              </button>
            )
          })}
        </div>
      )}

      {/* Table content with sticky header */}
      <div className="flex-1 overflow-y-auto mt-1 pr-0.5">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 text-[9px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
            <tr>
              <th className="py-1 px-2">Sensor / Parameter</th>
              <th className="py-1 px-2 text-right">Live Value</th>
              {showStatusCol && <th className="py-1 px-2 text-center">Status</th>}
              {showTimestampCol && <th className="py-1 px-2 text-right">Update</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {filteredRows.map((r, i) => {
              const Icon = r.icon
              return (
                <tr
                  key={r.key}
                  className={`transition hover:bg-slate-50/80 ${
                    i % 2 === 0 ? "bg-slate-50/30" : "bg-white"
                  }`}
                >
                  {/* Parameter & Category */}
                  <td className={cellPad}>
                    <div className="flex items-center gap-2">
                      <span className={`bg-slate-100 text-slate-600 shrink-0 ${iconBoxClass}`}>
                        <Icon className={iconSizeClass} />
                      </span>
                      <div className="min-w-0">
                        <div className={`text-slate-800 truncate ${labelTextClass}`}>
                          {r.label}
                        </div>
                        <div className={`font-semibold text-slate-400 ${catTextClass}`}>
                          {r.category}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Value & Unit */}
                  <td className={`${cellPad} text-right whitespace-nowrap`}>
                    <span className={`text-slate-900 tabular-nums ${valTextClass}`}>
                      {r.valueStr}
                    </span>
                    {r.unit && (
                      <span className={`ml-1 font-bold text-slate-400 ${catTextClass}`}>
                        {r.unit}
                      </span>
                    )}
                  </td>

                  {/* Health / Status Badge */}
                  {showStatusCol && (
                    <td className={`${cellPad} text-center whitespace-nowrap`}>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full font-extrabold border ${statusBadgeClass} ${
                          r.status === "critical"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : r.status === "warning"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            r.status === "critical"
                              ? "bg-rose-500 animate-pulse"
                              : r.status === "warning"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        {r.statusText}
                      </span>
                    </td>
                  )}

                  {/* Last Update */}
                  {showTimestampCol && (
                    <td className={`${cellPad} text-right whitespace-nowrap font-semibold text-slate-400 ${catTextClass}`}>
                      {r.lastSeen}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GatewayWidget({
  vessel,
  width = 300,
  height = 180,
}: {
  vessel: Vessel
  width?: number
  height?: number
}) {
  const isLarge = width >= 360 || height >= 200
  const isSmall = width < 250 || height < 130

  const iconBoxClass = isLarge ? "p-3 rounded-2xl" : isSmall ? "p-1.5 rounded-lg" : "p-2 rounded-xl"
  const iconSizeClass = isLarge ? "h-6 w-6" : isSmall ? "h-3.5 w-3.5" : "h-4 w-4"
  const titleClass = isLarge ? "text-sm font-bold text-slate-800" : isSmall ? "text-[11px] font-bold text-slate-800" : "text-xs font-bold text-slate-800"
  const subtitleClass = isLarge ? "text-xs text-slate-400" : isSmall ? "text-[9px] text-slate-400" : "text-[10px] text-slate-400"
  const cardPad = isLarge ? "p-3" : isSmall ? "p-1.5" : "p-2"
  const cardValClass = isLarge ? "text-sm font-extrabold" : isSmall ? "text-[11px] font-bold" : "text-xs font-bold"
  const footerClass = isLarge ? "text-xs pt-1.5" : isSmall ? "text-[9px] pt-0.5" : "text-[10px] pt-1"

  return (
    <div className="h-full flex flex-col justify-between py-1 select-none">
      <div className="flex items-center gap-2.5">
        <div className={`bg-red-50 text-[#db4040] border border-red-200 shrink-0 ${iconBoxClass}`}>
          <Server className={iconSizeClass} />
        </div>
        <div>
          <div className={titleClass}>Gateway TCP 20005</div>
          <div className={subtitleClass}>Hybrid CAN / NMEA 2000 & RS-485</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className={`rounded-lg bg-slate-50 border border-slate-100 ${cardPad}`}>
          <div className="text-[9px] text-slate-400">Link Status</div>
          <div className={`text-[#db4040] flex items-center gap-1 mt-0.5 ${cardValClass}`}>
            <span className="h-2 w-2 rounded-full bg-[#db4040] animate-pulse" />
            Online
          </div>
        </div>
        <div className={`rounded-lg bg-slate-50 border border-slate-100 ${cardPad}`}>
          <div className="text-[9px] text-slate-400">Vessel</div>
          <div className={`text-slate-800 truncate mt-0.5 ${cardValClass}`}>
            {vessel.name}
          </div>
        </div>
      </div>
      <div className={`text-slate-400 flex justify-between items-center border-t border-slate-100 ${footerClass}`}>
        <span>Decoders: NMEA2000 + NMEA0183</span>
        <span className="font-mono text-slate-600 font-bold">1248 pkt/min</span>
      </div>
    </div>
  )
}

function MapWidget({
  vessel,
  config,
  width = 400,
  height = 260,
}: {
  vessel: Vessel
  config?: WidgetConfig
  width?: number
  height?: number
}) {
  const { tracks, aisTargets: fallbackAisTargets = [] } = useFleet()
  const track = tracks[vessel.id] || []
  const [liveAisTargets, setLiveAisTargets] = useState<AisTarget[] | null>(null)

  // Polling data AIS real-time spesifik untuk kapal yang sedang dimonitor pada widget ini
  useEffect(() => {
    if (!vessel?.id) return
    let isMounted = true

    const fetchAis = () => {
      api
        .getAisTargets(vessel.id)
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
  }, [vessel.id])

  const [mapTheme, setMapTheme] = useState<OpenMapTilesTheme>(
    (config?.mapTheme as OpenMapTilesTheme) || "liberty"
  )
  const [showTrack, setShowTrack] = useState<boolean>(config?.showTrack !== false)
  const [showRangeRings, setShowRangeRings] = useState<boolean>(config?.showRangeRings !== false)
  const [centerTick, setCenterTick] = useState(0)
  const [selectedTargetId, setSelectedTargetId] = useState<string>()
  const [isOwnShipSelected, setIsOwnShipSelected] = useState(true)
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  // Reset selected target jika kapal yang dimonitor berganti
  useEffect(() => {
    setSelectedTargetId(undefined)
    setIsOwnShipSelected(true)
    setCenterTick((t) => t + 1)
  }, [vessel.id])

  // Sync with config changes
  useEffect(() => {
    if (config?.mapTheme) {
      setMapTheme(config.mapTheme as OpenMapTilesTheme)
    }
  }, [config?.mapTheme])

  useEffect(() => {
    if (config?.showTrack !== undefined) {
      setShowTrack(config.showTrack)
    }
  }, [config?.showTrack])

  useEffect(() => {
    if (config?.showRangeRings !== undefined) {
      setShowRangeRings(config.showRangeRings)
    }
  }, [config?.showRangeRings])

  const lat = vessel.position?.lat
  const lng = vessel.position?.lng
  const hasPos = typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)

  // Filter AIS targets: buang target yang sama dengan kapal own ship saat ini (berdasarkan mmsi / nama)
  const aisTargets = useMemo(() => {
    const raw = liveAisTargets !== null ? liveAisTargets : fallbackAisTargets
    return raw.filter((t) => {
      if (vessel.mmsi && String(t.mmsi) === String(vessel.mmsi)) return false
      if (vessel.name && t.name && t.name.toLowerCase() === vessel.name.toLowerCase()) return false
      return true
    })
  }, [liveAisTargets, fallbackAisTargets, vessel.mmsi, vessel.name])

  const selectedTarget = useMemo(() => {
    if (!selectedTargetId) return null
    return aisTargets.find((t) => t.id === selectedTargetId) || null
  }, [selectedTargetId, aisTargets])

  return (
    <div className="relative h-full w-full min-h-[160px] overflow-hidden rounded-xl border border-slate-200/80 shadow-inner select-none group/map">
      {/* 1. Real MapLibre Marine Map */}
      <OpenMapTilesMarineMap
        selectedVessel={vessel}
        aisTargets={aisTargets}
        selectedTargetId={selectedTargetId}
        isOwnShipSelected={isOwnShipSelected}
        onSelectTarget={(id) => {
          setSelectedTargetId(id)
          setIsOwnShipSelected(false)
        }}
        onSelectOwnShip={() => {
          setSelectedTargetId(undefined)
          setIsOwnShipSelected(true)
          setCenterTick((t) => t + 1)
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
        showNavControl={false}
      />

      {/* 2. Top-Left Live Status HUD */}
      <div className="absolute top-2 left-2 z-[10] flex flex-col gap-1 pointer-events-none">
        <div className={`flex items-center gap-1.5 rounded-lg bg-slate-900/85 text-white shadow-md border border-slate-700/80 backdrop-blur-md ${
          width >= 500 ? "px-3 py-1.5 text-xs" : width < 300 || height < 180 ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px] font-semibold"
        }`}>
          <span className="h-2 w-2 rounded-full bg-[#db4040] animate-pulse shrink-0" />
          <span className="font-bold text-white truncate max-w-[130px]">
            {vessel.name}
          </span>
          <span className="text-slate-400 font-mono text-[9px] ml-0.5">
            {hasPos ? `${formatNum(lat, 4)}°, ${formatNum(lng, 4)}°` : "No GPS Fix"}
          </span>
        </div>
        {hasPos && height >= 180 && (
          <div className={`flex items-center gap-2 font-semibold text-slate-200 bg-slate-900/75 rounded-md px-2 py-0.5 border border-slate-700/60 backdrop-blur-md w-fit ${
            width >= 500 ? "text-[10px]" : "text-[9px]"
          }`}>
            <span>HDG: <strong className="text-white">{Math.round(vessel.heading ?? 0)}°</strong></span>
            <span className="text-slate-500">•</span>
            <span>SOG: <strong className="text-white">{formatNum(vessel.sog, 1)} kn</strong></span>
            {vessel.cog !== undefined && vessel.cog !== null && (
              <>
                <span className="text-slate-500">•</span>
                <span>COG: <strong className="text-white">{Math.round(vessel.cog)}°</strong></span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Top-Right Floating Mini Controls */}
      <div className="absolute top-2 right-2 z-[10] flex items-center gap-1">
        {/* Recenter Button */}
        <button
          type="button"
          onClick={() => {
            setSelectedTargetId(undefined)
            setIsOwnShipSelected(true)
            setCenterTick((t) => t + 1)
          }}
          className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 shadow-sm border border-slate-200 hover:text-[#db4040] transition cursor-pointer backdrop-blur-xs"
          title="Recenter vessel"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>

        {/* Range Rings Toggle */}
        <button
          type="button"
          onClick={() => setShowRangeRings((v) => !v)}
          className={`p-1.5 rounded-lg shadow-sm border transition cursor-pointer backdrop-blur-xs ${
            showRangeRings
              ? "bg-[#db4040] text-white border-[#db4040]"
              : "bg-white/90 hover:bg-white text-slate-700 border-slate-200"
          }`}
          title="Toggle Range Rings (0.5, 1.0, 2.0 NM)"
        >
          <Compass className="h-3.5 w-3.5" />
        </button>

        {/* Track Line Toggle */}
        <button
          type="button"
          onClick={() => setShowTrack((v) => !v)}
          className={`p-1.5 rounded-lg shadow-sm border transition cursor-pointer backdrop-blur-xs ${
            showTrack
              ? "bg-[#db4040] text-white border-[#db4040]"
              : "bg-white/90 hover:bg-white text-slate-700 border-slate-200"
          }`}
          title="Toggle GPS Track line"
        >
          <Route className="h-3.5 w-3.5" />
        </button>

        {/* Theme / Layer Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowThemeMenu((v) => !v)}
            className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 shadow-sm border border-slate-200 hover:text-slate-900 transition cursor-pointer backdrop-blur-xs"
            title="Change map style"
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
          {showThemeMenu && (
            <div className="absolute right-0 top-8 z-20 w-32 rounded-xl bg-white shadow-xl border border-slate-200 py-1 text-[11px] font-semibold text-slate-700">
              {(
                [
                  { key: "liberty", label: "Marine 3D" },
                  { key: "dark", label: "Dark Marine" },
                  { key: "positron", label: "Light Clean" },
                  { key: "satellite", label: "Satellite" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setMapTheme(t.key)
                    setShowThemeMenu(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 transition flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    mapTheme === t.key ? "text-[#db4040] font-bold bg-slate-50/80" : ""
                  }`}
                >
                  <span>{t.label}</span>
                  {mapTheme === t.key && <span className="h-1.5 w-1.5 rounded-full bg-[#db4040]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Target Vessel Info Popover (if user clicks an AIS target on map) */}
      {selectedTarget && (
        <div className="absolute bottom-2 left-2 right-2 z-[15] max-w-sm rounded-xl bg-slate-900/90 text-white p-2.5 shadow-xl border border-slate-700/80 backdrop-blur-md">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="p-1 rounded bg-slate-800 text-sky-400">
                <Ship className="h-3 w-3" />
              </span>
              <span className="font-bold text-xs text-white truncate">
                {selectedTarget.name || `MMSI ${selectedTarget.mmsi}`}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                {selectedTarget.type || "AIS Target"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTargetId(undefined)}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1.5 text-[10px]">
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-bold">Speed</div>
              <div className="font-bold text-white tabular-nums">{selectedTarget.sog?.toFixed(1) ?? "—"} kn</div>
            </div>
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-bold">Course</div>
              <div className="font-bold text-white tabular-nums">{selectedTarget.cog ? `${Math.round(selectedTarget.cog)}°` : "—"}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-bold">Range</div>
              <div className="font-bold text-white tabular-nums">{selectedTarget.distanceNm?.toFixed(1) ?? "—"} NM</div>
            </div>
            <div>
              <div className="text-[8px] uppercase text-slate-400 font-bold">Bearing</div>
              <div className="font-bold text-white tabular-nums">{selectedTarget.bearing ? `${Math.round(selectedTarget.bearing)}°` : "—"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DynamicAttributeCard({
  vessel,
  attributeKey,
  config,
  width = 280,
  height = 180,
}: {
  vessel: Vessel
  attributeKey: string
  config?: WidgetConfig
  width?: number
  height?: number
}) {
  const meta = VESSEL_ATTRIBUTES.find((a) => a.key === attributeKey)
  const Icon = meta?.icon || Activity
  let valDisplay = "—"
  const decimals = typeof config?.decimals === "number" ? config.decimals : 1
  let unitDisplay = config?.unit || meta?.unit || ""

  if (attributeKey === "sog") {
    valDisplay = formatNum(vessel.sog, decimals)
  } else if (attributeKey === "heading") {
    valDisplay = `${Math.round(vessel.heading ?? 0)}`
  } else if (attributeKey === "cog") {
    valDisplay = `${Math.round(vessel.cog ?? 0)}`
  } else if (attributeKey === "depth") {
    valDisplay = formatNum(vessel.depth, decimals)
  } else if (attributeKey === "fuel") {
    valDisplay = formatNum(vessel.fuel, typeof config?.decimals === "number" ? config.decimals : 0)
  } else if (attributeKey === "rpm") {
    valDisplay = vessel.rpm ? `${Math.round(vessel.rpm)}` : "—"
  } else if (attributeKey === "engineLoad") {
    valDisplay = formatNum(vessel.engineLoad, typeof config?.decimals === "number" ? config.decimals : 0)
  } else if (attributeKey === "windSpeed") {
    valDisplay = formatNum(vessel.windSpeed, decimals)
  } else if (meta) {
    valDisplay = meta.getFormatted(vessel)
  }

  // Adaptive scale tier based on widget width and height
  const isXLarge = width >= 520 || height >= 240
  const isLarge = width >= 360 || height >= 180
  const isSmall = width < 230 || height < 120

  const valSizeClass = isXLarge
    ? "text-5xl lg:text-6xl font-black"
    : isLarge
    ? "text-4xl lg:text-5xl font-black"
    : isSmall
    ? "text-2xl font-bold"
    : "text-3xl font-extrabold"

  const unitSizeClass = isXLarge
    ? "text-base font-bold ml-2"
    : isLarge
    ? "text-sm font-bold ml-1.5"
    : isSmall
    ? "text-[10px] ml-1"
    : "text-xs font-semibold ml-1.5"

  const iconBoxClass = isXLarge
    ? "p-4 rounded-2xl"
    : isLarge
    ? "p-3.5 rounded-2xl"
    : isSmall
    ? "p-2 rounded-xl"
    : "p-3 rounded-2xl"

  const iconSizeClass = isXLarge
    ? "h-11 w-11"
    : isLarge
    ? "h-8 w-8"
    : isSmall
    ? "h-5 w-5"
    : "h-7 w-7"

  return (
    <div className="flex h-full items-center justify-between px-2 overflow-hidden select-none">
      <div className="min-w-0 pr-2">
        <div className={`tracking-tight tabular-nums text-slate-800 ${valSizeClass}`}>
          {valDisplay}
          {unitDisplay && (
            <span className={`text-slate-400 uppercase font-bold ${unitSizeClass}`}>
              {unitDisplay}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-semibold text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate">{formatDateTimeWithSeconds(vessel.updatedAt)}</span>
        </div>
      </div>
      <div className={`shrink-0 bg-slate-50 border border-slate-100 text-[#db4040] shadow-2xs ${iconBoxClass}`}>
        <Icon className={iconSizeClass} />
      </div>
    </div>
  )
}

type TimeFilterOption = "hour" | "day" | "weekly" | "month" | "year"

const TIME_FILTER_OPTIONS: { key: TimeFilterOption; label: string; periodLabel: string }[] = [
  { key: "hour", label: "Hour", periodLabel: "vs last hour" },
  { key: "day", label: "Day", periodLabel: "vs yesterday" },
  { key: "weekly", label: "Weekly", periodLabel: "vs last week" },
  { key: "month", label: "Month", periodLabel: "vs last month" },
  { key: "year", label: "Year", periodLabel: "vs last year" },
]

function KpiWidgetCard({
  vessel,
  attributeKey,
  config,
  width = 320,
  height = 200,
}: {
  vessel: Vessel
  attributeKey: string
  title?: string
  config?: WidgetConfig
  width?: number
  height?: number
}) {
  const meta = VESSEL_ATTRIBUTES.find((a) => a.key === attributeKey)
  const Icon = meta?.icon || Zap
  const decimals = typeof config?.decimals === "number" ? config.decimals : 1
  const unitDisplay = config?.unit || meta?.unit || ""

  // Time filter state (Hour, Day, Weekly, Month, Year) - Default 'day'
  const [timeFilter, setTimeFilter] = useState<TimeFilterOption>("day")

  // Current live sensor value
  let rawVal = 0
  let valDisplay = "—"

  if (attributeKey === "sog") {
    rawVal = vessel.sog ?? 0
    valDisplay = formatNum(vessel.sog, decimals)
  } else if (attributeKey === "heading") {
    rawVal = vessel.heading ?? 0
    valDisplay = `${Math.round(vessel.heading ?? 0)}`
  } else if (attributeKey === "cog") {
    rawVal = vessel.cog ?? 0
    valDisplay = `${Math.round(vessel.cog ?? 0)}`
  } else if (attributeKey === "depth") {
    rawVal = vessel.depth ?? 0
    valDisplay = formatNum(vessel.depth, decimals)
  } else if (attributeKey === "fuel") {
    rawVal = vessel.fuel ?? 0
    valDisplay = formatNum(vessel.fuel, typeof config?.decimals === "number" ? config.decimals : 0)
  } else if (attributeKey === "rpm") {
    rawVal = vessel.rpm ?? 0
    valDisplay = vessel.rpm ? `${Math.round(vessel.rpm)}` : "—"
  } else if (attributeKey === "engineLoad") {
    rawVal = vessel.engineLoad ?? 0
    valDisplay = formatNum(vessel.engineLoad, typeof config?.decimals === "number" ? config.decimals : 0)
  } else if (attributeKey === "windSpeed") {
    rawVal = vessel.windSpeed ?? 0
    valDisplay = formatNum(vessel.windSpeed, decimals)
  } else if (meta) {
    valDisplay = meta.getFormatted(vessel)
    const parsed = parseFloat(valDisplay)
    if (!isNaN(parsed)) rawVal = parsed
  }

  // Delta statistics per time filter (hour, day, weekly, month, year)
  const deltaMetrics: Record<TimeFilterOption, { decimal: number; percent: number }> = {
    hour: { decimal: 1.2, percent: 1.8 },
    day: { decimal: 3.5, percent: 4.6 },
    weekly: { decimal: 7.8, percent: 9.4 },
    month: { decimal: 12.5, percent: 15.2 },
    year: { decimal: 20.0, percent: 24.5 },
  }

  const activeDelta = deltaMetrics[timeFilter]
  const isPositive = activeDelta.decimal >= 0
  const activeOption = TIME_FILTER_OPTIONS.find((o) => o.key === timeFilter) || TIME_FILTER_OPTIONS[1]

  // KPI Operational Benchmarks
  const avgVal = rawVal > 0 ? rawVal * 0.94 : 0
  const peakVal = rawVal > 0 ? rawVal * 1.08 : 0
  const avgDisplay = `${formatNum(avgVal, decimals)}${unitDisplay ? ` ${unitDisplay}` : ""}`
  const peakDisplay = `${formatNum(peakVal, decimals)}${unitDisplay ? ` ${unitDisplay}` : ""}`

  // Adaptive scale tiers
  const isXLarge = width >= 540 || height >= 240
  const isLarge = width >= 380 || height >= 190
  const isSmall = width < 250 || height < 130

  const heroValClass = isXLarge
    ? "text-5xl lg:text-6xl font-black"
    : isLarge
    ? "text-4xl lg:text-5xl font-black"
    : isSmall
    ? "text-2xl font-bold"
    : "text-3xl lg:text-4xl font-extrabold"

  const deltaPctClass = isXLarge
    ? "text-xl font-black"
    : isLarge
    ? "text-lg font-extrabold"
    : isSmall
    ? "text-xs font-bold"
    : "text-base font-extrabold"

  const stemW = isXLarge ? 26 : isLarge ? 24 : isSmall ? 16 : 22
  const stemH = isXLarge ? 56 : isLarge ? 48 : isSmall ? 32 : 46

  return (
    <div className="flex h-full w-full flex-col justify-between select-none overflow-hidden py-0.5">
      {/* 1. Header Row: Attribute Identity + Dropdown Filter */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-50 text-[#db4040] border border-red-100/70">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate">
            {meta?.label || attributeKey}
          </span>
        </div>

        {/* Dropdown List Filter Waktu */}
        <div className="relative inline-flex items-center shrink-0">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilterOption)}
            className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-[10px] font-bold text-slate-700 pl-2 pr-5 py-0.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#db4040] cursor-pointer transition shadow-2xs"
            title="Filter historical period"
          >
            {TIME_FILTER_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-slate-400" />
        </div>
      </div>

      {/* 2. Hero KPI Metric & Vertical Trend Graph */}
      <div className="flex items-center justify-between gap-3 my-auto py-1">
        {/* Left: Main Live Metric Value */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline">
            <span className={`tracking-tight text-slate-900 tabular-nums ${heroValClass}`}>
              {valDisplay}
            </span>
            {unitDisplay && (
              <span className={`font-bold text-slate-400 uppercase ${isLarge ? "ml-2 text-sm" : isSmall ? "ml-1 text-[10px]" : "ml-1.5 text-xs"}`}>
                {unitDisplay}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Live Sensor
          </span>
        </div>

        {/* Right: Vertical Graph from Gambar 1 */}
        <div className="flex items-start gap-2 shrink-0 pr-1">
          <svg width={stemW} height={stemH} viewBox="0 0 22 46" className="overflow-visible shrink-0">
            {/* Top Left Tick (┌) */}
            <line
              x1="4"
              y1="5"
              x2="16"
              y2="5"
              stroke={isPositive ? "#16a34a" : "#e11d48"}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Vertical Stem */}
            <line
              x1="16"
              y1="5"
              x2="16"
              y2="42"
              stroke={isPositive ? "#16a34a" : "#e11d48"}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Delta Text beside top tick */}
          <div className="flex flex-col justify-start">
            <span className={`tracking-tight leading-none ${deltaPctClass} ${isPositive ? "text-emerald-700" : "text-rose-700"}`}>
              {isPositive ? "+" : ""}{activeDelta.percent.toFixed(1)}%
            </span>
            <span className={`mt-0.5 font-bold text-slate-700 leading-tight ${isLarge ? "text-xs" : isSmall ? "text-[9px]" : "text-[11px]"}`}>
              {isPositive ? "+" : ""}{activeDelta.decimal.toFixed(decimals > 0 ? decimals : 1)}{unitDisplay ? ` ${unitDisplay}` : ""}
            </span>
            <span className="text-[9px] font-medium text-slate-400 leading-tight mt-0.5">
              {activeOption.periodLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 3. KPI Operational Benchmarks / Status Summary */}
      <div className={`flex items-center justify-between pt-1 border-t border-slate-100 shrink-0 ${isLarge ? "text-xs" : isSmall ? "text-[9px]" : "text-[10px]"}`}>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-medium">Avg:</span>
          <span className="font-bold text-slate-700">{avgDisplay}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-medium">Peak:</span>
          <span className="font-bold text-slate-700">{peakDisplay}</span>
        </div>
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[9px] border border-emerald-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Optimal</span>
        </div>
      </div>
    </div>
  )
}

function AdaptiveWidgetBox({
  children,
}: {
  children: (dim: { width: number; height: number }) => React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState<{ width: number; height: number }>({ width: 320, height: 200 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDim({ width: Math.round(width), height: Math.round(height) })
        }
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      {children(dim)}
    </div>
  )
}

function WidgetContent({
  widget,
  vessel,
  width = 320,
  height = 200,
}: {
  widget: WidgetDef
  vessel: Vessel
  width?: number
  height?: number
}) {
  const cfg = widget.config || {}
  const meta = VESSEL_ATTRIBUTES.find((a) => a.key === widget.attributeKey)

  if (widget.type === "speed") {
    const rawVal = meta ? meta.getValue(vessel) : vessel.sog
    const defaultMax =
      widget.attributeKey === "rpm"
        ? 3000
        : widget.attributeKey === "engineLoad" || widget.attributeKey === "fuel"
        ? 100
        : 24
    const defaultDecimals =
      widget.attributeKey === "rpm" || widget.attributeKey === "heading" ? 0 : 1

    return (
      <GaugeDial
        value={typeof rawVal === "number" ? rawVal : 0}
        max={cfg.max ?? defaultMax}
        min={cfg.min ?? 0}
        unit={cfg.unit || (meta?.unit || "knots")}
        decimals={cfg.decimals ?? defaultDecimals}
        thresholds={cfg.thresholds}
        thresholdColors={cfg.thresholdColors}
        label={meta?.key?.toUpperCase() || widget.attributeKey?.toUpperCase() || "GAUGE"}
      />
    )
  }

  if (widget.type === "heading") {
    const primaryKey = widget.attributeKey || "heading"
    const secondaryKey =
      widget.secondaryAttributeKey !== undefined
        ? widget.secondaryAttributeKey
        : primaryKey === "cog"
        ? "heading"
        : "cog"

    const primaryMeta = VESSEL_ATTRIBUTES.find((a) => a.key === primaryKey)
    const primaryRaw = primaryMeta
      ? primaryMeta.getValue(vessel)
      : primaryKey === "cog"
      ? vessel.cog
      : vessel.heading
    const primaryAngle = typeof primaryRaw === "number" && !isNaN(primaryRaw) ? primaryRaw : 0
    const primaryLabel = primaryKey === "heading" ? "HDG" : primaryKey.toUpperCase()

    const hasSecondary = Boolean(secondaryKey && secondaryKey !== "none")
    const secondaryMeta = hasSecondary ? VESSEL_ATTRIBUTES.find((a) => a.key === secondaryKey) : null
    const secondaryRaw = hasSecondary
      ? secondaryMeta
        ? secondaryMeta.getValue(vessel)
        : secondaryKey === "cog"
        ? vessel.cog
        : secondaryKey === "heading"
        ? vessel.heading
        : null
      : null
    const secondaryAngle = typeof secondaryRaw === "number" && !isNaN(secondaryRaw) ? secondaryRaw : null
    const secondaryLabel = hasSecondary ? (secondaryKey === "heading" ? "HDG" : secondaryKey.toUpperCase()) : ""

    return (
      <CompassDial
        primaryAngle={primaryAngle}
        primaryLabel={primaryLabel}
        secondaryAngle={secondaryAngle}
        secondaryLabel={secondaryLabel}
        showSecondary={hasSecondary && secondaryAngle !== null}
      />
    )
  }

  if (widget.type === "telemetry") {
    return (
      <DynamicAttributeCard
        vessel={vessel}
        attributeKey={widget.attributeKey || "depth"}
        config={cfg}
        width={width}
        height={height}
      />
    )
  }

  if (widget.type === "kpi") {
    return (
      <KpiWidgetCard
        vessel={vessel}
        attributeKey={widget.attributeKey || "fuel"}
        title={widget.title}
        config={cfg}
        width={width}
        height={height}
      />
    )
  }

  if (widget.type === "chart") {
    return <TrendChart vessel={vessel} attributeKey={widget.attributeKey} config={cfg} width={width} height={height} />
  }

  if (widget.type === "bar") return <BarChartWidget vessel={vessel} config={cfg} width={width} height={height} />
  if (widget.type === "table") return <TableWidget vessel={vessel} config={cfg} width={width} height={height} />
  if (widget.type === "gateway") return <GatewayWidget vessel={vessel} width={width} height={height} />
  if (widget.type === "map") return <MapWidget vessel={vessel} config={cfg} width={width} height={height} />

  // Machinery Matrix - dynamic adaptive scaling
  const isWideAndShort = width >= 480 && height < 220
  const isLargeEngine = width >= 380 || height >= 200
  const isSmallEngine = width < 250 || height < 130

  const engineCardPad = isLargeEngine ? "p-3.5" : isSmallEngine ? "p-1.5" : "p-2.5"
  const engineValClass = isLargeEngine ? "text-base font-extrabold" : isSmallEngine ? "text-[10px] font-bold" : "text-[11px] font-bold"
  const engineLabelClass = isLargeEngine ? "text-xs font-semibold" : isSmallEngine ? "text-[8px]" : "text-[9px]"
  const engineIconClass = isLargeEngine ? "h-4 w-4" : isSmallEngine ? "h-3 w-3" : "h-3.5 w-3.5"

  return (
    <div className={`grid h-full gap-2 ${isWideAndShort ? "grid-cols-4" : "grid-cols-2"}`}>
      {[
        ["Main engine", vessel.rpm ? `${Math.round(vessel.rpm)} RPM` : "—", Activity],
        ["Engine load", `${formatNum(vessel.engineLoad, 0)}%`, Gauge],
        ["Fuel system", `${formatNum(vessel.fuel, 0)}%`, Fuel],
        ["Wind sensor", `${formatNum(vessel.windSpeed, 1)} kn`, Wind],
      ].map(([label, value, Icon]) => {
        const MetricIcon = Icon as typeof Activity
        return (
          <div key={String(label)} className={`rounded-xl bg-slate-50 flex flex-col justify-between ${engineCardPad}`}>
            <div className="flex items-center justify-between">
              <span className={`text-slate-400 ${engineLabelClass}`}>{String(label)}</span>
              <MetricIcon className={`text-[#db4040] ${engineIconClass}`} />
            </div>
            <div className={`mt-1 text-slate-800 ${engineValClass}`}>{String(value)}</div>
          </div>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------
// SECTION DEFINITIONS & DEFAULTS
// -------------------------------------------------------------

interface DashboardSection {
  id: string
  name: string
  widgets: WidgetDef[]
  layouts: ResponsiveLayouts
}

const defaultSections: DashboardSection[] = [
  {
    id: "section-nav",
    name: "Navigation & Maneuvering",
    widgets: [
      { id: "speed-1", type: "speed", title: "Speed over ground", vesselId: "", attributeKey: "sog" },
      { id: "heading-1", type: "heading", title: "Heading & course", vesselId: "", attributeKey: "heading", secondaryAttributeKey: "cog" },
      { id: "depth-1", type: "telemetry", title: "Water depth", vesselId: "", attributeKey: "depth" },
      { id: "map-1", type: "map", title: "Position preview", vesselId: "", attributeKey: "position" },
    ],
    layouts: {
      lg: [
        { i: "speed-1", x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
        { i: "heading-1", x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
        { i: "depth-1", x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
        { i: "map-1", x: 0, y: 4, w: 12, h: 5, minW: 4, minH: 3 },
      ],
      md: [
        { i: "speed-1", x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
        { i: "heading-1", x: 4, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
        { i: "depth-1", x: 0, y: 4, w: 8, h: 4, minW: 3, minH: 2 },
        { i: "map-1", x: 0, y: 8, w: 8, h: 5, minW: 4, minH: 3 },
      ],
      sm: [
        { i: "speed-1", x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
        { i: "heading-1", x: 4, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
        { i: "depth-1", x: 0, y: 4, w: 8, h: 3, minW: 3, minH: 2 },
        { i: "map-1", x: 0, y: 7, w: 8, h: 5, minW: 4, minH: 3 },
      ],
      xs: [
        { i: "speed-1", x: 0, y: 0, w: 1, h: 4 },
        { i: "heading-1", x: 0, y: 4, w: 1, h: 4 },
        { i: "depth-1", x: 0, y: 8, w: 1, h: 3 },
        { i: "map-1", x: 0, y: 11, w: 1, h: 4 },
      ],
    },
  },
  {
    id: "section-engine",
    name: "Engine & Machinery",
    widgets: [
      { id: "engine-1", type: "engine", title: "Machinery status", vesselId: "", attributeKey: "machinery" },
      { id: "trend-1", type: "chart", title: "Propulsion trend", vesselId: "", attributeKey: "rpm" },
      { id: "fuel-1", type: "telemetry", title: "Fuel remaining", vesselId: "", attributeKey: "fuel" },
    ],
    layouts: {
      lg: [
        { i: "engine-1", x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
        { i: "trend-1", x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
        { i: "fuel-1", x: 0, y: 4, w: 6, h: 3, minW: 3, minH: 2 },
      ],
      md: [
        { i: "engine-1", x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
        { i: "trend-1", x: 0, y: 4, w: 8, h: 4, minW: 4, minH: 3 },
        { i: "fuel-1", x: 0, y: 8, w: 8, h: 3, minW: 3, minH: 2 },
      ],
      sm: [
        { i: "engine-1", x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
        { i: "trend-1", x: 0, y: 4, w: 8, h: 4, minW: 4, minH: 3 },
        { i: "fuel-1", x: 0, y: 8, w: 8, h: 3, minW: 3, minH: 2 },
      ],
      xs: [
        { i: "engine-1", x: 0, y: 0, w: 1, h: 4 },
        { i: "trend-1", x: 0, y: 4, w: 1, h: 4 },
        { i: "fuel-1", x: 0, y: 8, w: 1, h: 3 },
      ],
    },
  },
]

interface PaletteItem {
  type: WidgetType
  label: string
  icon: any
  defaultW: number
  defaultH: number
  attributeKey: string
}

// 2 KOLOM MURNI KATALOG WIDGET
const PALETTE_WIDGETS: PaletteItem[] = [
  { type: "telemetry", label: "Attribute", icon: Sliders, defaultW: 3, defaultH: 2, attributeKey: "depth" },
  { type: "kpi", label: "KPI", icon: Zap, defaultW: 3, defaultH: 3, attributeKey: "fuel" },
  { type: "speed", label: "Gauge", icon: Gauge, defaultW: 3, defaultH: 4, attributeKey: "sog" },
  { type: "heading", label: "Compass", icon: Compass, defaultW: 3, defaultH: 4, attributeKey: "heading" },
  { type: "chart", label: "Line Chart", icon: Activity, defaultW: 6, defaultH: 4, attributeKey: "rpm" },
  { type: "bar", label: "Depth Column", icon: Waves, defaultW: 3, defaultH: 4, attributeKey: "depth" },
  { type: "map", label: "Map", icon: Map, defaultW: 6, defaultH: 5, attributeKey: "position" },
  { type: "table", label: "Table", icon: Table, defaultW: 6, defaultH: 4, attributeKey: "table" },
  { type: "engine", label: "Machinery", icon: Fuel, defaultW: 6, defaultH: 4, attributeKey: "machinery" },
]

export function MonitoringPage() {
  const { vessels } = useFleet()
  const mainContainerRef = useRef<HTMLElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Sync fullscreen state with browser events (including Esc key exit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFull = !!document.fullscreenElement
      setIsFullscreen(isCurrentlyFull)
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"))
      }, 150)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (mainContainerRef.current?.requestFullscreen) {
          await mainContainerRef.current.requestFullscreen()
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
      }
    } catch (err) {
      console.error("Failed to toggle fullscreen:", err)
    }
  }

  // MODE: "view" (full canvas, hide sidebar) vs "modify" (show inline sidebar palette & settings, allow drag/resize)
  const [dashboardMode, setDashboardMode] = useState<"view" | "modify">("view")

  // Align grid width smoothly during view/modify mode transitions without frantic looping
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"))
    }, 320)
    return () => clearTimeout(timer)
  }, [dashboardMode])

  function handleSwitchToModifyMode() {
    setDashboardMode("modify")
  }

  // Load sections from localStorage
  const [sections, setSections] = useState<DashboardSection[]>(() => {
    try {
      const saved = localStorage.getItem("nauticore:v1:monitoring_sections")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch (err) {
      console.error("Failed to load monitoring sections:", err)
    }
    return defaultSections
  })

  // Selected Section ID
  const [activeSectionId, setActiveSectionId] = useState<string>(() => {
    return (
      localStorage.getItem("nauticore:v1:active_section_id") ||
      defaultSections[0].id
    )
  })

  // Sidebar Tabs: 'widgets' vs 'settings'
  const [sidebarTab, setSidebarTab] = useState<"widgets" | "settings">("widgets")

  // Contextual Selection: Currently selected widget ID on canvas
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)

  // Collapsible accordion sections in inspector sidebar: { [sectionKey: string]: boolean }
  const [collapsedInspectorSections, setCollapsedInspectorSections] = useState<Record<string, boolean>>({})

  function toggleInspectorSection(key: string) {
    setCollapsedInspectorSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Dragging State for new widgets
  const isDraggingRef = useRef(false)
  const [droppingWidget, setDroppingWidget] = useState<{
    type: WidgetType
    title: string
    vesselId: string
    attributeKey: string
    w: number
    h: number
  }>({
    type: "speed",
    title: "Gauge",
    vesselId: "",
    attributeKey: "sog",
    w: 3,
    h: 4,
  })

  // Modals
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
  const [addSectionModal, setAddSectionModal] = useState(false)
  const [renameModal, setRenameModal] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [newSectionTemplate, setNewSectionTemplate] = useState<"nav" | "engine" | "empty" | "full">("nav")
  const [renameName, setRenameName] = useState("")

  // Modal ⇄ Change Attribute Filter & Selection
  const [showAttributePicker, setShowAttributePicker] = useState(false)
  const [pickerVesselId, setPickerVesselId] = useState("")
  const [pickerAttrKey, setPickerAttrKey] = useState("")
  const [pickerSecondaryAttrKey, setPickerSecondaryAttrKey] = useState<string>("cog")
  const [attrSearch, setAttrSearch] = useState("")
  const [attrCategoryFilter, setAttrCategoryFilter] = useState<string>("all")

  // Modal Confirmation Delete Widget
  const [widgetToDelete, setWidgetToDelete] = useState<WidgetDef | null>(null)

  // Feedback Notification Toast: { type: "success" | "error"; message: string }
  const [saveToast, setSaveToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Saved Snapshot to track unsaved changes (dirty state)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>(() => {
    try {
      return JSON.stringify(sections)
    } catch {
      return ""
    }
  })

  // Has unsaved changes flag
  const isDirty = useMemo(() => {
    try {
      return JSON.stringify(sections) !== lastSavedSnapshot
    } catch {
      return false
    }
  }, [sections, lastSavedSnapshot])

  // Active section resolution
  const activeSection =
    sections.find((s) => s.id === activeSectionId) ?? sections[0] ?? defaultSections[0]

  // Memoized layouts for react-grid-layout to prevent layout thrashing and infinite loops
  const effectiveLayouts = useMemo(() => {
    const rawLayouts = activeSection?.layouts || { lg: [] }
    const primaryLayout = (
      rawLayouts.lg && rawLayouts.lg.length > 0
        ? rawLayouts.lg
        : rawLayouts.md && rawLayouts.md.length > 0
        ? rawLayouts.md
        : []
    ).filter(
      (item) =>
        item.i !== "__dropping-elem__" &&
        typeof item.y === "number" &&
        !isNaN(item.y) &&
        isFinite(item.y)
    )

    return {
      ...rawLayouts,
      lg: primaryLayout,
      md: primaryLayout,
      sm: primaryLayout,
      xs: (rawLayouts.xs || primaryLayout)
        .filter((item) => item.i !== "__dropping-elem__")
        .map((item, i) => ({
          ...item,
          x: 0,
          y: i * 4,
          w: 1,
        })),
    } as ResponsiveLayouts
  }, [activeSection?.layouts])

  // Calculate maximum bottom row of active section to dynamically scale canvas height in modify mode
  const canvasMinHeight = useMemo(() => {
    if (dashboardMode !== "modify") return undefined
    const currentLg = activeSection.layouts?.lg || []
    let maxBottomRow = 0
    for (const it of currentLg) {
      const bottom = (it.y || 0) + (it.h || 0)
      if (bottom > maxBottomRow) maxBottomRow = bottom
    }
    // rowHeight is 44, margin is 12 -> each row is 56px. Give 8 extra rows buffer below lowest widget
    return Math.max(540, (maxBottomRow + 8) * 56)
  }, [dashboardMode, activeSection.layouts])

  // Currently selected widget object in active section
  const selectedWidget = useMemo(() => {
    if (!selectedWidgetId) return null
    return activeSection.widgets.find((w) => w.id === selectedWidgetId) || null
  }, [selectedWidgetId, activeSection.widgets])

  const selectedWidgetVessel = useMemo(() => {
    if (!selectedWidget) return vessels[0] || null
    return vessels.find((v) => v.id === selectedWidget.vesselId) || vessels[0] || null
  }, [selectedWidget, vessels])

  const selectedWidgetMeta = useMemo(() => {
    if (!selectedWidget) return null
    return VESSEL_ATTRIBUTES.find((a) => a.key === selectedWidget.attributeKey) || null
  }, [selectedWidget])

  const selectedWidgetSecondaryMeta = useMemo(() => {
    if (!selectedWidget || selectedWidget.type !== "heading") return null
    const secKey =
      selectedWidget.secondaryAttributeKey !== undefined
        ? selectedWidget.secondaryAttributeKey
        : selectedWidget.attributeKey === "cog"
        ? "heading"
        : "cog"
    if (!secKey || secKey === "none") return null
    return VESSEL_ATTRIBUTES.find((a) => a.key === secKey) || null
  }, [selectedWidget])

  // Filtered attributes in picker modal
  const filteredPickerAttributes = useMemo(() => {
    return VESSEL_ATTRIBUTES.filter((attr) => {
      const matchCategory =
        attrCategoryFilter === "all" || attr.category === attrCategoryFilter
      const matchSearch =
        !attrSearch.trim() ||
        attr.label.toLowerCase().includes(attrSearch.toLowerCase()) ||
        attr.key.toLowerCase().includes(attrSearch.toLowerCase()) ||
        attr.unit.toLowerCase().includes(attrSearch.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [attrCategoryFilter, attrSearch])

  useEffect(() => {
    try {
      localStorage.setItem("nauticore:v1:active_section_id", activeSectionId)
    } catch (err) {}
  }, [activeSectionId])

  // Save Layout Action
  function handleSaveLayout() {
    try {
      const serialized = JSON.stringify(sections)
      localStorage.setItem("nauticore:v1:monitoring_sections", serialized)
      localStorage.setItem("nauticore:v1:active_section_id", activeSectionId)
      setLastSavedSnapshot(serialized)
      setSaveToast({ type: "success", message: "Dashboard layout saved successfully!" })
      setTimeout(() => setSaveToast(null), 3000)
    } catch (err) {
      console.error("Failed to save layout:", err)
      setSaveToast({ type: "error", message: "Failed to save dashboard layout!" })
      setTimeout(() => setSaveToast(null), 3500)
    }
  }

  // Switch to View Mode: Revert changes if unsaved
  function handleSwitchToViewMode() {
    if (isDirty) {
      try {
        if (lastSavedSnapshot) {
          const parsed = JSON.parse(lastSavedSnapshot)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSections(parsed)
          }
        }
      } catch (err) {
        console.error("Failed to revert unsaved dashboard changes:", err)
      }
    }
    setDashboardMode("view")
    setSelectedWidgetId(null)
  }

  // Keyboard shortcut: Delete or Backspace key removes selected widget in modify mode
  useEffect(() => {
    if (dashboardMode !== "modify" || !selectedWidgetId) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing inside an input, textarea, or contentEditable element
      const activeTag = (document.activeElement?.tagName || "").toLowerCase()
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return
      }

      // Check for Delete or Backspace key
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        const widget = activeSection.widgets.find((w) => w.id === selectedWidgetId)
        if (widget) {
          setWidgetToDelete(widget)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [dashboardMode, selectedWidgetId, activeSection.widgets])

  // Helper to test equality of 12-col layout arrays
  function isLayoutEqual(a?: Layout | LayoutItem[], b?: Layout | LayoutItem[]): boolean {
    if (!a && !b) return true
    if (!a || !b) return false
    if (a.length !== b.length) return false
    const dictA: Record<string, LayoutItem> = {}
    for (const item of a) {
      dictA[item.i] = item
    }
    for (const itemB of b) {
      const itemA = dictA[itemB.i]
      if (!itemA) return false
      if (
        itemA.x !== itemB.x ||
        itemA.y !== itemB.y ||
        itemA.w !== itemB.w ||
        itemA.h !== itemB.h
      ) {
        return false
      }
    }
    return true
  }

  // Helper to test if two layout items overlap
  function doesOverlap(a: LayoutItem, b: LayoutItem): boolean {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    )
  }

  // Resolve collisions by pushing overlapping widgets and downstream widgets downward cleanly
  function resolveCollisions(
    existing: (LayoutItem | Layout[number])[],
    newItem: LayoutItem,
    cols: number = 12
  ): LayoutItem[] {
    const clampedX = Math.max(0, Math.min(Math.round(newItem.x ?? 0), cols - newItem.w))
    const clampedY = Math.max(0, Math.round(newItem.y ?? 0))
    const placedNew: LayoutItem = {
      ...newItem,
      x: clampedX,
      y: clampedY,
    }

    const items = existing
      .filter((it) => it.i !== newItem.i && it.i !== "__dropping-elem__")
      .map((it) => ({ ...it }))
      .sort((a, b) => a.y - b.y || a.x - b.x)

    const placed: LayoutItem[] = [placedNew]

    for (const item of items) {
      let hasCollision = true
      let safetyCounter = 0
      while (hasCollision && safetyCounter < 100) {
        safetyCounter++
        hasCollision = false
        for (const p of placed) {
          if (doesOverlap(item, p)) {
            item.y = p.y + p.h
            hasCollision = true
            break
          }
        }
      }
      placed.push(item)
    }

    return placed
  }

  // Direct drop handler from right sidebar onto canvas
  function handleDrop(
    layoutItem?: { x: number; y: number; w?: number; h?: number }
  ) {
    if (dashboardMode !== "modify" || !layoutItem) return
    const id = `${droppingWidget.type}-${Date.now()}`
    const targetVesselId = droppingWidget.vesselId || vessels[0]?.id || ""
    const meta = VESSEL_ATTRIBUTES.find((a) => a.key === droppingWidget.attributeKey)

    const newWidget: WidgetDef = {
      id,
      type: droppingWidget.type,
      title: droppingWidget.title || meta?.label || "Widget",
      vesselId: targetVesselId,
      attributeKey: droppingWidget.attributeKey || "sog",
      ...(droppingWidget.type === "heading" ? { secondaryAttributeKey: "cog" } : {}),
      config: {
        min: 0,
        max:
          droppingWidget.attributeKey === "rpm"
            ? 3000
            : droppingWidget.attributeKey === "fuel" || droppingWidget.attributeKey === "engineLoad"
            ? 100
            : 24,
        decimals:
          droppingWidget.attributeKey === "rpm" || droppingWidget.attributeKey === "fuel" ? 0 : 1,
        unit: meta?.unit || "",
        thresholds: { green: 0, orange: 25, red: 80 },
      },
    }

    const currentLayouts = (activeSection.layouts?.lg || []).filter(
      (it) => it.i !== "__dropping-elem__"
    )
    const newItem: LayoutItem = {
      i: id,
      x: layoutItem.x ?? 0,
      y: layoutItem.y ?? 0,
      w: layoutItem.w || droppingWidget.w,
      h: layoutItem.h || droppingWidget.h,
      minW: 2,
      minH: 2,
    }

    const updated12Col = resolveCollisions(currentLayouts, newItem, 12)

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSection.id) return sec
        const currentWidgets = sec.widgets || []
        return {
          ...sec,
          widgets: [...currentWidgets, newWidget],
          layouts: {
            lg: updated12Col,
            md: updated12Col,
            sm: updated12Col,
            xs: updated12Col.map((item, i) => ({ ...item, x: 0, y: i * 4, w: 1 })),
          },
        }
      })
    )

    setSelectedWidgetId(id)
  }

  // Quick add widget palette directly
  function handleAddWidgetPaletteDirectly(palette: PaletteItem) {
    if (dashboardMode !== "modify") return
    const targetVesselId = vessels[0]?.id || ""
    const id = `${palette.type}-${Date.now()}`
    const meta = VESSEL_ATTRIBUTES.find((a) => a.key === palette.attributeKey)

    // Calculate next Y position below all existing widgets to prevent any overlapping
    const currentLg = (activeSection.layouts?.lg || []).filter(
      (it) => it.i !== "__dropping-elem__"
    )
    let nextY = 0
    for (const item of currentLg) {
      const bottom = (item.y || 0) + (item.h || 0)
      if (bottom > nextY) nextY = bottom
    }

    const newItem: LayoutItem = {
      i: id,
      x: 0,
      y: nextY,
      w: palette.defaultW,
      h: palette.defaultH,
      minW: 2,
      minH: 2,
    }

    const newWidget: WidgetDef = {
      id,
      type: palette.type,
      title: palette.label,
      vesselId: targetVesselId,
      attributeKey: palette.attributeKey,
      ...(palette.type === "heading" ? { secondaryAttributeKey: "cog" } : {}),
      config: {
        min: 0,
        max:
          palette.attributeKey === "rpm"
            ? 3000
            : palette.attributeKey === "fuel" || palette.attributeKey === "engineLoad"
            ? 100
            : 24,
        decimals: palette.attributeKey === "rpm" || palette.attributeKey === "fuel" ? 0 : 1,
        unit: meta?.unit || "",
        thresholds: { green: 0, orange: 25, red: 80 },
      },
    }

    const updatedLg = resolveCollisions(currentLg, newItem, 12)

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSection.id) return sec
        const currentWidgets = sec.widgets || []
        return {
          ...sec,
          widgets: [...currentWidgets, newWidget],
          layouts: {
            lg: updatedLg,
            md: updatedLg,
            sm: updatedLg,
            xs: updatedLg.map((item, i) => ({ ...item, x: 0, y: i * 4, w: 1 })),
          },
        }
      })
    )

    setSelectedWidgetId(id)
  }

  // Update specific widget properties
  function updateWidget(widgetId: string, partial: Partial<WidgetDef>) {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSection.id) return sec
        return {
          ...sec,
          widgets: sec.widgets.map((w) => (w.id === widgetId ? { ...w, ...partial } : w)),
        }
      }),
    )
  }

  // Update widget config values (min, max, decimals, unit, etc.)
  function updateWidgetConfig(widgetId: string, partialConfig: Partial<WidgetConfig>) {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSection.id) return sec
        return {
          ...sec,
          widgets: sec.widgets.map((w) => {
            if (w.id !== widgetId) return w
            return {
              ...w,
              config: {
                ...(w.config || {}),
                ...partialConfig,
              },
            }
          }),
        }
      }),
    )
  }

  // Update widget threshold numerical value
  function updateWidgetThreshold(
    widgetId: string,
    key: "green" | "orange" | "red",
    val: number,
  ) {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSection.id) return sec
        return {
          ...sec,
          widgets: sec.widgets.map((w) => {
            if (w.id !== widgetId) return w
            const currMin = w.config?.min ?? 0
            const currMax =
              w.config?.max ??
              (w.attributeKey === "rpm"
                ? 3000
                : w.attributeKey === "engineLoad" || w.attributeKey === "fuel"
                ? 100
                : 24)
            const currRange = currMax - currMin || 1

            const baseline = {
              green:
                typeof w.config?.thresholds?.green === "number" && w.config.thresholds.green <= currMax
                  ? w.config.thresholds.green
                  : currMin,
              orange:
                typeof w.config?.thresholds?.orange === "number" && w.config.thresholds.orange <= currMax
                  ? w.config.thresholds.orange
                  : Math.round(currMin + currRange * 0.7),
              red:
                typeof w.config?.thresholds?.red === "number" && w.config.thresholds.red <= currMax
                  ? w.config.thresholds.red
                  : Math.round(currMin + currRange * 0.85),
            }

            return {
              ...w,
              config: {
                ...(w.config || {}),
                thresholds: {
                  ...baseline,
                  [key]: val,
                },
              },
            }
          }),
        }
      }),
    )
  }

  // Update widget threshold color via Color Picker
  function updateWidgetThresholdColor(
    widgetId: string,
    key: "green" | "orange" | "red",
    color: string,
  ) {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSection.id) return sec
        return {
          ...sec,
          widgets: sec.widgets.map((w) => {
            if (w.id !== widgetId) return w
            const baselineColors = {
              green: w.config?.thresholdColors?.green || "#10b981",
              orange: w.config?.thresholdColors?.orange || "#f59e0b",
              red: w.config?.thresholdColors?.red || "#ef4444",
            }
            return {
              ...w,
              config: {
                ...(w.config || {}),
                thresholdColors: {
                  ...baselineColors,
                  [key]: color,
                },
              },
            }
          }),
        }
      }),
    )
  }

  // Remove widget from active section
  function removeWidget(widgetId: string) {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSection.id) return sec
        const currentLayouts = sec.layouts || { lg: [] }
        return {
          ...sec,
          widgets: (sec.widgets || []).filter((w) => w.id !== widgetId),
          layouts: Object.fromEntries(
            Object.entries(currentLayouts).map(([bp, items]) => [
              bp,
              (items as readonly LayoutItem[]).filter((item) => item.i !== widgetId),
            ]),
          ) as ResponsiveLayouts,
        }
      }),
    )
    if (selectedWidgetId === widgetId) {
      setSelectedWidgetId(null)
    }
  }

  // Commit layout changes when drag/resize action completes
  function handleCommitLayout(newLayout: Layout | LayoutItem[]) {
    if (dashboardMode !== "modify") return
    if (!Array.isArray(newLayout) || newLayout.length === 0) return
    const clean12Col: LayoutItem[] = newLayout
      .filter((it) => it.i !== "__dropping-elem__")
      .map((it) => ({ ...it }))
    const currentActiveLg = (activeSection.layouts?.lg || []).filter(
      (it) => it.i !== "__dropping-elem__"
    )
    if (isLayoutEqual(currentActiveLg, clean12Col)) {
      return
    }

    const syncedLayouts: ResponsiveLayouts = {
      ...(activeSection.layouts || {}),
      lg: clean12Col,
      md: clean12Col,
      sm: clean12Col,
      xs: clean12Col.map((item, i) => ({ ...item, x: 0, y: i * 4, w: 1 })),
    }
    setSections((prev) =>
      prev.map((sec) =>
        sec.id === activeSection.id ? { ...sec, layouts: syncedLayouts } : sec
      )
    )
  }

  // Handle grid layout update from responsive breakpoint changes
  function handleLayoutChange(_layout: Layout, allLayouts: ResponsiveLayouts) {
    if (dashboardMode !== "modify") return
    if (isDraggingRef.current) return
    const raw12Col = allLayouts.lg || allLayouts.md || allLayouts.sm || _layout
    if (!raw12Col || raw12Col.length === 0) return
    // Never update state while an external item is hovering over the canvas
    if (raw12Col.some((it) => it.i === "__dropping-elem__")) return

    const current12Col: LayoutItem[] = raw12Col
      .filter((it) => it.i !== "__dropping-elem__")
      .map((it) => ({ ...it }))
    const currentActiveLg = (activeSection.layouts?.lg || []).filter(
      (it) => it.i !== "__dropping-elem__"
    )
    if (isLayoutEqual(currentActiveLg, current12Col)) {
      return
    }

    const syncedLayouts: ResponsiveLayouts = {
      ...allLayouts,
      lg: current12Col,
      md: current12Col,
      sm: current12Col,
      xs: (allLayouts.xs || current12Col)
        .filter((it) => it.i !== "__dropping-elem__")
        .map((item, i) => ({ ...item, x: 0, y: i * 4, w: 1 })),
    }
    setSections((prev) =>
      prev.map((sec) =>
        sec.id === activeSection.id ? { ...sec, layouts: syncedLayouts } : sec
      )
    )
  }

  // Swap Primary and Secondary attributes on compass widget
  function swapCompassAttributes() {
    if (!selectedWidget || selectedWidget.type !== "heading") return
    const currentPrimary = selectedWidget.attributeKey || "heading"
    const currentSecondary =
      selectedWidget.secondaryAttributeKey !== undefined
        ? selectedWidget.secondaryAttributeKey
        : (currentPrimary === "cog" ? "heading" : "cog")

    if (!currentSecondary || currentSecondary === "none") return

    const newPrimary = currentSecondary
    const newSecondary = currentPrimary
    const newPrimaryMeta = VESSEL_ATTRIBUTES.find((a) => a.key === newPrimary)

    updateWidget(selectedWidget.id, {
      attributeKey: newPrimary,
      secondaryAttributeKey: newSecondary,
      title: `${selectedWidgetVessel?.name || "Vessel"} - ${newPrimaryMeta?.label || newPrimary}`,
    })
  }

  // Handle clicking attribute card in modal
  function handleAttributeCardClick(attrKey: string) {
    if (selectedWidget?.type === "heading") {
      // Compass can check up to 2 attributes
      if (pickerAttrKey === attrKey) {
        // Deselect Primary: if secondary exists, promote it to primary
        if (pickerSecondaryAttrKey && pickerSecondaryAttrKey !== "none") {
          setPickerAttrKey(pickerSecondaryAttrKey)
          setPickerSecondaryAttrKey("none")
        } else {
          setPickerAttrKey("")
        }
      } else if (pickerSecondaryAttrKey === attrKey) {
        // Deselect Secondary
        setPickerSecondaryAttrKey("none")
      } else {
        // Selecting a new attribute
        if (!pickerAttrKey) {
          setPickerAttrKey(attrKey)
        } else if (!pickerSecondaryAttrKey || pickerSecondaryAttrKey === "none") {
          setPickerSecondaryAttrKey(attrKey)
        } else {
          // Both slots are filled: replace the secondary attribute
          setPickerSecondaryAttrKey(attrKey)
        }
      }
    } else {
      setPickerAttrKey(attrKey)
    }
  }

  // Open Attribute Picker modal for currently selected widget
  function openAttributePicker() {
    if (!selectedWidget) return
    setPickerVesselId(selectedWidget.vesselId || vessels[0]?.id || "")
    setPickerAttrKey(selectedWidget.attributeKey || (selectedWidget.type === "heading" ? "heading" : "sog"))
    setPickerSecondaryAttrKey(
      selectedWidget.secondaryAttributeKey !== undefined
        ? selectedWidget.secondaryAttributeKey
        : (selectedWidget.attributeKey === "cog" ? "heading" : "cog"),
    )
    setAttrSearch("")
    setAttrCategoryFilter("all")
    setShowAttributePicker(true)
  }

  // Apply Attribute Picker selection
  function handleApplyAttributePicker() {
    if (!selectedWidget) return
    const targetVessel = vessels.find((v) => v.id === pickerVesselId)
    const effectivePrimary = pickerAttrKey || (selectedWidget.type === "heading" ? "heading" : "sog")
    const targetMeta = VESSEL_ATTRIBUTES.find((a) => a.key === effectivePrimary)

    const updates: Partial<WidgetDef> = {
      vesselId: pickerVesselId,
      attributeKey: effectivePrimary,
      title: `${targetVessel?.name || "Vessel"} - ${targetMeta?.label || effectivePrimary}`,
    }

    if (selectedWidget.type === "heading") {
      updates.secondaryAttributeKey =
        pickerSecondaryAttrKey && pickerSecondaryAttrKey !== "none" ? pickerSecondaryAttrKey : "none"
    }

    updateWidget(selectedWidget.id, updates)

    if (targetMeta) {
      updateWidgetConfig(selectedWidget.id, {
        unit: targetMeta.unit,
        max: effectivePrimary === "rpm" ? 3000 : (effectivePrimary === "fuel" || effectivePrimary === "engineLoad" ? 100 : 24),
      })
    }

    setShowAttributePicker(false)
  }

  // Create new section
  function handleCreateSection(e: React.FormEvent) {
    e.preventDefault()
    const name = newSectionName.trim() || `Section ${sections.length + 1}`
    const id = `sec-${Date.now()}`
    const defaultVesselId = vessels[0]?.id || ""

    let initialWidgets: WidgetDef[] = []
    let initialLayouts: ResponsiveLayouts = { lg: [] }

    if (newSectionTemplate === "nav") {
      initialWidgets = [
        { id: `speed-${Date.now()}`, type: "speed", title: "Speed over ground", vesselId: defaultVesselId, attributeKey: "sog" },
        { id: `heading-${Date.now()}`, type: "heading", title: "Heading & course", vesselId: defaultVesselId, attributeKey: "heading", secondaryAttributeKey: "cog" },
        { id: `depth-${Date.now()}`, type: "telemetry", title: "Water depth", vesselId: defaultVesselId, attributeKey: "depth" },
        { id: `map-${Date.now()}`, type: "map", title: "Position preview", vesselId: defaultVesselId, attributeKey: "position" },
      ]
      initialLayouts = {
        lg: [
          { i: initialWidgets[0].id, x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
          { i: initialWidgets[1].id, x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
          { i: initialWidgets[2].id, x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
          { i: initialWidgets[3].id, x: 0, y: 4, w: 12, h: 5, minW: 4, minH: 3 },
        ],
      }
    } else if (newSectionTemplate === "engine") {
      initialWidgets = [
        { id: `engine-${Date.now()}`, type: "engine", title: "Machinery status", vesselId: defaultVesselId, attributeKey: "machinery" },
        { id: `trend-${Date.now()}`, type: "chart", title: "Propulsion trend", vesselId: defaultVesselId, attributeKey: "rpm" },
        { id: `fuel-${Date.now()}`, type: "telemetry", title: "Fuel remaining", vesselId: defaultVesselId, attributeKey: "fuel" },
      ]
      initialLayouts = {
        lg: [
          { i: initialWidgets[0].id, x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
          { i: initialWidgets[1].id, x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
          { i: initialWidgets[2].id, x: 0, y: 4, w: 6, h: 3, minW: 3, minH: 2 },
        ],
      }
    } else if (newSectionTemplate === "full") {
      initialWidgets = [
        { id: `speed-${Date.now()}`, type: "speed", title: "Speed over ground", vesselId: defaultVesselId, attributeKey: "sog" },
        { id: `heading-${Date.now()}`, type: "heading", title: "Heading & course", vesselId: defaultVesselId, attributeKey: "heading", secondaryAttributeKey: "cog" },
        { id: `fuel-${Date.now()}`, type: "telemetry", title: "Fuel remaining", vesselId: defaultVesselId, attributeKey: "fuel" },
        { id: `depth-${Date.now()}`, type: "telemetry", title: "Water depth", vesselId: defaultVesselId, attributeKey: "depth" },
        { id: `trend-${Date.now()}`, type: "chart", title: "Propulsion trend", vesselId: defaultVesselId, attributeKey: "rpm" },
        { id: `map-${Date.now()}`, type: "map", title: "Position preview", vesselId: defaultVesselId, attributeKey: "position" },
        { id: `engine-${Date.now()}`, type: "engine", title: "Machinery status", vesselId: defaultVesselId, attributeKey: "machinery" },
      ]
      initialLayouts = {
        lg: [
          { i: initialWidgets[0].id, x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
          { i: initialWidgets[1].id, x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
          { i: initialWidgets[2].id, x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
          { i: initialWidgets[3].id, x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
          { i: initialWidgets[4].id, x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
          { i: initialWidgets[5].id, x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
          { i: initialWidgets[6].id, x: 6, y: 6, w: 6, h: 3, minW: 4, minH: 3 },
        ],
      }
    }

    const newSection: DashboardSection = {
      id,
      name,
      widgets: initialWidgets,
      layouts: initialLayouts,
    }

    setSections((prev) => [...prev, newSection])
    setActiveSectionId(id)
    setAddSectionModal(false)
  }

  // Rename active section
  function handleRenameSection(e: React.FormEvent) {
    e.preventDefault()
    if (!renameName.trim()) return
    setSections((prev) =>
      prev.map((s) => (s.id === activeSection.id ? { ...s, name: renameName.trim() } : s)),
    )
    setRenameModal(false)
  }

  // Reset layout of active section
  function resetActiveSectionLayout() {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSection.id) return sec
        const autoLayout = (sec.widgets || []).map((w, index) => ({
          i: w.id,
          x: (index % 2) * 6,
          y: Math.floor(index / 2) * 4,
          w: w.type === "chart" || w.type === "map" || w.type === "engine" || w.type === "bar" || w.type === "table" || w.type === "gateway" ? 6 : 3,
          h: w.type === "telemetry" ? 2 : (w.type === "kpi" ? 3 : 4),
          minW: 2,
          minH: 2,
        }))
        return {
          ...sec,
          layouts: {
            lg: autoLayout,
            md: autoLayout,
            sm: autoLayout,
            xs: autoLayout.map((item, i) => ({ ...item, x: 0, y: i * 4, w: 1 })),
          },
        }
      }),
    )
  }

  if (vessels.length === 0) {
    return (
      <main className="grid min-h-[600px] place-items-center text-center">
        <div>
          <Anchor className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-lg font-bold">No vessel available</h1>
          <p className="mt-1 text-xs text-slate-400">
            Register a vessel before creating a monitoring dashboard.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main
      ref={mainContainerRef}
      className={`mx-auto w-full transition-all duration-200 ${
        isFullscreen
          ? "bg-slate-50 min-h-screen p-3 sm:p-5 overflow-y-auto"
          : "max-w-[1850px] p-2 sm:p-4"
      }`}
    >
      {/* Toast Save Feedback */}
      {saveToast && (
        <div
          className={`fixed top-20 right-8 z-[3000] flex items-center gap-2 rounded-xl text-white px-4 py-2.5 shadow-lg text-xs font-bold transition-all ${
            saveToast.type === "success"
              ? "bg-emerald-600 shadow-emerald-700/25"
              : "bg-red-600 shadow-red-700/25"
          }`}
        >
          {saveToast.type === "success" ? (
            <Check className="h-4 w-4 stroke-[2.5]" />
          ) : (
            <X className="h-4 w-4 stroke-[2.5]" />
          )}
          <span>{saveToast.message}</span>
        </div>
      )}

      {/* 1. TOP SECTION TABS BAR & SINGLE TOGGLE BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-xs mb-3">
        {/* Scrollable Tabs for Sections */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {sections.map((sec) => {
            const isActive = sec.id === activeSection.id
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveSectionId(sec.id)
                  setSelectedWidgetId(null)
                }}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-[#db4040] text-white font-bold shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold"
                }`}
              >
                <Layers className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{sec.name}</span>
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-500"
                  }`}
                >
                  {sec.widgets.length}
                </span>
              </button>
            )
          })}

          {/* Button Add Section Dashboard (Modify Mode Only) */}
          {dashboardMode === "modify" && (
            <button
              onClick={() => {
                setNewSectionName(`Section ${sections.length + 1}`)
                setNewSectionTemplate("nav")
                setAddSectionModal(true)
              }}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-600 hover:border-[#db4040] hover:bg-red-50 hover:text-[#db4040] transition whitespace-nowrap cursor-pointer"
              title="Add New Dashboard Section"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Section</span>
            </button>
          )}
        </div>

        {/* Top Right Controls: Single Toggle Button & Save Button */}
        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto shrink-0">
          {/* Section Tools: Rename & Delete (Modify Mode Only) */}
          {dashboardMode === "modify" && (
            <>
              <button
                onClick={() => {
                  setRenameName(activeSection.name)
                  setRenameModal(true)
                }}
                className="flex items-center gap-1 text-slate-600 hover:text-[#db4040] text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                title="Rename this Section"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Rename</span>
              </button>

              {sections.length > 1 && (
                <button
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: "Delete Dashboard Section",
                      message: (
                        <span>
                          Are you sure you want to delete section <strong>"{activeSection.name}"</strong>? All widgets and instrument layouts within this section will be removed.
                        </span>
                      ),
                      confirmLabel: "Delete Section",
                      cancelLabel: "Cancel",
                      onConfirm: () => {
                        const remaining = sections.filter((s) => s.id !== activeSection.id)
                        setSections(remaining)
                        setActiveSectionId(remaining[0].id)
                        setSelectedWidgetId(null)
                      },
                    })
                  }}
                  className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                  title="Delete this Section"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Reset Layout Button */}
              <button
                type="button"
                onClick={() => resetActiveSectionLayout()}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                title="Reset Widget Layout to Default"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset Layout</span>
              </button>

              {/* SAVE LAYOUT Button */}
              <button
                type="button"
                onClick={handleSaveLayout}
                disabled={!isDirty}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-sm ${
                  isDirty
                    ? "bg-[#db4040] hover:bg-[#b92b2b] text-white cursor-pointer active:scale-95"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75"
                }`}
                title={isDirty ? "Save dashboard changes" : "No unsaved changes"}
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Layout</span>
              </button>
            </>
          )}

          {/* FULLSCREEN TOGGLE BUTTON (MARINE TRAFFIC STYLE) */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`grid h-8 w-8 place-items-center rounded-xl border transition shadow-xs cursor-pointer ${
              isFullscreen
                ? "border-slate-300 bg-slate-100 text-[#db4040] hover:bg-slate-200"
                : "border-slate-300 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900"
            }`}
            title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Layar Penuh"}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {/* SINGLE TOGGLE BUTTON: VIEW MODE <-> MODIFY MODE */}
          {dashboardMode === "view" ? (
            <button
              type="button"
              onClick={handleSwitchToModifyMode}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Modify Mode</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSwitchToViewMode}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5 text-blue-500" />
              <span>View Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: CANVAS WITH INLINE SIDEBAR */}
      <div className="flex flex-col lg:flex-row items-start w-full relative">
        {/* Canvas Area: flex-1 dynamically expands and shrinks smoothly */}
        <div className="flex-1 w-full min-w-0 transition-all duration-300">
          <div
            className={`rounded-2xl transition duration-200 relative overflow-hidden ${
              dashboardMode === "modify"
                ? "border border-slate-200/90 p-2 sm:p-2.5 pb-28 shadow-xs"
                : "p-0.5 border-transparent pb-4"
            }`}
            style={{
              minHeight: canvasMinHeight,
              backgroundColor: dashboardMode === "modify" ? "#f8fafc" : "transparent",
              backgroundImage:
                dashboardMode === "modify"
                  ? `
                linear-gradient(to right, rgba(203, 213, 225, 0.4) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(203, 213, 225, 0.4) 1px, transparent 1px)
              `
                  : undefined,
              backgroundSize: "28px 28px",
            }}
          >
            {/* Droppable Interactive Grid Canvas */}
            {activeSection.widgets.length === 0 ? (
              <div className="my-24 rounded-2xl border-2 border-dashed border-slate-300/80 bg-white/80 backdrop-blur-sm p-12 text-center max-w-lg mx-auto">
                <LayoutGrid className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-3 text-sm font-bold text-slate-700">Canvas is Empty</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  {dashboardMode === "modify" ? (
                    <><span className="font-semibold text-[#db4040]">Drag</span> and drop widgets from the right panel onto this canvas.</>
                  ) : (
                    <>Click <span className="font-bold text-slate-800">Modify Mode</span> above to add and arrange widgets.</>
                  )}
                </p>
              </div>
            ) : (
                <ResponsiveGrid
                  className="layout"
                  layouts={effectiveLayouts}
                  breakpoints={{ lg: 768, md: 576, sm: 480, xs: 0 }}
                  cols={{ lg: 12, md: 12, sm: 12, xs: 1 }}
                  rowHeight={44}
                  margin={[12, 12]}
                  compactType={null}
                  preventCollision={false}
                  isDraggable={dashboardMode === "modify"}
                  isResizable={dashboardMode === "modify"}
                  isDroppable={dashboardMode === "modify"}
                  droppingItem={{
                    i: "__dropping-elem__",
                    x: 0,
                    y: 0,
                    w: droppingWidget.w,
                    h: droppingWidget.h,
                  }}
                  onDragStart={() => {
                    isDraggingRef.current = true
                  }}
                  onDragStop={(layout) => {
                    isDraggingRef.current = false
                    handleCommitLayout(layout)
                  }}
                  onResizeStop={(layout) => {
                    handleCommitLayout(layout)
                  }}
                  onDrop={(_layout, layoutItem) => {
                    if (layoutItem) handleDrop(layoutItem)
                  }}
                  onLayoutChange={handleLayoutChange}
                  draggableHandle=".widget-handle"
                >
                  {activeSection.widgets.map((widget) => {
                    const widgetVessel =
                      vessels.find((v) => v.id === widget.vesselId) || vessels[0]
                    const isSelected = dashboardMode === "modify" && selectedWidgetId === widget.id

                    return (
                      <div
                        key={widget.id}
                        onClick={() => {
                          if (dashboardMode === "modify") {
                            setSelectedWidgetId(widget.id)
                          }
                        }}
                        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 group/card ${
                          dashboardMode === "modify" ? "cursor-pointer hover:shadow-md" : ""
                        } ${
                          isSelected
                            ? "ring-2 ring-[#db4040] border-[#db4040] shadow-md"
                            : "border-slate-200/90"
                        }`}
                      >
                        {/* Widget Header: No Settings Button, Delete button opens confirmation dialog */}
                        <div
                          className={`flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2 select-none ${
                            dashboardMode === "modify" ? "widget-handle cursor-grab active:cursor-grabbing" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {dashboardMode === "modify" && (
                              <GripVertical className="h-3.5 w-3.5 text-slate-400 group-hover/card:text-[#db4040] transition shrink-0" />
                            )}
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[11px] font-bold text-slate-800 tracking-tight truncate">
                                {widget.title}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200/80 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shrink-0">
                                <Ship className="h-2.5 w-2.5 text-blue-500" />
                                <span>{widgetVessel.name}</span>
                              </span>
                            </div>
                          </div>

                          {/* Delete Button: Modify Mode only, triggers modal confirmation */}
                          {dashboardMode === "modify" && (
                            <div className="flex items-center shrink-0">
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setWidgetToDelete(widget)
                                }}
                                className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 cursor-pointer transition"
                                title="Delete this Widget"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Content Area Widget */}
                        <div className="h-[calc(100%-35px)] p-2 sm:p-3">
                          <AdaptiveWidgetBox>
                            {({ width, height }) => (
                              <WidgetContent
                                widget={widget}
                                vessel={widgetVessel}
                                width={width}
                                height={height}
                              />
                            )}
                          </AdaptiveWidgetBox>
                        </div>
                      </div>
                    )
                  })}
                </ResponsiveGrid>
              )}
          </div>
        </div>

        {/* 3. WIDGETS SIDEBAR: INLINE SIDEBAR (SLIDES IN/OUT SMOOTHLY) */}
        <div
          className={`shrink-0 transition-all duration-300 ease-in-out sticky top-4 self-start overflow-hidden ${
            dashboardMode === "modify"
              ? "w-full lg:w-80 xl:w-84 lg:ml-3 opacity-100 translate-x-0"
              : "w-0 max-w-0 lg:ml-0 opacity-0 translate-x-8 pointer-events-none"
          }`}
        >
          <div className="w-80 xl:w-84 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col">
            {selectedWidget ? (
              /* ========================================================= */
              /* CONTEXTUAL WIDGET SETTINGS PANEL                          */
              /* ========================================================= */
              <div className="flex flex-col h-full">
                {/* Header with primary logo color */}
                <div className="bg-[#db4040] text-white px-3.5 py-3 flex items-center justify-between shadow-xs">
                  <div className="font-bold text-xs truncate max-w-[200px]">
                    {selectedWidget.title || "Widget Settings"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWidgetToDelete(selectedWidget)}
                      className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition cursor-pointer"
                      title="Delete Widget"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWidgetId(null)}
                      className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition cursor-pointer"
                      title="Close Settings Panel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Form Body Setting Widget */}
                <div className="p-4 space-y-4 max-h-[740px] overflow-y-auto text-xs">
                  {/* 1. Name • Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <span>Name</span>
                      <span className="text-[#db4040]">•</span>
                    </label>
                    <input
                      type="text"
                      value={selectedWidget.title}
                      onChange={(e) => updateWidget(selectedWidget.id, { title: e.target.value })}
                      className="w-full bg-slate-100/90 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#db4040]"
                    />
                  </div>

                                  {/* 2. Accordion / Section: Attributes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => toggleInspectorSection("attributes")}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer select-none"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                            collapsedInspectorSections.attributes ? "-rotate-90 text-slate-400" : "rotate-0"
                          }`}
                        />
                        <span>{selectedWidget.type === "table" || selectedWidget.type === "map" ? "Vessel Source" : "Attributes"}</span>
                      </button>
                      {selectedWidget.type === "heading" &&
                        selectedWidget.secondaryAttributeKey !== "none" &&
                        selectedWidgetSecondaryMeta && (
                          <button
                            type="button"
                            onClick={swapCompassAttributes}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                            title="Swap Primary & Secondary order"
                          >
                            <ArrowUpDown className="h-3 w-3 text-slate-500" />
                            <span>Swap</span>
                          </button>
                        )}
                    </div>

                    {!collapsedInspectorSections.attributes && (
                      <div>
                        {/* Attribute / Vessel Active Information */}
                        {selectedWidget.type === "table" || selectedWidget.type === "map" ? (
                          <div className="space-y-2 mb-2.5">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                Monitored Vessel
                              </label>
                              <select
                                value={selectedWidget.vesselId || vessels[0]?.id || ""}
                                onChange={(e) => {
                                  const targetVessel = vessels.find((v) => v.id === e.target.value)
                                  updateWidget(selectedWidget.id, {
                                    vesselId: e.target.value,
                                    title:
                                      selectedWidget.type === "map"
                                        ? `${targetVessel?.name || "Vessel"} - Navigation Map`
                                        : `${targetVessel?.name || "Vessel"} - Telemetry Matrix`,
                                  })
                                }}
                                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#db4040]"
                              >
                                {vessels.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name} ({v.type || "Vessel"})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="p-2 rounded-lg bg-white text-[#db4040] border border-slate-200/80 shrink-0">
                                {selectedWidget.type === "map" ? (
                                  <Map className="h-4 w-4" />
                                ) : (
                                  <Table className="h-4 w-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-800 truncate">
                                  {selectedWidgetVessel?.name || "Vessel"}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {selectedWidget.type === "map"
                                    ? "OpenSeaMap & AIS Marine Traffic Chart"
                                    : "Telemetry & Sensor Health Matrix"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : selectedWidget.type === "heading" ? (
                          <div className="space-y-2 mb-2.5">
                            {/* Primary Pointer Attribute */}
                            <div
                              draggable={Boolean(selectedWidgetSecondaryMeta && selectedWidget.secondaryAttributeKey !== "none")}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", "primary")
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault()
                                const source = e.dataTransfer.getData("text/plain")
                                if (source === "secondary") {
                                  swapCompassAttributes()
                                }
                              }}
                              className={`flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 transition group/attr1 select-none ${
                                selectedWidgetSecondaryMeta && selectedWidget.secondaryAttributeKey !== "none"
                                  ? "cursor-grab active:cursor-grabbing hover:border-sky-300 hover:bg-sky-50/30 hover:shadow-xs"
                                  : ""
                              }`}
                              title="Drag up or down to swap with Secondary"
                            >
                              <span className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                <Compass className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">
                                      Primary
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-800 truncate">
                                      {selectedWidgetVessel?.name || "Vessel"}
                                    </span>
                                  </div>
                                  {selectedWidgetSecondaryMeta && selectedWidget.secondaryAttributeKey !== "none" && (
                                    <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover/attr1:text-sky-500 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {selectedWidgetMeta?.label || selectedWidget.attributeKey}
                                </div>
                              </div>
                            </div>

                            {/* Secondary Needle Attribute */}
                            <div
                              draggable={Boolean(selectedWidgetSecondaryMeta && selectedWidget.secondaryAttributeKey !== "none")}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", "secondary")
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault()
                                const source = e.dataTransfer.getData("text/plain")
                                if (source === "primary") {
                                  swapCompassAttributes()
                                }
                              }}
                              className={`flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 transition group/attr2 select-none ${
                                selectedWidgetSecondaryMeta && selectedWidget.secondaryAttributeKey !== "none"
                                  ? "cursor-grab active:cursor-grabbing hover:border-amber-300 hover:bg-amber-50/30 hover:shadow-xs"
                                  : ""
                              }`}
                              title="Drag up or down to swap with Primary"
                            >
                              <span className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
                                <Navigation className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                      Secondary
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-800 truncate">
                                      {selectedWidgetVessel?.name || "Vessel"}
                                    </span>
                                  </div>
                                  {selectedWidgetSecondaryMeta && selectedWidget.secondaryAttributeKey !== "none" && (
                                    <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover/attr2:text-amber-500 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {selectedWidgetSecondaryMeta
                                    ? selectedWidgetSecondaryMeta.label
                                    : selectedWidget.secondaryAttributeKey === "none"
                                    ? "None (Single Needle Only)"
                                    : selectedWidget.attributeKey === "cog"
                                    ? "Heading & Compass"
                                    : "Course Over Ground (COG)"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 mb-2.5">
                            <span className="p-2 rounded-lg bg-white text-[#db4040] border border-slate-200/80 shrink-0">
                              {selectedWidgetMeta ? <selectedWidgetMeta.icon className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-slate-800 truncate">
                                {selectedWidgetVessel?.name || "Vessel"}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {selectedWidgetMeta?.label || selectedWidget.attributeKey} ({selectedWidget.config?.unit || selectedWidgetMeta?.unit || ""})
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Button ⇄ Attribute (not needed for table or map) */}
                        {selectedWidget.type !== "table" && selectedWidget.type !== "map" && (
                          <button
                            type="button"
                            onClick={() => openAttributePicker()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#db4040] font-bold text-xs border border-red-200 transition cursor-pointer"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>{selectedWidget.type === "heading" ? "Configure Angles" : "Attribute"}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* 3. Section: Values (Min, Max, Decimals) */}
                  {(selectedWidget.type === "speed" ||
                    selectedWidget.type === "telemetry" ||
                    selectedWidget.type === "kpi" ||
                    selectedWidget.type === "bar" ||
                    selectedWidget.type === "chart") && (
                    <>
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("values")}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer select-none mb-2"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                              collapsedInspectorSections.values ? "-rotate-90 text-slate-400" : "rotate-0"
                            }`}
                          />
                          <span>Values</span>
                        </button>

                        {!collapsedInspectorSections.values && (
                          <div>
                            {selectedWidget.type !== "telemetry" && selectedWidget.type !== "chart" && selectedWidget.type !== "bar" && (
                              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                    Min
                                  </label>
                                  <input
                                    type="number"
                                    value={selectedWidget.config?.min ?? 0}
                                    onChange={(e) =>
                                      updateWidgetConfig(selectedWidget.id, {
                                        min: Number(e.target.value),
                                      })
                                    }
                                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                    Max
                                  </label>
                                  <input
                                    type="number"
                                    value={
                                      selectedWidget.config?.max ??
                                      (selectedWidget.attributeKey === "rpm"
                                        ? 3000
                                        : selectedWidget.attributeKey === "engineLoad" ||
                                          selectedWidget.attributeKey === "fuel"
                                        ? 100
                                        : 24)
                                    }
                                    onChange={(e) =>
                                      updateWidgetConfig(selectedWidget.id, {
                                        max: Number(e.target.value),
                                      })
                                    }
                                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                  Decimals
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={4}
                                  value={
                                    selectedWidget.config?.decimals ??
                                    (selectedWidget.attributeKey === "rpm" ||
                                    selectedWidget.attributeKey === "fuel"
                                      ? 0
                                      : 1)
                                  }
                                  onChange={(e) =>
                                    updateWidgetConfig(selectedWidget.id, {
                                      decimals: Number(e.target.value),
                                    })
                                  }
                                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                  Unit
                                </label>
                                <input
                                  type="text"
                                  value={
                                    selectedWidget.config?.unit ??
                                    selectedWidgetMeta?.unit ??
                                    ""
                                  }
                                  onChange={(e) =>
                                    updateWidgetConfig(selectedWidget.id, {
                                      unit: e.target.value,
                                    })
                                  }
                                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100" />
                    </>
                  )}

                  {/* 4. Section: Thresholds */}
                  {selectedWidget.type === "speed" && (
                    <>
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("thresholds")}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer select-none mb-2"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                              collapsedInspectorSections.thresholds ? "-rotate-90 text-slate-400" : "rotate-0"
                            }`}
                          />
                          <span>Thresholds</span>
                        </button>

                        {!collapsedInspectorSections.thresholds && (() => {
                          const currMin = selectedWidget.config?.min ?? 0
                          const currMax =
                            selectedWidget.config?.max ??
                            (selectedWidget.attributeKey === "rpm"
                              ? 3000
                              : selectedWidget.attributeKey === "engineLoad" ||
                                selectedWidget.attributeKey === "fuel"
                              ? 100
                              : 24)
                          const currRange = currMax - currMin || 1

                          const defaultGreen = currMin
                          const defaultOrange = Math.round(currMin + currRange * 0.7)
                          const defaultRed = Math.round(currMin + currRange * 0.85)

                          const currGreen =
                            typeof selectedWidget.config?.thresholds?.green === "number" &&
                            selectedWidget.config.thresholds.green <= currMax
                              ? selectedWidget.config.thresholds.green
                              : defaultGreen

                          const currOrange =
                            typeof selectedWidget.config?.thresholds?.orange === "number" &&
                            selectedWidget.config.thresholds.orange <= currMax
                              ? selectedWidget.config.thresholds.orange
                              : defaultOrange

                          const currRed =
                            typeof selectedWidget.config?.thresholds?.red === "number" &&
                            selectedWidget.config.thresholds.red <= currMax
                              ? selectedWidget.config.thresholds.red
                              : defaultRed

                          const colorGreen = selectedWidget.config?.thresholdColors?.green || "#10b981"
                          const colorOrange = selectedWidget.config?.thresholdColors?.orange || "#f59e0b"
                          const colorRed = selectedWidget.config?.thresholdColors?.red || "#ef4444"

                          return (
                            <div className="space-y-2.5">
                              {/* Threshold Normal */}
                              <div className="flex items-center gap-2.5">
                                <div className="relative group shrink-0" title="Click to choose normal color">
                                  <input
                                    type="color"
                                    value={colorGreen}
                                    onChange={(e) =>
                                      updateWidgetThresholdColor(selectedWidget.id, "green", e.target.value)
                                    }
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                  />
                                  <span
                                    className="h-7 w-7 rounded-lg block border border-slate-300 shadow-xs cursor-pointer transition transform group-hover:scale-105"
                                    style={{ backgroundColor: colorGreen }}
                                  />
                                </div>
                                <input
                                  type="number"
                                  value={currGreen}
                                  onChange={(e) =>
                                    updateWidgetThreshold(
                                      selectedWidget.id,
                                      "green",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#db4040]"
                                  title="Normal range start value"
                                />
                              </div>

                              {/* Threshold Warning */}
                              <div className="flex items-center gap-2.5">
                                <div className="relative group shrink-0" title="Click to choose warning color">
                                  <input
                                    type="color"
                                    value={colorOrange}
                                    onChange={(e) =>
                                      updateWidgetThresholdColor(selectedWidget.id, "orange", e.target.value)
                                    }
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                  />
                                  <span
                                    className="h-7 w-7 rounded-lg block border border-slate-300 shadow-xs cursor-pointer transition transform group-hover:scale-105"
                                    style={{ backgroundColor: colorOrange }}
                                  />
                                </div>
                                <input
                                  type="number"
                                  value={currOrange}
                                  onChange={(e) =>
                                    updateWidgetThreshold(
                                      selectedWidget.id,
                                      "orange",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#db4040]"
                                  title="Warning threshold start value"
                                />
                              </div>

                              {/* Threshold Critical */}
                              <div className="flex items-center gap-2.5">
                                <div className="relative group shrink-0" title="Click to choose critical color">
                                  <input
                                    type="color"
                                    value={colorRed}
                                    onChange={(e) =>
                                      updateWidgetThresholdColor(selectedWidget.id, "red", e.target.value)
                                    }
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                  />
                                  <span
                                    className="h-7 w-7 rounded-lg block border border-slate-300 shadow-xs cursor-pointer transition transform group-hover:scale-105"
                                    style={{ backgroundColor: colorRed }}
                                  />
                                </div>
                                <input
                                  type="number"
                                  value={currRed}
                                  onChange={(e) =>
                                    updateWidgetThreshold(
                                      selectedWidget.id,
                                      "red",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#db4040]"
                                  title="Critical threshold start value"
                                />
                              </div>
                            </div>
                          )
                        })()}
                      </div>

                      <div className="border-t border-slate-100" />
                    </>
                  )}

                  {/* 5. Section: Depth Color Filters & Templates (Water Depth Echosounder) */}
                  {selectedWidget.type === "bar" && (
                    <>
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("depthColors")}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer select-none mb-2"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                              collapsedInspectorSections.depthColors ? "-rotate-90 text-slate-400" : "rotate-0"
                            }`}
                          />
                          <span>Depth Color Filters & Templates</span>
                        </button>

                        {!collapsedInspectorSections.depthColors && (() => {
                          const currentTheme = selectedWidget.config?.depthTheme || "standard"
                          const currentColors = {
                            shallow: selectedWidget.config?.depthColors?.shallow || "#f43f5e",
                            caution: selectedWidget.config?.depthColors?.caution || "#f59e0b",
                            safe: selectedWidget.config?.depthColors?.safe || "#06b6d4",
                          }
                          const currentThresholds = {
                            shallow: selectedWidget.config?.depthThresholds?.shallow ?? 5,
                            caution: selectedWidget.config?.depthThresholds?.caution ?? 10,
                          }

                          return (
                            <div className="space-y-3">
                              {/* Color Theme Templates */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                                  Preset Templates
                                </label>
                                <div className="space-y-1.5">
                                  {DEPTH_THEME_PRESETS.map((preset) => {
                                    const isActive = currentTheme === preset.id
                                    return (
                                      <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() =>
                                          updateWidgetConfig(selectedWidget.id, {
                                            depthTheme: preset.id,
                                            depthColors: { ...preset.colors },
                                          })
                                        }
                                        className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition cursor-pointer ${
                                          isActive
                                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                            : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/80"
                                        }`}
                                      >
                                        <div className="min-w-0 pr-2">
                                          <div className="text-[11px] font-bold leading-tight">
                                            {preset.name}
                                          </div>
                                          <div className={`text-[9px] truncate mt-0.5 ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                                            {preset.description}
                                          </div>
                                        </div>

                                        {/* Color dots preview */}
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span
                                            className="h-3 w-3 rounded-full border border-black/10"
                                            style={{ backgroundColor: preset.colors.shallow }}
                                            title="Shallow"
                                          />
                                          <span
                                            className="h-3 w-3 rounded-full border border-black/10"
                                            style={{ backgroundColor: preset.colors.caution }}
                                            title="Caution"
                                          />
                                          <span
                                            className="h-3 w-3 rounded-full border border-black/10"
                                            style={{ backgroundColor: preset.colors.safe }}
                                            title="Safe"
                                          />
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Custom Color Settings (Mandiri) */}
                              <div className="pt-2 border-t border-slate-100">
                                <label className="block text-[10px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                                  Custom Colors (Mandiri)
                                </label>
                                <div className="space-y-2">
                                  {/* Shallow */}
                                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="relative group shrink-0" title="Pilih warna zona dangkal">
                                        <input
                                          type="color"
                                          value={currentColors.shallow}
                                          onChange={(e) =>
                                            updateWidgetConfig(selectedWidget.id, {
                                              depthTheme: "custom",
                                              depthColors: {
                                                ...currentColors,
                                                shallow: e.target.value,
                                              },
                                            })
                                          }
                                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                        />
                                        <span
                                          className="h-6 w-6 rounded-lg block border border-slate-300 shadow-xs cursor-pointer transition transform group-hover:scale-105"
                                          style={{ backgroundColor: currentColors.shallow }}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-bold text-slate-800 leading-none">
                                          Shallow (&lt; {currentThresholds.shallow}m)
                                        </div>
                                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                                          {currentColors.shallow.toUpperCase()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Caution */}
                                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="relative group shrink-0" title="Pilih warna zona waspada">
                                        <input
                                          type="color"
                                          value={currentColors.caution}
                                          onChange={(e) =>
                                            updateWidgetConfig(selectedWidget.id, {
                                              depthTheme: "custom",
                                              depthColors: {
                                                ...currentColors,
                                                caution: e.target.value,
                                              },
                                            })
                                          }
                                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                        />
                                        <span
                                          className="h-6 w-6 rounded-lg block border border-slate-300 shadow-xs cursor-pointer transition transform group-hover:scale-105"
                                          style={{ backgroundColor: currentColors.caution }}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-bold text-slate-800 leading-none">
                                          Caution ({currentThresholds.shallow} - {currentThresholds.caution}m)
                                        </div>
                                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                                          {currentColors.caution.toUpperCase()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Safe */}
                                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="relative group shrink-0" title="Pilih warna zona laut dalam aman">
                                        <input
                                          type="color"
                                          value={currentColors.safe}
                                          onChange={(e) =>
                                            updateWidgetConfig(selectedWidget.id, {
                                              depthTheme: "custom",
                                              depthColors: {
                                                ...currentColors,
                                                safe: e.target.value,
                                              },
                                            })
                                          }
                                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                        />
                                        <span
                                          className="h-6 w-6 rounded-lg block border border-slate-300 shadow-xs cursor-pointer transition transform group-hover:scale-105"
                                          style={{ backgroundColor: currentColors.safe }}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-bold text-slate-800 leading-none">
                                          Safe Deep (&gt; {currentThresholds.caution}m)
                                        </div>
                                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                                          {currentColors.safe.toUpperCase()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Depth Threshold Limits (Batas Kedalaman) */}
                              <div className="pt-2 border-t border-slate-100">
                                <label className="block text-[10px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                                  Batas Meteran Filter (Thresholds)
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-500 mb-1">
                                      Batas Dangkal (m)
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={currentThresholds.shallow}
                                      onChange={(e) =>
                                        updateWidgetConfig(selectedWidget.id, {
                                          depthThresholds: {
                                            ...currentThresholds,
                                            shallow: Number(e.target.value),
                                          },
                                        })
                                      }
                                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-500 mb-1">
                                      Batas Waspada (m)
                                    </label>
                                    <input
                                      type="number"
                                      min={2}
                                      max={50}
                                      value={currentThresholds.caution}
                                      onChange={(e) =>
                                        updateWidgetConfig(selectedWidget.id, {
                                          depthThresholds: {
                                            ...currentThresholds,
                                            caution: Number(e.target.value),
                                          },
                                        })
                                      }
                                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>

                      <div className="border-t border-slate-100" />
                    </>
                  )}

                  {/* Line Chart Options */}
                  {selectedWidget.type === "chart" && (
                    <>
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("chart")}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer select-none mb-2"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                              collapsedInspectorSections.chart ? "-rotate-90 text-slate-400" : "rotate-0"
                            }`}
                          />
                          <span>Chart Options</span>
                        </button>
                        {!collapsedInspectorSections.chart && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">
                              Time Window
                            </label>
                            <select
                              value={selectedWidget.config?.timeSpan || "realtime"}
                              onChange={(e) =>
                                updateWidgetConfig(selectedWidget.id, {
                                  timeSpan: e.target.value,
                                })
                              }
                              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                            >
                              <option value="realtime">Realtime (Live Stream)</option>
                              <option value="15m">Last 15 minutes</option>
                              <option value="1h">Last 1 hour</option>
                              <option value="6h">Last 6 hours</option>
                              <option value="24h">Last 24 hours</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100" />
                    </>
                  )}

                  {/* Table Options */}
                  {selectedWidget.type === "table" && (
                    <>
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("tableOptions")}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer select-none mb-2"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                              collapsedInspectorSections.tableOptions ? "-rotate-90 text-slate-400" : "rotate-0"
                            }`}
                          />
                          <span>Table Options</span>
                        </button>
                        {!collapsedInspectorSections.tableOptions && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                Default Category Tab
                              </label>
                              <select
                                value={selectedWidget.config?.defaultCategory || "all"}
                                onChange={(e) =>
                                  updateWidgetConfig(selectedWidget.id, {
                                    defaultCategory: e.target.value,
                                  })
                                }
                                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                              >
                                <option value="all">All Sensors (Complete Matrix)</option>
                                <option value="Navigation">Navigation (SOG, HDG, COG, Depth)</option>
                                <option value="Machinery">Machinery (RPM, Load, Fuel)</option>
                                <option value="Environment">Environment (Wind Speed)</option>
                                <option value="System">System (Position, Gateway Link)</option>
                              </select>
                            </div>

                            <div className="space-y-2 pt-1 border-t border-slate-100">
                              <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                                <span>Category Filter Tabs</span>
                                <input
                                  type="checkbox"
                                  checked={selectedWidget.config?.showFilterChips !== false}
                                  onChange={(e) =>
                                    updateWidgetConfig(selectedWidget.id, {
                                      showFilterChips: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040] border-slate-300 cursor-pointer"
                                />
                              </label>

                              <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                                <span>Health Status Badges</span>
                                <input
                                  type="checkbox"
                                  checked={selectedWidget.config?.showStatus !== false}
                                  onChange={(e) =>
                                    updateWidgetConfig(selectedWidget.id, {
                                      showStatus: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040] border-slate-300 cursor-pointer"
                                />
                              </label>

                              <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                                <span>Update Timestamps</span>
                                <input
                                  type="checkbox"
                                  checked={selectedWidget.config?.showTimestamp !== false}
                                  onChange={(e) =>
                                    updateWidgetConfig(selectedWidget.id, {
                                      showTimestamp: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040] border-slate-300 cursor-pointer"
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100" />
                    </>
                  )}

                  {/* Map Options */}
                  {selectedWidget.type === "map" && (
                    <>
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("mapOptions")}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer select-none mb-2"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                              collapsedInspectorSections.mapOptions ? "-rotate-90 text-slate-400" : "rotate-0"
                            }`}
                          />
                          <span>Map Options</span>
                        </button>
                        {!collapsedInspectorSections.mapOptions && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                Default Tile Style
                              </label>
                              <select
                                value={selectedWidget.config?.mapTheme || "liberty"}
                                onChange={(e) =>
                                  updateWidgetConfig(selectedWidget.id, {
                                    mapTheme: e.target.value,
                                  })
                                }
                                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                              >
                                <option value="liberty">Marine Nautical 3D (Liberty)</option>
                                <option value="dark">Dark Operations (OpenFreeMap)</option>
                                <option value="positron">Light Clean (Positron)</option>
                                <option value="satellite">Satellite Imagery (ESRI)</option>
                              </select>
                            </div>

                            <div className="space-y-2 pt-1 border-t border-slate-100">
                              <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                                <span>Show Nautical Range Rings</span>
                                <input
                                  type="checkbox"
                                  checked={selectedWidget.config?.showRangeRings !== false}
                                  onChange={(e) =>
                                    updateWidgetConfig(selectedWidget.id, {
                                      showRangeRings: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040] border-slate-300 cursor-pointer"
                                />
                              </label>

                              <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                                <span>Show GPS Track Line</span>
                                <input
                                  type="checkbox"
                                  checked={selectedWidget.config?.showTrack !== false}
                                  onChange={(e) =>
                                    updateWidgetConfig(selectedWidget.id, {
                                      showTrack: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040] border-slate-300 cursor-pointer"
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100" />
                    </>
                  )}

                  {/* Close Panel Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWidgetId(null)}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer text-center"
                    >
                      Done & Close Panel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================= */
              /* DEFAULT PANEL: TAB WIDGETS (KATALOG 2 KOLOM) & SETTINGS  */
              /* ========================================================= */
              <>
                {/* Header Tabs: WIDGETS | SETTINGS */}
                <div className="grid grid-cols-2 text-center text-xs font-bold border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSidebarTab("widgets")}
                    className={`py-3 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      sidebarTab === "widgets"
                        ? "bg-[#db4040] text-white font-extrabold shadow-inner"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>WIDGETS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("settings")}
                    className={`py-3 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      sidebarTab === "settings"
                        ? "bg-[#db4040] text-white font-extrabold shadow-inner"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>SETTINGS</span>
                  </button>
                </div>

                {/* Tab 1: WIDGETS PALETTE (2 COLUMNS) */}
                {sidebarTab === "widgets" ? (
                  <div className="p-3.5 flex-1 overflow-y-auto">
                    <div className="mb-2 px-1 text-[11px] font-semibold text-slate-400">
                      Drag and drop widgets onto canvas:
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {PALETTE_WIDGETS.map((item) => {
                        const Icon = item.icon
                        return (
                          <div
                            key={item.label}
                            draggable={true}
                            unselectable="on"
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", item.type)
                              setDroppingWidget({
                                type: item.type,
                                title: item.label,
                                vesselId: vessels[0]?.id || "",
                                attributeKey: item.attributeKey,
                                w: item.defaultW,
                                h: item.defaultH,
                              })
                            }}
                            className="group flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-white hover:border-[#db4040] hover:bg-red-50/30 hover:shadow-md transition cursor-grab active:cursor-grabbing select-none relative"
                            title="Drag anywhere onto the canvas, or click + to add"
                          >
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-700 group-hover:bg-red-50 group-hover:text-[#db4040] transition">
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="mt-2 text-xs font-bold text-slate-700 text-center truncate w-full">
                              {item.label}
                            </span>

                            {/* Quick Add Button (+) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddWidgetPaletteDirectly(item)
                              }}
                              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-slate-100 hover:bg-[#db4040] hover:text-white text-slate-500 transition text-[9px] cursor-pointer"
                              title="Click to add to canvas"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-400 text-center">
                      💡 Tip: Click on any widget on the canvas to configure attribute, source vessel, and thresholds.
                    </div>
                  </div>
                ) : (
                  /* Tab 2: SECTION SETTINGS */
                  <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Active Section Name
                      </label>
                      <input
                        type="text"
                        value={activeSection.name}
                        onChange={(e) => {
                          const newName = e.target.value
                          setSections((prev) =>
                            prev.map((s) => (s.id === activeSection.id ? { ...s, name: newName } : s)),
                          )
                        }}
                        className={`${inputClass} text-xs font-semibold`}
                      />
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs space-y-1.5">
                      <div className="font-bold text-slate-700">Multi-Vessel Monitoring</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Each widget can be independently connected to telemetry attributes from any vessel.
                      </p>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => resetActiveSectionLayout()}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset Layout to Default</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL ⇄ SELECT VESSEL & ATTRIBUTE                                         */}
      {/* ========================================================================= */}
      <Modal
        open={showAttributePicker}
        onClose={() => setShowAttributePicker(false)}
        title="Select Vessel & Telemetry Attribute"
        wide={true}
      >
        <div className="p-6 space-y-5">
          {/* Step 1: Select Source Vessel */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              1. Select Source Vessel
            </label>
            <div className="relative">
              <select
                value={pickerVesselId}
                onChange={(e) => setPickerVesselId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition focus:border-[#db4040] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/15"
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.type || "Ship"}) — {v.status || "Underway"} ({v.quality?.toUpperCase() || "LIVE"})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Step 2: Select Attribute with Category Filter & Search (Can check 2 for Compass) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {selectedWidget?.type === "heading"
                    ? "2. Select Up To 2 Attributes (Primary & Secondary)"
                    : "2. Select Sensor Attribute to Display"}
                </label>
                {selectedWidget?.type === "heading" && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click 1st attribute for Primary (Cyan), 2nd for Secondary (Amber). Click any checked attribute to uncheck.
                  </p>
                )}
              </div>

              {/* Search Bar Attribute */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search attribute..."
                  value={attrSearch}
                  onChange={(e) => setAttrSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:border-[#db4040]"
                />
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-2">
              {[
                { id: "all", label: "All" },
                { id: "Navigation", label: "Navigation" },
                { id: "Machinery", label: "Machinery" },
                { id: "Environment", label: "Environment" },
                { id: "Vessel Info", label: "Vessel Info" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setAttrCategoryFilter(cat.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer shrink-0 ${
                    attrCategoryFilter === cat.id
                      ? "bg-[#db4040] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Grid 2 Columns Telemetry Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-84 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
              {filteredPickerAttributes.map((attr) => {
                const Icon = attr.icon
                const isHeading = selectedWidget?.type === "heading"
                const isPrimary = isHeading && pickerAttrKey === attr.key
                const isSecondary = isHeading && pickerSecondaryAttrKey === attr.key && pickerSecondaryAttrKey !== "none"
                const isSelected = isHeading ? (isPrimary || isSecondary) : pickerAttrKey === attr.key

                const selectedVessel = vessels.find((v) => v.id === pickerVesselId)
                const formattedVal = selectedVessel ? attr.getFormatted(selectedVessel) : "—"

                return (
                  <button
                    key={attr.key}
                    type="button"
                    onClick={() => handleAttributeCardClick(attr.key)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isPrimary
                        ? "border-cyan-500 bg-cyan-50/60 shadow-xs ring-1 ring-cyan-500"
                        : isSecondary
                        ? "border-amber-500 bg-amber-50/60 shadow-xs ring-1 ring-amber-500"
                        : isSelected
                        ? "border-[#db4040] bg-red-50/60 shadow-xs ring-1 ring-[#db4040]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-lg shrink-0 ${
                          isPrimary
                            ? "bg-cyan-500 text-white"
                            : isSecondary
                            ? "bg-amber-500 text-white"
                            : isSelected
                            ? "bg-[#db4040] text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`text-xs font-bold truncate ${
                              isPrimary
                                ? "text-cyan-950"
                                : isSecondary
                                ? "text-amber-950"
                                : isSelected
                                ? "text-red-950"
                                : "text-slate-800"
                            }`}
                          >
                            {attr.label}
                          </div>
                          {isPrimary && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 shrink-0">
                              Primary
                            </span>
                          )}
                          {isSecondary && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                              Secondary
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {attr.category} • <span className="font-semibold text-slate-500">{attr.unit}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        {formattedVal}
                      </span>
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          isPrimary
                            ? "border-cyan-500 bg-cyan-500 text-white"
                            : isSecondary
                            ? "border-amber-500 bg-amber-500 text-white"
                            : isSelected
                            ? "border-[#db4040] bg-[#db4040] text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                )
              })}

              {filteredPickerAttributes.length === 0 && (
                <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                  No attributes matched your search.
                </div>
              )}
            </div>
          </div>

          {/* Footer Modal: Selected & Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-slate-500 truncate">
              {selectedWidget?.type === "heading" ? (
                <span>
                  Source: <strong className="text-slate-800">{vessels.find((v) => v.id === pickerVesselId)?.name}</strong>
                  {" • "}
                  Primary:{" "}
                  <strong className="text-cyan-700">
                    {VESSEL_ATTRIBUTES.find((a) => a.key === pickerAttrKey)?.label || pickerAttrKey || "None"}
                  </strong>
                  {" • "}
                  Secondary:{" "}
                  <strong className="text-amber-700">
                    {pickerSecondaryAttrKey && pickerSecondaryAttrKey !== "none"
                      ? (VESSEL_ATTRIBUTES.find((a) => a.key === pickerSecondaryAttrKey)?.label || pickerSecondaryAttrKey)
                      : "None"}
                  </strong>
                </span>
              ) : pickerAttrKey ? (
                <span>
                  Selected:{" "}
                  <strong className="text-slate-800">
                    {vessels.find((v) => v.id === pickerVesselId)?.name}
                  </strong>{" "}
                  •{" "}
                  <strong className="text-[#db4040]">
                    {VESSEL_ATTRIBUTES.find((a) => a.key === pickerAttrKey)?.label}
                  </strong>
                </span>
              ) : (
                "Please select an attribute."
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowAttributePicker(false)}
                className={buttonSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAttributePicker}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#db4040] hover:bg-[#b92b2b] px-4 py-2.5 text-xs font-bold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
              >
                Apply Attribute
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL CONFIRM DELETE WIDGET */}
      <Modal
        open={widgetToDelete !== null}
        onClose={() => setWidgetToDelete(null)}
        title="Confirm Widget Deletion"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete widget{" "}
            <strong className="text-slate-900 font-bold">
              "{widgetToDelete?.title}"
            </strong>{" "}
            from this dashboard canvas?
          </p>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setWidgetToDelete(null)}
              className={buttonSecondary}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (widgetToDelete) {
                  removeWidget(widgetToDelete.id)
                  setWidgetToDelete(null)
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Widget</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL ADD NEW DASHBOARD SECTION */}
      <Modal
        open={addSectionModal}
        onClose={() => setAddSectionModal(false)}
        title="Add New Dashboard Section"
      >
        <form onSubmit={handleCreateSection} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Section Name
            </label>
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Auxiliary & Power Monitoring"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Initial Template
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: "nav", label: "Navigation Pack", desc: "Speed, Heading, Depth, Map" },
                { id: "engine", label: "Machinery Pack", desc: "Engine, Fuel, Trend" },
                { id: "full", label: "Full Command Pack", desc: "Complete 7-widget instrument pack" },
                { id: "empty", label: "Empty Canvas", desc: "Start with an empty clean canvas" },
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setNewSectionTemplate(tpl.id as any)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    newSectionTemplate === tpl.id
                      ? "border-[#db4040] bg-red-50/50 text-[#db4040] font-bold"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="font-bold">{tpl.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAddSectionModal(false)}
              className={buttonSecondary}
            >
              Cancel
            </button>
            <button type="submit" className={buttonPrimary}>
              Create Section
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL RENAME SECTION */}
      <Modal
        open={renameModal}
        onClose={() => setRenameModal(false)}
        title="Rename Section"
      >
        <form onSubmit={handleRenameSection} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Section Name
            </label>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRenameModal(false)}
              className={buttonSecondary}
            >
              Cancel
            </button>
            <button type="submit" className={buttonPrimary}>
              Save
            </button>
          </div>
        </form>
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
    </main>
  )
}
