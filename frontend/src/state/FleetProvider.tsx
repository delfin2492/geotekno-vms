import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  Agent,
  AgentDraft,
  AisTarget,
  Alert,
  RawLog,
  TrackPoint,
  Vessel,
  VesselDraft,
} from "@/domain/types"
import { api } from "@/services/api"
import { useAuth } from "@/state/AuthProvider"

interface FleetContextValue {
  vessels: Vessel[]
  allVessels: Vessel[]
  agents: Agent[]
  aisTargets: AisTarget[]
  alerts: Alert[]
  logs: RawLog[]
  tracks: Record<string, TrackPoint[]>
  addVessel: (draft: VesselDraft) => Vessel
  updateVessel: (id: string, draft: Partial<Vessel>) => void
  deleteVessel: (id: string) => void
  addAgent: (draft: AgentDraft) => Agent
  updateAgent: (id: string, draft: AgentDraft) => void
  deleteAgent: (id: string) => void
  setAgentStatus: (id: string, status: Agent["status"]) => void
  acknowledgeAlert: (id: string) => void
}

const FleetContext = createContext<FleetContextValue | null>(null)
const KEYS = {
  vessels: "nauticore:v1:vessels",
  agents: "nauticore:v1:agents",
  alerts: "nauticore:v1:alerts",
}

function sanitizeStorage<T extends { id: string }>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    if (!Array.isArray(parsed)) return []
    // Sanitize: purge obsolete hardcoded mock IDs (vessel-1, agent-1, seed-*)
    const sanitized = parsed.filter(
      (item) =>
        !item.id?.startsWith("vessel-") &&
        !item.id?.startsWith("agent-") &&
        !item.id?.startsWith("seed-"),
    )
    if (sanitized.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(sanitized))
    }
    return sanitized
  } catch {
    return []
  }
}

