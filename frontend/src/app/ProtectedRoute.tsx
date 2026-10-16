import React from "react"
import { Navigate, useLocation } from "react-router"
import { useAuth } from "@/state/AuthProvider"
import { ShieldAlert, Compass } from "lucide-react"

interface ProtectedRouteProps {
  children?: React.ReactNode
  pageKey?: string
  action?: "read" | "write"
  requireSuperadmin?: boolean
}

export function ProtectedRoute({
  children,
  pageKey,
  action = "read",
  requireSuperadmin = false,
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated, isSuperadmin, canAccessPage } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-900 text-white">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#db4040]/30 opacity-75" />
          <Compass className="h-10 w-10 animate-spin text-[#db4040]" />
        </div>
        <p className="mt-4 text-xs font-semibold tracking-wider text-slate-300 uppercase">
          Verifying Navigation Credentials...
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireSuperadmin && !isSuperadmin) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 shadow-inner">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-800">Access Denied (403 Forbidden)</h2>
        <p className="mt-2 max-w-md text-xs text-slate-500">
          This section is restricted to <strong>Superadmin</strong> accounts. Your current account (
          <span className="font-semibold text-slate-700">{user?.email}</span>) does not have administrative privileges.
        </p>
      </div>
    )
  }

  if (pageKey && !canAccessPage(pageKey, action)) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-inner">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-800">Restricted Page Permissions</h2>
        <p className="mt-2 max-w-md text-xs text-slate-500">
          You do not have permission to view the <strong>{pageKey}</strong> page. Please contact your Superadmin to update your role permissions.
        </p>
      </div>
    )
  }

  return children ? <>{children}</> : null
}
