import type {
  Agent,
  AgentDraft,
  AisTarget,
  AssetAttribute,
  AssetAttributeDraft,
  DiscoveredSignal,
  RawLog,
  TrackPoint,
  Vessel,
  VesselDraft,
} from "@/domain/types"

import { getStoredToken } from "./authApi"

const BASE_URL = "/api/v1"

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options?.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    let errMessage = `HTTP Error ${response.status}: ${response.statusText}`
    try {
      const data = await response.json()
      if (data && data.error) errMessage = data.error
    } catch {
      // ignore
    }
    throw new Error(errMessage)
  }

  return response.json() as Promise<T>
}

export const api = {
  // --- Vessels ---
  getVessels(): Promise<Vessel[]> {
    return request<Vessel[]>("/vessels")
  },

  createVessel(draft: VesselDraft): Promise<Vessel> {
    return request<Vessel[]>("/vessels", {
      method: "POST",
      body: JSON.stringify(draft),
    }) as unknown as Promise<Vessel>
  },

  updateVessel(id: string, draft: Partial<Vessel>): Promise<Vessel> {
    return request<Vessel>(`/vessels/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(draft),
    })
  },

  deleteVessel(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/vessels/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
  },

  // --- Agents ---
  getAgents(): Promise<Agent[]> {
    return request<Agent[]>("/agents")
  },

  createAgent(draft: AgentDraft): Promise<Agent> {
    return request<Agent>("/agents", {
      method: "POST",
      body: JSON.stringify(draft),
    })
  },

  updateAgent(id: string, draft: Partial<AgentDraft>): Promise<Agent> {
    return request<Agent>(`/agents/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(draft),
    })
  },

  deleteAgent(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/agents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
  },

  testAgent(id: string): Promise<{
    success: boolean
    agentId: string
    status: Agent["status"]
    packetsPerMinute: number
    message: string
  }> {
    return request(`/agents/${encodeURIComponent(id)}/test`, {
      method: "POST",
    })
  },

  testDecoder(decoderCode: string, samplePayload?: string): Promise<{
    success: boolean
    input: string
    output: any
    error?: string
  }> {
    return request("/agents/test-decoder", {
      method: "POST",
      body: JSON.stringify({ decoderCode, samplePayload }),
    })
  },

  // --- Logs, AIS, Tracks ---
  getLogs(): Promise<RawLog[]> {
    return request<RawLog[]>("/logs")
  },

  getAisTargets(vesselId?: string): Promise<AisTarget[]> {
    const url = vesselId ? `/ais?vessel_id=${encodeURIComponent(vesselId)}` : "/ais"
    return request<AisTarget[]>(url)
  },

  getTracks(): Promise<Record<string, TrackPoint[]>> {
    return request<Record<string, TrackPoint[]>>("/tracks")
  },

  // --- Asset Attributes & Telemetry Registry ---
  getAttributes(vesselId: string): Promise<AssetAttribute[]> {
    return request<AssetAttribute[]>(`/vessels/${encodeURIComponent(vesselId)}/attributes`)
  },

  createAttribute(vesselId: string, draft: AssetAttributeDraft): Promise<AssetAttribute> {
    return request<AssetAttribute>(`/vessels/${encodeURIComponent(vesselId)}/attributes`, {
      method: "POST",
      body: JSON.stringify(draft),
    })
  },

  updateAttribute(
    vesselId: string,
    attrId: string,
    draft: Partial<AssetAttributeDraft>,
  ): Promise<AssetAttribute> {
    return request<AssetAttribute>(
      `/vessels/${encodeURIComponent(vesselId)}/attributes/${encodeURIComponent(attrId)}`,
      {
        method: "PUT",
        body: JSON.stringify(draft),
      },
    )
  },

  deleteAttribute(vesselId: string, attrId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/vessels/${encodeURIComponent(vesselId)}/attributes/${encodeURIComponent(attrId)}`,
      {
        method: "DELETE",
      },
    )
  },

  scanAvailableSignals(vesselId: string): Promise<DiscoveredSignal[]> {
    return request<DiscoveredSignal[]>(
      `/vessels/${encodeURIComponent(vesselId)}/attributes/scan`,
    )
  },

  // --- Telemetry History & Export ---
  getTelemetryHistory(params?: {
    assetId?: string
    vesselId?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  }): Promise<{ total: number; records: any[]; source: string }> {
    const searchParams = new URLSearchParams()
    if (params?.assetId) searchParams.append("asset_id", params.assetId)
    if (params?.vesselId) searchParams.append("vessel_id", params.vesselId)
    if (params?.from) searchParams.append("from", params.from)
    if (params?.to) searchParams.append("to", params.to)
    if (params?.limit) searchParams.append("limit", String(params.limit))
    if (params?.offset) searchParams.append("offset", String(params.offset))
    const query = searchParams.toString()
    return request<{ total: number; records: any[]; source: string }>(
      `/telemetry/history${query ? `?${query}` : ""}`,
    )
  },
}
