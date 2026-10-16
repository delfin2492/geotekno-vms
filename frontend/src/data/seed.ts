import type {
  Agent,
  AisTarget,
  Alert,
  RawLog,
  TrackPoint,
  Vessel,
} from "@/domain/types"

const now = new Date().toISOString()

export const seedAgents: Agent[] = [
  {
    id: "agent-1",
    name: "Bridge Gateway 01",
    host: "10.20.1.14",
    port: 10110,
    decoders: ["NMEA2000", "NMEA0183"],
    status: "connected",
    packetsPerMinute: 842,
    lastPacketAt: now,
  },
  {
    id: "agent-2",
    name: "Engine Room Edge",
    host: "10.20.1.28",
    port: 2000,
    decoders: ["NMEA2000"],
    status: "connected",
    packetsPerMinute: 518,
    lastPacketAt: now,
  },
  {
    id: "agent-3",
    name: "Legacy RS485 Agent",
    host: "192.168.4.21",
    port: 4001,
    decoders: ["NMEA0183"],
    status: "disconnected",
    packetsPerMinute: 0,
    lastPacketAt: new Date(Date.now() - 720000).toISOString(),
  },
]

export const seedVessels: Vessel[] = [
  {
    id: "vessel-1",
    name: "MV Pacific Horizon",
    type: "Container Ship",
    imo: "9387421",
    mmsi: "525100421",
    callSign: "YBXT2",
    agentIds: ["agent-1", "agent-2"],
    status: "Underway",
    position: { lat: 1.212, lng: 103.718 },
    heading: 78,
    sog: 14.8,
    cog: 81,
    depth: 38.4,
    fuel: 72,
    rpm: 1140,
    engineLoad: 68,
    windSpeed: 16.2,
    destination: "Singapore",
    quality: "live",
    updatedAt: now,
  },
  {
    id: "vessel-2",
    name: "MT Arunika",
    type: "Oil Tanker",
    imo: "9218345",
    mmsi: "525204188",
    callSign: "PKLA",
    agentIds: ["agent-1"],
    status: "Underway",
    position: { lat: 1.486, lng: 103.24 },
    heading: 123,
    sog: 11.2,
    cog: 125,
    depth: 42.1,
    fuel: 64,
    rpm: 920,
    engineLoad: 54,
    windSpeed: 12.8,
    destination: "Port Klang",
    quality: "live",
    updatedAt: now,
  },
  {
    id: "vessel-3",
    name: "MV Sagara Nusantara",
    type: "Bulk Carrier",
    imo: "9472816",
    mmsi: "525014729",
    callSign: "YDQN",
    agentIds: ["agent-3"],
    status: "Anchored",
    position: { lat: 1.082, lng: 103.91 },
    heading: 12,
    sog: 0,
    cog: 12,
    depth: 29.8,
    fuel: 48,
    rpm: 0,
    engineLoad: 8,
    windSpeed: 18.4,
    destination: "Tanjung Priok",
    quality: "stale",
    updatedAt: new Date(Date.now() - 720000).toISOString(),
  },
]

export const seedAisTargets: AisTarget[] = [
  {
    id: "ais-1",
    name: "EVER LUNAR",
    mmsi: "563142900",
    callSign: "9V8812",
    aisClass: "A",
    position: { lat: 1.278, lng: 103.802 },
    heading: 242,
    sog: 13.2,
    cog: 240,
    status: "Underway using engine",
    distanceNm: 6.4,
    bearing: 48,
    cpa: 1.8,
    tcpa: 22,
    quality: "live",
    updatedAt: now,
  },
  {
    id: "ais-2",
    name: "OCEAN CREST",
    mmsi: "533170681",
    callSign: "9MXY7",
    aisClass: "A",
    position: { lat: 1.135, lng: 103.624 },
    heading: 64,
    sog: 10.4,
    cog: 67,
    status: "Underway using engine",
    distanceNm: 7.1,
    bearing: 226,
    cpa: 0.7,
    tcpa: 16,
    quality: "live",
    updatedAt: now,
  },
  {
    id: "ais-3",
    name: "SEA RUNNER",
    mmsi: "563998210",
    callSign: "9V5521",
    aisClass: "B",
    position: { lat: 1.34, lng: 103.68 },
    heading: 185,
    sog: 7.8,
    cog: 182,
    status: "Underway",
    distanceNm: 8.9,
    bearing: 342,
    cpa: 2.4,
    tcpa: 31,
    quality: "delayed",
    updatedAt: now,
  },
  {
    id: "ais-4",
    name: "TANTO INTAN",
    mmsi: "525900414",
    callSign: "POQA",
    aisClass: "B",
    position: { lat: 1.185, lng: 103.94 },
    heading: 270,
    sog: 8.9,
    cog: 272,
    status: "Underway",
    distanceNm: 13.1,
    bearing: 96,
    cpa: 4.2,
    tcpa: 45,
    quality: "live",
    updatedAt: now,
  },
  {
    id: "ais-5",
    name: "BINTANG 88",
    mmsi: "525012321",
    callSign: "YDAE",
    aisClass: "A",
    position: { lat: 1.42, lng: 103.47 },
    heading: 152,
    sog: 0.2,
    cog: 149,
    status: "At anchor",
    distanceNm: 18.5,
    bearing: 304,
    cpa: 8.4,
    tcpa: 80,
    quality: "stale",
    updatedAt: new Date(Date.now() - 660000).toISOString(),
  },
]

export const seedAlerts: Alert[] = [
  {
    id: "alert-1",
    vesselId: "vessel-1",
    severity: "warning",
    message: "CPA threshold below 2 NM with EVER LUNAR",
    createdAt: now,
    acknowledged: false,
  },
  {
    id: "alert-2",
    vesselId: "vessel-3",
    severity: "critical",
    message: "Connectivity agent is offline",
    createdAt: new Date(Date.now() - 720000).toISOString(),
    acknowledged: false,
  },
  {
    id: "alert-3",
    vesselId: "vessel-2",
    severity: "info",
    message: "Entered Singapore Strait geofence",
    createdAt: new Date(Date.now() - 360000).toISOString(),
    acknowledged: true,
  },
]

export const initialTracks: Record<string, TrackPoint[]> = Object.fromEntries(
  seedVessels.map((vessel) => [
    vessel.id,
    Array.from({ length: 22 }, (_, index) => ({
      lat:
        vessel.position.lat -
        Math.cos((vessel.heading * Math.PI) / 180) * (21 - index) * 0.006,
      lng:
        vessel.position.lng -
        Math.sin((vessel.heading * Math.PI) / 180) * (21 - index) * 0.006,
      timestamp: new Date(Date.now() - (21 - index) * 180000).toISOString(),
    })),
  ]),
)

export const seedLogs: RawLog[] = Array.from({ length: 35 }, (_, index) => {
  const vessel = seedVessels[index % seedVessels.length]
  const agent = seedAgents[index % seedAgents.length]
  const decoder = agent.decoders[index % agent.decoders.length]
  return {
    id: `seed-log-${index}`,
    timestamp: new Date(Date.now() - index * 12000).toISOString(),
    vesselId: vessel.id,
    agentId: agent.id,
    decoder,
    severity: index % 13 === 0 ? "warning" : "info",
    payload:
      decoder === "NMEA0183"
        ? `$GPRMC,${143200 - index},A,0112.72,N,10343.08,E,14.8,081.2,120625,,,A*6C`
        : `18F11234 8 1A 4F 09 2D 10 00 7B C2`,
    summary:
      decoder === "NMEA0183"
        ? "Position, speed and course update"
        : "PGN 127488 — Engine parameters",
  }
})
