export type DataQuality = "live" | "delayed" | "stale" | "offline"
export type AgentStatus = "connected" | "disconnected" | "testing"
export type Decoder = "NMEA2000" | "NMEA0183"

export interface Position {
  lat: number
  lng: number
}

export interface Agent {
  id: string
  name: string
  host: string
  port: number
  decoders: Decoder[]
  status: AgentStatus
  packetsPerMinute: number
  lastPacketAt: string
  decoderTemplate?: string
  decoderCode?: string
}

export interface Vessel {
  id: string
  name: string
  type: string
  imo?: string
  mmsi: string
  callSign: string
  registerContent?: string
  agentIds: string[]
  status: "Underway" | "Anchored" | "In Port"
  position: Position
  heading: number
  sog: number
  cog: number
  depth?: number | null
  fuel?: number | null
  rpm?: number | null
  engineLoad?: number | null
  windSpeed?: number | null
  destination: string
  quality: DataQuality
  updatedAt: string
}

export interface TrackPoint extends Position {
  timestamp: string
}

export interface AisTarget {
  id: string
  name: string
  type?: string
  mmsi: string
  imo?: string
  callSign: string
  aisClass: "A" | "B"
  position: Position
  heading: number
  sog: number
  cog: number
  status: string
  distanceNm: number
  bearing: number
  cpa: number
  tcpa: number
  quality: DataQuality
  updatedAt: string
}

export interface RawLog {
  id: string
  timestamp: string
  vesselId: string
  agentId: string
  decoder: Decoder
  severity: "info" | "warning" | "error"
  payload: string
  summary: string
}

export interface Alert {
  id: string
  vesselId: string
  severity: "warning" | "critical" | "info"
  message: string
  createdAt: string
  acknowledged: boolean
}

export type VesselDraft = Omit<Vessel, "id" | "updatedAt" | "quality" | "position" | "heading" | "sog" | "cog" | "depth" | "fuel" | "rpm" | "engineLoad" | "windSpeed" | "status">
export interface AgentDraft {
  name: string
  host: string
  port: number
  decoders: Decoder[]
  decoderTemplate?: string
  decoderCode?: string
}

export interface AssetAttribute {
  id: string
  assetId: string
  namespace: string
  keyName: string
  displayName: string
  unit: string
  pointingSource: string
  pgnSource?: string
  liveValue: string | number | null
  status: "live" | "stale" | "offline"
}

export interface AssetAttributeDraft {
  namespace: string
  keyName: string
  displayName: string
  unit: string
  pointingSource: string
  pgnSource?: string
}

export interface DiscoveredSignal {
  namespace: string
  keyName: string
  displayName: string
  unit: string
  pointingSource: string
  pgnSource?: string
}
