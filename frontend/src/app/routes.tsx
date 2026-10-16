import { createBrowserRouter } from "react-router"
import { AppShell } from "@/app/AppShell"
import { ProtectedRoute } from "@/app/ProtectedRoute"

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: async () => ({
      Component: (await import("@/pages/LoginPage")).LoginPage,
    }),
  },
  {
    path: "/",
    Component: AppShell,
    children: [
      {
        index: true,
        lazy: async () => {
          const { OverviewPage } = await import("@/pages/OverviewPage")
          return {
            Component: () => (
              <ProtectedRoute pageKey="overview">
                <OverviewPage />
              </ProtectedRoute>
            ),
          }
        },
      },
      {
        path: "marine-traffic",
        lazy: async () => {
          const { MarineTrafficPage } = await import("@/pages/MarineTrafficPage")
          return {
            Component: () => (
              <ProtectedRoute pageKey="marine_traffic">
                <MarineTrafficPage />
              </ProtectedRoute>
            ),
          }
        },
      },
      {
        path: "vessels",
        lazy: async () => {
          const { VesselAssetsPage } = await import("@/pages/VesselAssetsPage")
          return {
            Component: () => (
              <ProtectedRoute pageKey="vessels">
                <VesselAssetsPage />
              </ProtectedRoute>
            ),
          }
        },
      },
      {
        path: "monitoring",
        lazy: async () => {
          const { MonitoringPage } = await import("@/pages/MonitoringPage")
          return {
            Component: () => (
              <ProtectedRoute pageKey="monitoring">
                <MonitoringPage />
              </ProtectedRoute>
            ),
          }
        },
      },
      {
        path: "logs",
        lazy: async () => {
          const { LiveLogsPage } = await import("@/pages/LiveLogsPage")
          return {
            Component: () => (
              <ProtectedRoute pageKey="logs">
                <LiveLogsPage />
              </ProtectedRoute>
            ),
          }
        },
      },
      {
        path: "export",
        lazy: async () => {
          const { DataExportPage } = await import("@/pages/DataExportPage")
          return {
            Component: () => (
              <ProtectedRoute pageKey="export">
                <DataExportPage />
              </ProtectedRoute>
            ),
          }
        },
      },
      {
        path: "users",
        lazy: async () => {
          const { UserManagementPage } = await import("@/pages/UserManagementPage")
          return {
            Component: () => (
              <ProtectedRoute requireSuperadmin>
                <UserManagementPage />
              </ProtectedRoute>
            ),
          }
        },
      },
      {
        path: "*",
        lazy: async () => ({
          Component: (await import("@/pages/NotFoundPage")).NotFoundPage,
        }),
      },
    ],
  },
])
