import { useState, useEffect } from "react"
import { authApi, type User, type Role } from "@/services/authApi"
import { api } from "@/services/api"
import type { Vessel, Company } from "@/domain/types"
import { useAuth } from "@/state/AuthProvider"
import { ConfirmModal } from "@/components/common/UI"
import {
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Compass,
  AlertCircle,
  KeyRound,
  Ship,
  Sliders,
  CheckCircle2,
  Shield,
  Layers,
  Lock,
  Building2,
  Server,
} from "lucide-react"

const AVAILABLE_PAGES = [
  { key: "overview", label: "Fleet Overview", desc: "Fleet summary, maritime KPIs, & gateway health" },
  { key: "marine_traffic", label: "Marine Traffic", desc: "Live AIS map & own-ship tracking" },
  { key: "vessels", label: "Vessel Assets", desc: "Digital twin, decoder pipelines, & telemetry" },
  { key: "monitoring", label: "Monitoring Dashboard", desc: "Dynamic maritime telemetry & instruments" },
  { key: "logs", label: "Live Logs", desc: "Raw NMEA 2000 & NMEA 0183 log stream" },
  { key: "export", label: "Data Export", desc: "Telemetry history, sensor feeds & attribute export" },
  { key: "users", label: "User & Access Management", desc: "Manage team member accounts and access permissions" },
]

const AVAILABLE_FEATURES = [
  { key: "vessel.decoder", label: "JavaScript Decoder Editor", desc: "Modify vessel telemetry decoding algorithms" },
  { key: "vessel.agent", label: "Gateway Agent Controller", desc: "Connect, configure ports, & start/stop agent" },
  { key: "telemetry.export", label: "Telemetry History Export", desc: "Download vessel NMEA logs & CSV archives" },
]

const AVAILABLE_SECTIONS = [
  { key: "section-nav", label: "Navigation & Maneuvering", desc: "Speed over ground, heading, compass, water depth, and position instruments" },
  { key: "section-engine", label: "Engine & Machinery", desc: "Machinery status, propulsion RPM trends, and fuel telemetry diagnostics" },
  { key: "*", label: "Custom / Additional Sections", desc: "Access to newly created dashboard sections and command centers" },
]