export function FleetProvider({ children }: { children: ReactNode }) {
  const { canAccessVessel, isSuperadmin, isCompanyAdmin, companyId: userCompanyId } = useAuth()
  const [vessels, setVessels] = useState<Vessel[]>(() => {
    const list = sanitizeStorage<Vessel>(KEYS.vessels)
    if (!isSuperadmin && userCompanyId) {
      return list.filter((v) => (v.companyId || (v as any).company_id || "comp_geotekno") === userCompanyId)
    }
    return list
  })
  const [agents, setAgents] = useState<Agent[]>(() =>
    sanitizeStorage<Agent>(KEYS.agents),
  )
  const [alerts, setAlerts] = useState<Alert[]>(() =>
    sanitizeStorage<Alert>(KEYS.alerts),
  )
  const [aisTargets, setAisTargets] = useState<AisTarget[]>([])
  const [logs, setLogs] = useState<RawLog[]>([])
  const [tracks, setTracks] = useState<Record<string, TrackPoint[]>>({})

  // Purge any stale vessels from another tenant when switching users/companies
  useEffect(() => {
    if (!isSuperadmin && userCompanyId) {
      setVessels((prev) =>
        prev.filter((v) => (v.companyId || (v as any).company_id || "comp_geotekno") === userCompanyId)
      )
    }
  }, [userCompanyId, isSuperadmin])

  // Cache to localStorage for offline fast restore
  useEffect(
    () => localStorage.setItem(KEYS.vessels, JSON.stringify(vessels)),
    [vessels],
  )
  useEffect(
    () => localStorage.setItem(KEYS.agents, JSON.stringify(agents)),
    [agents],
  )
  useEffect(
    () => localStorage.setItem(KEYS.alerts, JSON.stringify(alerts)),
    [alerts],
  )

  // 1. Initial Load from Backend API
  useEffect(() => {
    let isMounted = true
    async function loadInitial() {
      try {
        const [vesselsData, agentsData, logsData, aisData] = await Promise.all([
          api.getVessels().catch(() => null),
          api.getAgents().catch(() => null),
          api.getLogs().catch(() => null),
          api.getAisTargets().catch(() => null),
        ])
        if (!isMounted) return
        if (Array.isArray(vesselsData)) {
          setVessels(vesselsData)
        }
        if (Array.isArray(agentsData)) {
          setAgents(agentsData)
        }
        if (Array.isArray(logsData)) {
          setLogs(logsData)
        }
        if (Array.isArray(aisData)) {
          setAisTargets(aisData)
        }
      } catch (err) {
        console.warn("[FleetProvider] Backend initial sync error:", err)
      }
    }
    loadInitial()
    return () => {
      isMounted = false
    }
  }, [])

  // 1b. Real-time zero-delay WebSocket stream listener (Loss Mode / Per-Frame Instant Update)
  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: any = null
    let isMounted = true

    function connect() {
      if (!isMounted) return
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const host = window.location.hostname
      // In dev mode (port 5173), backend is on 8080. In production docker, nginx proxies /ws on same host:port
      const isDevDirect = window.location.port === "5173"
      const wsUrl = isDevDirect
        ? `${protocol}//${host}:8080/ws`
        : `${protocol}//${window.location.host}/ws`

      try {
        ws = new WebSocket(wsUrl)
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === "telemetry" && msg.asset_id) {
              const u = msg.vessel_update
              if (u) {
                setVessels((prev) =>
                  prev.map((v) => {
                    if (v.id === msg.asset_id) {
                      const updated = { ...v }
                      if (u.depth !== undefined) updated.depth = u.depth
                      if (u.waterTemp !== undefined) updated.waterTemp = u.waterTemp
                      if (u.sog !== undefined) updated.sog = u.sog
                      if (u.cog !== undefined) updated.cog = u.cog
                      if (u.heading !== undefined) updated.heading = u.heading
                      if (u.pitch !== undefined) updated.pitch = u.pitch
                      if (u.roll !== undefined) updated.roll = u.roll
                      if (u.rpm !== undefined) updated.rpm = u.rpm
                      if (u.batteryVolts !== undefined) updated.batteryVolts = u.batteryVolts
                      if (u.position) updated.position = u.position
                      if (u.customAttributes) {
                        updated.customAttributes = {
                          ...(updated.customAttributes || {}),
                          ...u.customAttributes,
                        }
                      }
                      if (u.quality) {
                        updated.quality = u.quality
                      }
                      if (u.status) {
                        updated.status = u.status
                      }
                      if (u.updatedAt) {
                        updated.updatedAt = u.updatedAt
                      }
                      return updated
                    }
                    return v
                  })
                )
              }
            } else if (msg.type === "stream_logs" && Array.isArray(msg.logs)) {
              const formattedLogs: RawLog[] = msg.logs.map((item: any) => {
                const dec = item.decoded
                const summaryText = dec && typeof dec === "object"
                  ? Object.keys(dec)
                      .slice(0, 3)
                      .map((k) => `${k}: ${dec[k]}`)
                      .join(", ")
                  : `${item.type || item.protocol || "DATA"} packet on port ${item.port || 20005}`

                return {
                  id: String(item.id || Math.random()),
                  timestamp: item.timestamp
                    ? new Date(item.timestamp).toISOString()
                    : new Date().toISOString(),
                  vesselId: item.vessel_id || "vessel_96254061",
                  agentId: item.agent_id || "agent_7a3d9b1e",
                  decoder: item.protocol === "NMEA2000" ? "NMEA2000" : "NMEA0183",
                  severity: item.category === "CRITICAL" ? "error" : (item.category === "WARNING" ? "warning" : "info"),
                  payload: typeof item.raw === "string" ? item.raw : JSON.stringify(item.raw || {}),
                  summary: summaryText,
                }
              })
              setLogs((prev) => [...formattedLogs.reverse(), ...prev].slice(0, 300))
            }
          } catch {}
        }
        ws.onclose = () => {
          if (isMounted) {
            reconnectTimer = setTimeout(connect, 2000)
          }
        }
        ws.onerror = () => {
          try { ws?.close() } catch {}
        }
      } catch {}
    }

    connect()

    return () => {
      isMounted = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      try { ws?.close() } catch {}
    }
  }, [])

  // 2. Real-time Background Polling from Backend API (Port 20005 live telemetry)
  useEffect(() => {
    let isMounted = true
    const interval = window.setInterval(async () => {
      try {
        const [vesselsData, agentsData, logsData, aisData] = await Promise.all([
          api.getVessels().catch(() => null),
          api.getAgents().catch(() => null),
          api.getLogs().catch(() => null),
          api.getAisTargets().catch(() => null),
        ])
        if (!isMounted) return

        if (Array.isArray(vesselsData)) {
          setVessels(vesselsData)
          setTracks((prev) => {
            const next = { ...prev }
            for (const v of vesselsData) {
              if (v.position && v.position.lat && v.position.lng) {
                const currentList = next[v.id] ?? []
                const lastPt = currentList[currentList.length - 1]
                if (
                  !lastPt ||
                  lastPt.lat !== v.position.lat ||
                  lastPt.lng !== v.position.lng
                ) {
                  next[v.id] = [
                    ...currentList,
                    { ...v.position, timestamp: v.updatedAt },
                  ].slice(-120)
                }
              }
            }
            return next
          })
        }

        if (Array.isArray(agentsData)) {
          setAgents(agentsData)
        }

        if (Array.isArray(logsData)) {
          setLogs(logsData)
        }

        if (Array.isArray(aisData)) {
          setAisTargets(aisData)
        }
      } catch {
        // quiet error to prevent console spam
      }
    }, 2500)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [])

  const permittedVessels = useMemo(() => {
    if (isSuperadmin) return vessels
    // Multi-tenant isolation: all users in a tenant access all vessels of that tenant
    return vessels.filter((v) => {
      const vComp = v.companyId || (v as any).company_id || "comp_geotekno"
      return vComp === userCompanyId
    })
  }, [vessels, isSuperadmin, userCompanyId])

  const permittedAgents = useMemo(() => {
    if (isSuperadmin) return agents
    return agents.filter((a) => {
      const port = (a as any).port || (a as any).config?.port
      const isSharedGateway = port === 20005 || port === 20006 || a.id === "agent_7a3d9b1e" || a.id === "agent_f4a8b2c6"
      if (isSharedGateway) return true

      const aComp = a.companyId || (a as any).company_id
      return !aComp || aComp === userCompanyId
    })
  }, [agents, isSuperadmin, userCompanyId])

  const permittedLogs = useMemo(() => {
    if (isSuperadmin) return logs
    const allowedVesselIds = new Set(permittedVessels.map((v) => v.id))
    return logs.filter((l) => Boolean(l.vesselId && allowedVesselIds.has(l.vesselId)))
  }, [logs, permittedVessels, isSuperadmin])

  const permittedTracks = useMemo(() => {
    if (isSuperadmin) return tracks
    const allowedVesselIds = new Set(permittedVessels.map((v) => v.id))
    const res: Record<string, TrackPoint[]> = {}
    for (const [id, pts] of Object.entries(tracks)) {
      if (allowedVesselIds.has(id)) {
        res[id] = pts
      }
    }
    return res
  }, [tracks, permittedVessels, isSuperadmin])

  const value = useMemo<FleetContextValue>(
    () => ({
      vessels: permittedVessels,
      allVessels: permittedVessels,
      agents: permittedAgents,
      aisTargets,
      alerts,
      logs: permittedLogs,
      tracks: permittedTracks,
      addVessel: (draft) => {
        const tempId = `vessel_${Math.random().toString(16).slice(2, 10)}`
        const vessel: Vessel = {
          name: draft.name,
          type: draft.type,
          imo: draft.imo || "",
          mmsi: draft.mmsi || "",
          callSign: draft.callSign || "",
          registerContent: draft.registerContent || "",
          agentIds: draft.agentIds || [],
          destination: draft.destination || "",
          ...draft,
          id: tempId,
          status: "In Port",
          position: { lat: -6.1754, lng: 106.8272 },
          heading: 0,
          sog: 0,
          cog: 0,
          depth: 0,
          fuel: null,
          rpm: null,
          engineLoad: null,
          windSpeed: 0,
          quality: "delayed",
          updatedAt: new Date().toISOString(),
        }
        setVessels((current) => [...current, vessel])
        setTracks((current) => ({ ...current, [vessel.id]: [] }))

        api
          .createVessel(draft)
          .then((saved) => {
            if (saved && saved.id) {
              setVessels((current) =>
                current.map((v) => (v.id === tempId ? saved : v)),
              )
            }
          })
          .catch((err) => {
            console.error("Failed to save vessel to backend:", err)
          })

        return vessel
      },
      updateVessel: (id, draft) => {
        setVessels((current) =>
          current.map((vessel) =>
            vessel.id === id
              ? { ...vessel, ...draft, updatedAt: new Date().toISOString() }
              : vessel,
          ),
        )
        api
          .updateVessel(id, draft)
          .catch((err) =>
            console.error("Failed to update vessel on backend:", err),
          )
      },
      deleteVessel: (id) => {
        setVessels((current) => current.filter((vessel) => vessel.id !== id))
        api
          .deleteVessel(id)
          .catch((err) =>
            console.error("Failed to delete vessel on backend:", err),
          )
      },
      addAgent: (draft) => {
        const tempId = `agent_${Math.random().toString(16).slice(2, 10)}`
        const agent: Agent = {
          ...draft,
          id: tempId,
          status: "disconnected",
          packetsPerMinute: 0,
          lastPacketAt: new Date(0).toISOString(),
        }
        setAgents((current) => [...current, agent])

        api
          .createAgent(draft)
          .then((saved) => {
            if (saved && saved.id) {
              setAgents((current) =>
                current.map((a) => (a.id === tempId ? saved : a)),
              )
            }
          })
          .catch((err) => {
            console.error("Failed to save agent to backend:", err)
          })

        return agent
      },
      updateAgent: (id, draft) => {
        setAgents((current) =>
          current.map((agent) =>
            agent.id === id ? { ...agent, ...draft } : agent,
          ),
        )
        api
          .updateAgent(id, draft)
          .catch((err) =>
            console.error("Failed to update agent on backend:", err),
          )
      },
      deleteAgent: (id) => {
        setAgents((current) => current.filter((agent) => agent.id !== id))
        setVessels((current) =>
          current.map((vessel) => ({
            ...vessel,
            agentIds: vessel.agentIds.filter((agentId) => agentId !== id),
          })),
        )
        api
          .deleteAgent(id)
          .catch((err) =>
            console.error("Failed to delete agent on backend:", err),
          )
      },
      setAgentStatus: (id, status) => {
        setAgents((current) =>
          current.map((agent) =>
            agent.id === id ? { ...agent, status } : agent,
          ),
        )
        if (status === "testing") {
          api
            .testAgent(id)
            .then((res) => {
              setAgents((current) =>
                current.map((agent) =>
                  agent.id === id
                    ? {
                        ...agent,
                        status: res.status,
                        packetsPerMinute: res.packetsPerMinute,
                      }
                    : agent,
                ),
              )
            })
            .catch(() => {
              setAgents((current) =>
                current.map((agent) =>
                  agent.id === id ? { ...agent, status: "disconnected" } : agent,
                ),
              )
            })
        }
      },
      acknowledgeAlert: (id) =>
        setAlerts((current) =>
          current.map((alert) =>
            alert.id === id ? { ...alert, acknowledged: true } : alert,
          ),
        ),
    }),
    [permittedVessels, vessels, agents, aisTargets, alerts, permittedLogs, tracks],
  )

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}

export function useFleet() {
  const context = useContext(FleetContext)
  if (!context) throw new Error("useFleet must be used inside FleetProvider")
  return context
}
