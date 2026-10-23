import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { authApi, getStoredToken, getStoredUser, setStoredToken, setStoredUser, type User } from "@/services/authApi"

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  isSuperadmin: boolean
  isCompanyAdmin: boolean
  companyId: string
  companyName: string
  companyCode: string
  selectedCompanyFilter: string
  setSelectedCompanyFilter: (id: string) => void
  login: (credentials: { email: string; password: string }) => Promise<void>
  register: (data: { name: string; email: string; password: string }) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  canAccessPage: (pageKey: string, action?: "read" | "write") => boolean
  canAccessFeature: (featureKey: string, action?: "read" | "write") => boolean
  canAccessSection: (sectionId: string, action?: "read" | "write") => boolean
  canAccessVessel: (vesselId: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("all")

  const refreshProfile = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const me = await authApi.getMe()
      setUser(me)
    } catch (err) {
      console.warn("[Auth] Failed to refresh user profile:", err)
      // If token expired or invalid, clear local auth
      setStoredToken(null)
      setStoredUser(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const login = async (credentials: { email: string; password: string }) => {
    const res = await authApi.login(credentials)
    setUser(res.user)
  }

  const register = async (data: { name: string; email: string; password: string }) => {
    return authApi.register(data)
  }

  const logout = async () => {
    await authApi.logout()
    setUser(null)
  }

  const isSuperadmin = !!user?.isSuperadmin
  const isCompanyAdmin = !!user?.isCompanyAdmin || !!user?.is_company_admin || user?.role_id === "role_company_admin"

  const canAccessPage = useCallback(
    (pageKey: string, action: "read" | "write" = "read"): boolean => {
      if (!user) return false
      if (user.isSuperadmin) return true

      const pagePerm = user.permissions?.pages?.[pageKey]
      if (!pagePerm) return false

      if (action === "write") return !!pagePerm.write
      return !!pagePerm.read
    },
    [user]
  )

  const canAccessFeature = useCallback(
    (featureKey: string, action: "read" | "write" = "read"): boolean => {
      if (!user) return false
      if (user.isSuperadmin) return true

      const featurePerm = user.permissions?.features?.[featureKey]
      if (!featurePerm) return false

      if (action === "write") return !!featurePerm.write
      return !!featurePerm.read
    },
    [user]
  )

  const canAccessVessel = useCallback(
    (vesselId: string): boolean => {
      if (!user) return false
      if (user.isSuperadmin) return true
      if (user.vessels?.includes("*")) return true
      return !!user.vessels?.includes(vesselId)
    },
    [user]
  )

  const canAccessSection = useCallback(
    (sectionId: string, action: "read" | "write" = "read"): boolean => {
      if (!user) return false
      if (user.isSuperadmin) return true

      const sectionsPerm = user.permissions?.sections
      // If no section permissions configured at all on this role, default allow for backwards compatibility
      if (!sectionsPerm || Object.keys(sectionsPerm).length === 0) return true

      // Exact match or wildcard '*' match
      const sectionPerm = sectionsPerm[sectionId] || sectionsPerm["*"]
      if (!sectionPerm) return false

      if (action === "write") return !!sectionPerm.write
      return !!sectionPerm.read
    },
    [user]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isSuperadmin,
        isCompanyAdmin,
        companyId: user?.company_id || user?.companyId || "comp_geotekno",
        companyName: user?.company_name || user?.companyName || "PT Geo Tekno Indonesia",
        companyCode: user?.company_code || "GEOTEKNO",
        selectedCompanyFilter,
        setSelectedCompanyFilter,
        login,
        register,
        logout,
        refreshProfile,
        canAccessPage,
        canAccessFeature,
        canAccessSection,
        canAccessVessel,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