export function UserManagementPage() {
  const { user: currentUser, canAccessPage } = useAuth()
  const isSuperadmin = Boolean(currentUser?.isSuperadmin ?? (currentUser as any)?.is_superadmin)
  const canWriteUser = isSuperadmin || canAccessPage("users", "write")

  const [activeTab, setActiveTab] = useState<"users" | "roles" | "companies">("users")
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Custom Confirmation / Alert Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: React.ReactNode
    confirmLabel?: string
    cancelLabel?: string
    isAlert?: boolean
    variant?: "danger" | "warning" | "info"
    onConfirm: () => void
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => { },
  })

  // User Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [userModalMode, setUserModalMode] = useState<"create" | "edit">("create")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // User Form State
  const [userFormData, setUserFormData] = useState({
    name: "",
    email: "",
    password: "",
    role_id: "role_fleet_operator",
    company_id: "comp_geotekno",
    is_active: true,
    assigned_vessels: [] as string[],
  })

  // Role Modals
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [roleModalMode, setRoleModalMode] = useState<"create" | "edit">("create")
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  // Role Form State
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    description: "",
    pagePermissions: {} as Record<string, { read: boolean; write: boolean }>,
    featurePermissions: {} as Record<string, { read: boolean; write: boolean }>,
    sectionPermissions: {} as Record<string, { read: boolean; write: boolean }>,
  })

  // Company Modals & State
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [companyModalMode, setCompanyModalMode] = useState<"create" | "edit">("create")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [companyFormData, setCompanyFormData] = useState({
    name: "",
    code: "",
    description: "",
  })

  // Dynamic Monitoring Sections loaded from DB
  const [monitoringSections, setMonitoringSections] = useState<{ key: string; label: string; desc: string }[]>(AVAILABLE_SECTIONS)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, rolesRes, vesselsRes, sectionsRes, companiesRes] = await Promise.all([
        authApi.listUsers(),
        authApi.listRoles(),
        api.getVessels(),
        api.getMonitoringSections().catch(() => []),
        authApi.listCompanies().catch(() => [] as Company[]),
      ])
      setUsers(usersRes.users)
      setRoles(rolesRes.roles)
      setVessels(vesselsRes)
      setCompanies(Array.isArray(companiesRes) ? companiesRes : [])

      if (Array.isArray(sectionsRes) && sectionsRes.length > 0) {
        const dynamicList = sectionsRes.map((s) => ({
          key: s.id,
          label: s.name,
          desc: s.description || `Section scope for ${s.name}`,
        }))
        if (!dynamicList.some((s) => s.key === "*")) {
          dynamicList.push({
            key: "*",
            label: "Custom / Additional Sections",
            desc: "Access to newly created dashboard sections and command centers",
          })
        }
        setMonitoringSections(dynamicList)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load directory data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ==========================================
  // USER MODAL HANDLERS
  // ==========================================

  const openCreateUserModal = () => {
    setUserModalMode("create")
    setSelectedUser(null)
    setUserFormData({
      name: "",
      email: "",
      password: "",
      role_id: roles.length > 0 ? roles[0].id : "role_fleet_operator",
      company_id: currentUser?.company_id || "comp_geotekno",
      is_active: true,
      assigned_vessels: vessels.length > 0 ? [vessels[0].id] : [],
    })
    setIsUserModalOpen(true)
  }

  const openEditUserModal = (targetUser: User) => {
    setUserModalMode("edit")
    setSelectedUser(targetUser)

    const assignedVessels = Array.isArray(targetUser.vessels)
      ? targetUser.vessels.map((v: any) => (typeof v === "string" ? v : v.vessel_id))
      : []

    let roleId = targetUser.role_id
    if (!roleId) {
      roleId = (targetUser.isSuperadmin || (targetUser as any).is_superadmin)
        ? "role_superadmin"
        : "role_fleet_operator"
    }

    setUserFormData({
      name: targetUser.name,
      email: targetUser.email,
      password: "",
      role_id: roleId,
      company_id: targetUser.company_id || "comp_geotekno",
      is_active: targetUser.isActive ?? (targetUser as any).is_active ?? true,
      assigned_vessels: assignedVessels,
    })
    setIsUserModalOpen(true)
  }

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      if (userModalMode === "create") {
        await authApi.createUser({
          name: userFormData.name,
          email: userFormData.email,
          password: userFormData.password,
          role_id: userFormData.role_id,
          company_id: userFormData.company_id,
          is_active: userFormData.is_active,
          vessels: userFormData.assigned_vessels,
        })
        setSuccess("New user account created successfully.")
      } else {
        if (!selectedUser) return
        await authApi.updateUser(selectedUser.id, {
          name: userFormData.name,
          email: userFormData.email,
          password: userFormData.password || undefined,
          role_id: userFormData.role_id,
          company_id: userFormData.company_id,
          is_active: userFormData.is_active,
          vessels: userFormData.assigned_vessels,
        })
        setSuccess("User account updated successfully.")
      }
      setIsUserModalOpen(false)
      loadData()
    } catch (err: any) {
      setError(err.message || "Failed to save user.")
    }
  }

  // ==========================================
  // COMPANY MODAL HANDLERS
  // ==========================================

  const openCreateCompanyModal = () => {
    setCompanyModalMode("create")
    setSelectedCompany(null)
    setCompanyFormData({
      name: "",
      code: "",
      description: "",
    })
    setIsCompanyModalOpen(true)
  }

  const openEditCompanyModal = (comp: Company) => {
    setCompanyModalMode("edit")
    setSelectedCompany(comp)
    setCompanyFormData({
      name: comp.name,
      code: comp.code || "",
      description: comp.description || "",
    })
    setIsCompanyModalOpen(true)
  }

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      if (companyModalMode === "create") {
        await authApi.createCompany({
          name: companyFormData.name,
          code: companyFormData.code,
          description: companyFormData.description,
        })
        setSuccess(`Company "${companyFormData.name}" registered successfully.`)
      } else {
        if (!selectedCompany) return
        await authApi.updateCompany(selectedCompany.id, {
          name: companyFormData.name,
          code: companyFormData.code,
          description: companyFormData.description,
        })
        setSuccess(`Company "${companyFormData.name}" updated successfully.`)
      }
      setIsCompanyModalOpen(false)
      loadData()
    } catch (err: any) {
      setError(err.message || "Failed to save company.")
    }
  }

  const handleDeleteCompany = (comp: Company) => {
    if (comp.id === "comp_geotekno") {
      setConfirmDialog({
        open: true,
        title: "System Default Organization",
        message: "The default primary company 'PT Geo Tekno Indonesia' cannot be deleted.",
        confirmLabel: "Understood",
        isAlert: true,
        variant: "warning",
        onConfirm: () => { },
      })
      return
    }

    setConfirmDialog({
      open: true,
      title: "Delete Company",
      message: (
        <span>
          Are you sure you want to delete company <strong>"{comp.name}"</strong>? Any vessels, agents, or users assigned to this company will become unassigned.
        </span>
      ),
      confirmLabel: "Delete Company",
      cancelLabel: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        try {
          await authApi.deleteCompany(comp.id)
          setSuccess(`Company "${comp.name}" deleted successfully.`)
          loadData()
        } catch (err: any) {
          setError(err.message || "Failed to delete company.")
        }
      },
    })
  }

  const handleDeleteUser = (userToDelete: User) => {
    if (userToDelete.id === currentUser?.id) {
      setConfirmDialog({
        open: true,
        title: "Action Restricted",
        message: "You cannot delete your own active administrator account.",
        confirmLabel: "Understood",
        isAlert: true,
        variant: "warning",
        onConfirm: () => { },
      })
      return
    }

    setConfirmDialog({
      open: true,
      title: "Delete User Account",
      message: (
        <span>
          Are you sure you want to delete user <strong>"{userToDelete.name}"</strong> ({userToDelete.email})? This action cannot be undone.
        </span>
      ),
      confirmLabel: "Delete User",
      cancelLabel: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        try {
          await authApi.deleteUser(userToDelete.id)
          setSuccess(`User ${userToDelete.name} has been deleted.`)
          loadData()
        } catch (err: any) {
          setError(err.message || "Failed to delete user.")
        }
      },
    })
  }

  // ==========================================
  // ROLE MODAL HANDLERS
  // ==========================================

  const openCreateRoleModal = () => {
    setRoleModalMode("create")
    setSelectedRole(null)

    const defaultPages: Record<string, { read: boolean; write: boolean }> = {}
    AVAILABLE_PAGES.forEach((p) => {
      defaultPages[p.key] = { read: true, write: false }
    })

    const defaultFeatures: Record<string, { read: boolean; write: boolean }> = {}
    AVAILABLE_FEATURES.forEach((f) => {
      defaultFeatures[f.key] = { read: false, write: false }
    })

    const defaultSections: Record<string, { read: boolean; write: boolean }> = {}
    monitoringSections.forEach((s) => {
      defaultSections[s.key] = { read: true, write: false }
    })

    setRoleFormData({
      name: "",
      description: "",
      pagePermissions: defaultPages,
      featurePermissions: defaultFeatures,
      sectionPermissions: defaultSections,
    })
    setIsRoleModalOpen(true)
  }

  const openEditRoleModal = (role: Role) => {
    setRoleModalMode("edit")
    setSelectedRole(role)

    const pagePerms: Record<string, { read: boolean; write: boolean }> = {}
    AVAILABLE_PAGES.forEach((p) => {
      const existing = role.permissions?.pages?.[p.key]
      pagePerms[p.key] = {
        read: existing?.read ?? (role.id === "role_superadmin"),
        write: existing?.write ?? (role.id === "role_superadmin"),
      }
    })

    const featPerms: Record<string, { read: boolean; write: boolean }> = {}
    AVAILABLE_FEATURES.forEach((f) => {
      const existing = role.permissions?.features?.[f.key]
      featPerms[f.key] = {
        read: existing?.read ?? (role.id === "role_superadmin"),
        write: existing?.write ?? (role.id === "role_superadmin"),
      }
    })

    const secPerms: Record<string, { read: boolean; write: boolean }> = {}
    // Ensure all sections currently loaded or previously configured in role are represented
    const knownKeys = new Set([
      ...monitoringSections.map((s) => s.key),
      ...Object.keys(role.permissions?.sections || {}),
    ])
    knownKeys.forEach((key) => {
      const existing = role.permissions?.sections?.[key]
      const wildcard = role.permissions?.sections?.["*"]
      secPerms[key] = {
        read: existing?.read ?? wildcard?.read ?? (role.id === "role_superadmin"),
        write: existing?.write ?? wildcard?.write ?? (role.id === "role_superadmin"),
      }
    })

    setRoleFormData({
      name: role.name,
      description: role.description || "",
      pagePermissions: pagePerms,
      featurePermissions: featPerms,
      sectionPermissions: secPerms,
    })
    setIsRoleModalOpen(true)
  }

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const permissionsPayload = [
        ...Object.entries(roleFormData.pagePermissions).map(([k, v]) => ({
          resource_type: "PAGE",
          resource_key: k,
          can_read: v.read,
          can_write: v.write,
        })),
        ...Object.entries(roleFormData.featurePermissions).map(([k, v]) => ({
          resource_type: "FEATURE",
          resource_key: k,
          can_read: v.read,
          can_write: v.write,
        })),
        ...Object.entries(roleFormData.sectionPermissions).map(([k, v]) => ({
          resource_type: "SECTION",
          resource_key: k,
          can_read: v.read,
          can_write: v.write,
        })),
      ]

      if (roleModalMode === "create") {
        await authApi.createRole({
          name: roleFormData.name,
          description: roleFormData.description,
          permissions: permissionsPayload,
        })
        setSuccess(`Role "${roleFormData.name}" created successfully.`)
      } else {
        if (!selectedRole) return
        await authApi.updateRole(selectedRole.id, {
          name: roleFormData.name,
          description: roleFormData.description,
          permissions: permissionsPayload,
        })
        setSuccess(`Role "${roleFormData.name}" updated successfully.`)
      }
      setIsRoleModalOpen(false)
      loadData()
    } catch (err: any) {
      setError(err.message || "Failed to save role.")
    }
  }

  const handleDeleteRole = (roleToDelete: Role) => {
    if (roleToDelete.is_system) {
      setConfirmDialog({
        open: true,
        title: "System Role Protected",
        message: "System default roles (Superadmin, Fleet Operator, Viewer) are critical and cannot be deleted.",
        confirmLabel: "Understood",
        isAlert: true,
        variant: "warning",
        onConfirm: () => { },
      })
      return
    }

    setConfirmDialog({
      open: true,
      title: "Delete Custom Role",
      message: (
        <span>
          Are you sure you want to delete role <strong>"{roleToDelete.name}"</strong>? Users currently assigned to this role will lose their inherited permissions until assigned to another role.
        </span>
      ),
      confirmLabel: "Delete Role",
      cancelLabel: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        try {
          await authApi.deleteRole(roleToDelete.id)
          setSuccess(`Role "${roleToDelete.name}" deleted successfully.`)
          loadData()
        } catch (err: any) {
          setError(err.message || "Failed to delete role.")
        }
      },
    })
  }

  const toggleVessel = (vesselId: string) => {
    setUserFormData((prev) => {
      const exists = prev.assigned_vessels.includes(vesselId)
      return {
        ...prev,
        assigned_vessels: exists
          ? prev.assigned_vessels.filter((id) => id !== vesselId)
          : [...prev.assigned_vessels, vesselId],
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Title */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-[#db4040]">
                <Users className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-800">User & Access Management</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Manage team accounts, define roles with page & feature permissions, and assign fleet vessel access.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === "users" ? (
              canWriteUser && (
                <button
                  onClick={openCreateUserModal}
                  className="flex items-center gap-2 rounded-xl bg-[#db4040] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add User</span>
                </button>
              )
            ) : activeTab === "roles" ? (
              isSuperadmin && (
                <button
                  onClick={openCreateRoleModal}
                  className="flex items-center gap-2 rounded-xl bg-[#db4040] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New Role</span>
                </button>
              )
            ) : (
              isSuperadmin && (
                <button
                  onClick={openCreateCompanyModal}
                  className="flex items-center gap-2 rounded-xl bg-[#db4040] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Register Company</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${activeTab === "users"
                ? "border-[#db4040] text-[#db4040]"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
          >
            <Users className="h-4 w-4" />
            <span>Users Directory ({users.length})</span>
          </button>
          {isSuperadmin && (
            <button
              onClick={() => setActiveTab("roles")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${activeTab === "roles"
                  ? "border-[#db4040] text-[#db4040]"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Roles & Permissions ({roles.length})</span>
            </button>
          )}
          {isSuperadmin && (
            <button
              onClick={() => setActiveTab("companies")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${activeTab === "companies"
                  ? "border-[#db4040] text-[#db4040]"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Companies Directory ({companies.length})</span>
            </button>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 1: USERS DIRECTORY                     */}
        {/* ========================================== */}
        {activeTab === "users" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Registered Accounts ({users.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Name & Email</th>
                    <th className="px-6 py-3.5">Company</th>
                    <th className="px-6 py-3.5">Assigned Role</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Vessel Access</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Compass className="mx-auto h-6 w-6 animate-spin text-[#db4040]" />
                        <p className="mt-2 font-medium">Loading user accounts...</p>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No registered users found. Click "+ Add User" to register an operator.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = u.id === currentUser?.id
                      const isSuper = !!(u.isSuperadmin ?? (u as any).is_superadmin)
                      const displayRoleName = u.role_name || (isSuper ? "Superadmin" : "Fleet Operator")
                      const compName = u.company_name || companies.find((c) => c.id === u.company_id)?.name || "Geo Tekno"

                      return (
                        <tr key={u.id} className="transition hover:bg-slate-50/60">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 uppercase">
                                {u.name ? u.name.substring(0, 2) : "US"}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900">{u.name}</span>
                                  {isSelf && (
                                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-[#db4040]">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                              <Building2 className="h-3 w-3" />
                              {compName}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {isSuper ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-[#db4040] ring-1 ring-inset ring-red-600/20">
                                <ShieldCheck className="h-3 w-3" />
                                {displayRoleName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                                <Shield className="h-3 w-3 text-slate-500" />
                                {displayRoleName}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {(u.isActive ?? (u as any).is_active ?? true) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isSuper ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                <Ship className="h-3 w-3" />
                                Full Fleet (All Vessels)
                              </span>
                            ) : u.vessels && u.vessels.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {u.vessels.slice(0, 2).map((vItem: any) => {
                                  const vId = typeof vItem === "string" ? vItem : vItem.vessel_id
                                  const vesselObj = vessels.find((v) => v.id === vId)
                                  return (
                                    <span
                                      key={vId}
                                      className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                                    >
                                      <Ship className="h-2.5 w-2.5 text-slate-400" />
                                      {vesselObj ? vesselObj.name : vId}
                                    </span>
                                  )
                                })}
                                {u.vessels.length > 2 && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                    +{u.vessels.length - 2} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No assigned vessels</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {canWriteUser ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openEditUserModal(u)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                                  title="Edit User"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                {!isSelf && (!u.isSuperadmin && !(u as any).is_superadmin || isSuperadmin) && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                    title="Delete User"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Read-only</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: ROLES & PERMISSIONS                 */}
        {/* ========================================== */}
        {activeTab === "roles" && (
          <div className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role) => {
                const isSuperRole = role.id === "role_superadmin"
                const pageCount = Object.keys(role.permissions?.pages || {}).length
                const featCount = Object.keys(role.permissions?.features || {}).length

                return (
                  <div
                    key={role.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-xl ${isSuperRole
                                ? "bg-red-100 text-[#db4040]"
                                : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            <Shield className="h-4 w-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{role.name}</h3>
                            <span className="text-[10px] text-slate-400">ID: {role.id}</span>
                          </div>
                        </div>

                        {role.is_system ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                            SYSTEM
                          </span>
                        ) : (
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                            CUSTOM
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-xs text-slate-600 line-clamp-2 min-h-[32px]">
                        {role.description || "No description provided."}
                      </p>

                      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Layers className="h-3.5 w-3.5 text-slate-400" />
                            Page Modules:
                          </span>
                          <span className="font-bold text-slate-900">
                            {isSuperRole ? "All (Full Access)" : `${pageCount} Allowed`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Sliders className="h-3.5 w-3.5 text-slate-400" />
                            Feature Scopes:
                          </span>
                          <span className="font-bold text-slate-900">
                            {isSuperRole ? "Full Control" : `${featCount} Configured`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Compass className="h-3.5 w-3.5 text-slate-400" />
                            Monitoring Sections:
                          </span>
                          <span className="font-bold text-slate-900">
                            {isSuperRole ? "All Sections" : `${Object.keys(role.permissions?.sections || {}).length} Configured`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            Active Users:
                          </span>
                          <span className="font-bold text-[#db4040]">
                            {role.userCount ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => openEditRoleModal(role)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit Permissions</span>
                      </button>

                      {!role.is_system && (
                        <button
                          onClick={() => handleDeleteRole(role)}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: COMPANIES DIRECTORY                 */}
        {/* ========================================== */}
        {activeTab === "companies" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((comp) => {
                const isDefault = comp.id === "comp_geotekno"
                return (
                  <div
                    key={comp.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{comp.name}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">CODE: {comp.code}</span>
                          </div>
                        </div>

                        {isDefault ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                            PRIMARY
                          </span>
                        ) : (
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                            TENANT
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-xs text-slate-600 line-clamp-2 min-h-[32px]">
                        {comp.description || "Multi-tenant maritime company organization."}
                      </p>

                      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Ship className="h-3.5 w-3.5 text-slate-400" />
                            Registered Vessels:
                          </span>
                          <span className="font-bold text-slate-900">
                            {comp.vesselCount ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Server className="h-3.5 w-3.5 text-slate-400" />
                            Connectivity Agents:
                          </span>
                          <span className="font-bold text-slate-900">
                            {comp.agentCount ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            Active Users:
                          </span>
                          <span className="font-bold text-[#db4040]">
                            {comp.userCount ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => openEditCompanyModal(comp)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit Company</span>
                      </button>

                      {!isDefault && (
                        <button
                          onClick={() => handleDeleteCompany(comp)}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: ADD / EDIT USER (Simplified: Name, Email, Password, Role) */}
        {/* ============================================================== */}
        {isUserModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 backdrop-blur-sm">
            <div className="relative flex flex-col w-full max-w-lg max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-[#db4040]">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {userModalMode === "create" ? "Add New User" : `Edit User: ${selectedUser?.name}`}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Enter user credentials and assign a role to inherit permissions
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form
                id="user-form"
                onSubmit={handleUserSubmit}
                className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
              >
                {/* 1. Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    placeholder="e.g. Capt. Alexander Wright"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                  />
                </div>

                {/* 2. Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="operator@geotekno.id"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                  />
                </div>

                {/* 3. Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {userModalMode === "create" ? "Password *" : "Password (Leave blank to keep current)"}
                  </label>
                  <input
                    type="password"
                    required={userModalMode === "create"}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder={userModalMode === "create" ? "Min. 6 characters" : "••••••••"}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                  />
                </div>

                {/* Company Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Company / Organization {isSuperadmin && <span className="text-red-500">*</span>}
                  </label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    User will be isolated to view vessels and connectivity agents of this organization.
                  </p>
                  {isSuperadmin ? (
                    <select
                      value={userFormData.company_id}
                      onChange={(e) => setUserFormData({ ...userFormData, company_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-blue-50/20 px-3.5 py-2.5 text-xs text-slate-800 font-semibold outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      <span>{companies.find((c) => c.id === userFormData.company_id)?.name || "Your Organization"}</span>
                    </div>
                  )}
                </div>

                {/* 4. Role Selection (Inherit Permissions) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Role & Permissions Profile <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Permissions are inherited directly from the chosen role.
                  </p>
                  <select
                    value={userFormData.role_id}
                    onChange={(e) => setUserFormData({ ...userFormData, role_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 font-medium outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                  >
                    {roles
                      .filter((r) => isSuperadmin || r.id !== "role_superadmin")
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.is_system ? "(System Default)" : "(Custom Role)"}
                        </option>
                      ))}
                  </select>

                  {/* Show summary of selected role */}
                  {(() => {
                    const activeRole = roles.find((r) => r.id === userFormData.role_id)
                    if (!activeRole) return null
                    return (
                      <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">{activeRole.name}: </span>
                        {activeRole.description || "Grants standard privileges configured by Superadmin."}
                      </div>
                    )
                  })()}
                </div>

                {/* 5. Assigned Vessels */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Assigned Fleet Vessels
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {userFormData.assigned_vessels.length} vessel(s) selected
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-2.5 bg-slate-50/50">
                    {(() => {
                      const compVessels = vessels.filter(
                        (v) => !v.companyId || v.companyId === userFormData.company_id || (v as any).company_id === userFormData.company_id,
                      )
                      if (compVessels.length === 0) {
                        return <p className="text-[11px] text-slate-400 italic">No vessels registered for this company.</p>
                      }
                      return compVessels.map((v) => {
                        const checked = userFormData.assigned_vessels.includes(v.id)
                        return (
                          <label
                            key={v.id}
                            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition cursor-pointer ${checked ? "bg-white border border-red-200 shadow-xs" : "hover:bg-slate-100/70"
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleVessel(v.id)}
                                className="h-3.5 w-3.5 rounded text-[#db4040] focus:ring-[#db4040]"
                              />
                              <span className="text-xs font-medium text-slate-800">{v.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{v.mmsi || v.id}</span>
                          </label>
                        )
                      })
                    })()}
                  </div>
                </div>

                {/* 6. Account Status (Edit Mode) */}
                {userModalMode === "edit" && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Account Active</p>
                      <p className="text-[11px] text-slate-400">Allow this user to sign in</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userFormData.is_active}
                        onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#db4040]"></div>
                    </label>
                  </div>
                )}
              </form>

              {/* Modal Footer */}
              <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="user-form"
                  className="rounded-xl bg-[#db4040] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition cursor-pointer"
                >
                  {userModalMode === "create" ? "Create Account" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: CREATE / EDIT ROLE & PERMISSION MATRIX                  */}
        {/* ============================================================== */}
        {isRoleModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 backdrop-blur-sm">
            <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {roleModalMode === "create" ? "Create New Role" : `Edit Role: ${selectedRole?.name}`}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Define role identity and configure granular page & feature permissions
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form
                id="role-form"
                onSubmit={handleRoleSubmit}
                className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
              >
                {/* 1. Role Info */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Role Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={roleFormData.name}
                      onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                      placeholder="e.g. Vessel Maintenance Supervisor"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Role Description
                    </label>
                    <input
                      type="text"
                      value={roleFormData.description}
                      onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                      placeholder="e.g. Authorized to inspect telemetry sensors and manage decoders"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                    />
                  </div>
                </div>

                {/* 2. Page Navigation Permissions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#db4040]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Page Access Permissions
                    </h4>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Platform Module</th>
                          <th className="px-4 py-2.5 text-center w-24">Can View (Read)</th>
                          <th className="px-4 py-2.5 text-center w-24">Can Edit (Write)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {AVAILABLE_PAGES.map((page) => {
                          const current = roleFormData.pagePermissions[page.key] || { read: false, write: false }
                          return (
                            <tr key={page.key} className="hover:bg-slate-50/60">
                              <td className="px-4 py-2.5">
                                <p className="font-semibold text-slate-800">{page.label}</p>
                                <p className="text-[10px] text-slate-400">{page.desc}</p>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={current.read}
                                  onChange={(e) =>
                                    setRoleFormData({
                                      ...roleFormData,
                                      pagePermissions: {
                                        ...roleFormData.pagePermissions,
                                        [page.key]: { ...current, read: e.target.checked },
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040]"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={current.write}
                                  onChange={(e) =>
                                    setRoleFormData({
                                      ...roleFormData,
                                      pagePermissions: {
                                        ...roleFormData.pagePermissions,
                                        [page.key]: { ...current, write: e.target.checked },
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040]"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Sensitive Feature Permissions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[#db4040]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Sensitive Feature Scopes
                    </h4>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Feature Scope</th>
                          <th className="px-4 py-2.5 text-center w-24">Can Access (Read)</th>
                          <th className="px-4 py-2.5 text-center w-24">Can Control (Write)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {AVAILABLE_FEATURES.map((feat) => {
                          const current = roleFormData.featurePermissions[feat.key] || { read: false, write: false }
                          return (
                            <tr key={feat.key} className="hover:bg-slate-50/60">
                              <td className="px-4 py-2.5">
                                <p className="font-semibold text-slate-800">{feat.label}</p>
                                <p className="text-[10px] text-slate-400">{feat.desc}</p>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={current.read}
                                  onChange={(e) =>
                                    setRoleFormData({
                                      ...roleFormData,
                                      featurePermissions: {
                                        ...roleFormData.featurePermissions,
                                        [feat.key]: { ...current, read: e.target.checked },
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040]"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={current.write}
                                  onChange={(e) =>
                                    setRoleFormData({
                                      ...roleFormData,
                                      featurePermissions: {
                                        ...roleFormData.featurePermissions,
                                        [feat.key]: { ...current, write: e.target.checked },
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040]"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Monitoring Dashboard Section Scopes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-[#db4040]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Monitoring Dashboard Section Scopes
                    </h4>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Dashboard Section</th>
                          <th className="px-4 py-2.5 text-center w-24">Can View (Read)</th>
                          <th className="px-4 py-2.5 text-center w-24">Can Modify (Write)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {monitoringSections.map((sec) => {
                          const current = roleFormData.sectionPermissions[sec.key] || { read: false, write: false }
                          return (
                            <tr key={sec.key} className="hover:bg-slate-50/60">
                              <td className="px-4 py-2.5">
                                <p className="font-semibold text-slate-800">{sec.label}</p>
                                <p className="text-[10px] text-slate-400">{sec.desc}</p>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={current.read}
                                  onChange={(e) =>
                                    setRoleFormData({
                                      ...roleFormData,
                                      sectionPermissions: {
                                        ...roleFormData.sectionPermissions,
                                        [sec.key]: { ...current, read: e.target.checked },
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040]"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={current.write}
                                  onChange={(e) =>
                                    setRoleFormData({
                                      ...roleFormData,
                                      sectionPermissions: {
                                        ...roleFormData.sectionPermissions,
                                        [sec.key]: { ...current, write: e.target.checked },
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded text-[#db4040] focus:ring-[#db4040]"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </form>

              {/* Footer */}
              <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="role-form"
                  className="rounded-xl bg-[#db4040] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition cursor-pointer"
                >
                  {roleModalMode === "create" ? "Create Role" : "Save Role Permissions"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MODAL: ADD / EDIT COMPANY                  */}
        {/* ========================================== */}
        {isCompanyModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 backdrop-blur-sm">
            <div className="relative flex flex-col w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {companyModalMode === "create" ? "Register New Company" : `Edit Company: ${selectedCompany?.name}`}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Configure multi-tenant maritime organization
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCompanySubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyFormData.name}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                    placeholder="e.g. PT Pelayaran Nasional Indonesia"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Company Code / Acronym <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyFormData.code}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. PELNI or PERTAMINA"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 uppercase font-mono outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Short uppercase code used for asset tags & agent identifiers.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={companyFormData.description}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, description: e.target.value })}
                    placeholder="Fleet operations description..."
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCompanyModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#db4040] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition cursor-pointer"
                  >
                    {companyModalMode === "create" ? "Create Company" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Custom Confirmation / Alert Dialog */}
        <ConfirmModal
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          variant={confirmDialog.variant}
          isAlert={confirmDialog.isAlert}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        />
      </div>
    </div>
  )
}
