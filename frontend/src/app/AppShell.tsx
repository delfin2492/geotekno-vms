import { useState, useRef, useEffect } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router"
import {
  ChevronDown,
  Download,
  Gauge,
  LayoutDashboard,
  Menu,
  Radio,
  ScrollText,
  Ship,
  Users,
  LogOut,
  ShieldCheck,
  Building2,
  X,
} from "lucide-react"
import { FleetProvider } from "@/state/FleetProvider"
import { useAuth } from "@/state/AuthProvider"
import { ProtectedRoute } from "@/app/ProtectedRoute"

interface NavItem {
  to: string
  label: string
  icon: any
  end?: boolean
  pageKey?: string
  superadminOnly?: boolean
}

const baseNav: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true, pageKey: "overview" },
  { to: "/marine-traffic", label: "Marine Traffic", icon: Radio, pageKey: "marine_traffic" },
  { to: "/vessels", label: "Vessel Assets", icon: Ship, pageKey: "vessels" },
  { to: "/monitoring", label: "Monitoring", icon: Gauge, pageKey: "monitoring" },
  { to: "/logs", label: "Live Logs", icon: ScrollText, pageKey: "logs" },
  { to: "/export", label: "Data Export", icon: Download, pageKey: "export" },
]

function Logo() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5 transition hover:opacity-90"
      aria-label="GeoTekno VMS Overview"
    >
      <img
        src="/logo.png"
        alt="GEOTEKNO"
        className="h-8 w-auto max-w-[140px] sm:max-w-[170px] object-contain"
      />
      <span className="hidden sm:inline-flex items-center rounded-md bg-[#db4040]/10 px-2 py-0.5 text-[11px] font-black text-[#db4040] uppercase tracking-wider border border-[#db4040]/20">
        VMS
      </span>
    </Link>
  )
}

function ShellContent() {
  const { user, logout, isSuperadmin, isCompanyAdmin, canAccessPage } = useAuth()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter navigation items according to user permissions
  const visibleNav = baseNav.filter((item) => {
    if (item.superadminOnly) return isSuperadmin
    if (isSuperadmin) return true
    if (item.pageKey) return canAccessPage(item.pageKey, "read")
    return true
  })

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setUserDropdownOpen(false)
    await logout()
    navigate("/login")
  }

  const userInitials = user?.name
    ? user.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
    : "GT"

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white text-slate-800 shadow-sm">
        <div className="mx-auto flex h-[68px] max-w-[1800px] items-center gap-3 px-4 sm:px-6">
          <Logo />
          <nav
            className="mx-auto hidden items-center gap-1 lg:flex"
            aria-label="Primary navigation"
          >
            {visibleNav.map(({ to, label, icon: NavIcon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition ${isActive
                    ? "bg-[#db4040] text-white shadow-sm shadow-red-500/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <NavIcon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* User Profile & Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 rounded-xl hover:bg-slate-50 px-2 py-1 transition sm:flex"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-red-400 to-[#db4040] text-[10px] font-bold text-white shadow-sm">
                  {userInitials}
                </span>
                <span className="hidden text-left xl:block">
                  <span className="block text-[11px] font-bold text-slate-800">
                    {user?.name || "Operator"}
                  </span>
                  <span className="block text-[9px] font-medium text-slate-400">
                    {user?.role_name || (isSuperadmin ? "Super Admin" : isCompanyAdmin ? "Company Admin" : "Fleet Operator")}
                  </span>
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="text-xs font-bold text-slate-900">{user?.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {isSuperadmin ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[9px] font-bold text-[#db4040]">
                          <ShieldCheck className="h-3 w-3" /> SUPERADMIN
                        </span>
                      ) : isCompanyAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200">
                          <Building2 className="h-3 w-3" /> COMPANY ADMIN
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                          {user?.role_name ? user.role_name.toUpperCase() : "FLEET OPERATOR"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-1">
                    {(isSuperadmin || canAccessPage("users", "read")) && (
                      <Link
                        to="/users"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Users className="h-4 w-4 text-[#db4040]" />
                        <span>User Management</span>
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setOpen(!open)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            className="border-t border-slate-100 bg-white p-3 shadow-lg lg:hidden"
            aria-label="Mobile navigation"
          >
            <div className="grid gap-1 sm:grid-cols-2">
              {visibleNav.map(({ to, label, icon: NavIcon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold ${isActive
                      ? "bg-[#db4040] text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`
                  }
                >
                  <NavIcon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>
      <Outlet />
    </div>
  )
}

export function AppShell() {
  return (
    <ProtectedRoute>
      <FleetProvider>
        <ShellContent />
      </FleetProvider>
    </ProtectedRoute>
  )
}
