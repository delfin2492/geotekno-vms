import type { Company } from "@/domain/types"

export interface PermissionItem {
  read: boolean
  write: boolean
}

export interface UserPermissions {
  pages?: Record<string, PermissionItem>
  features?: Record<string, PermissionItem>
  sections?: Record<string, PermissionItem>
}

export interface Role {
  id: string
  name: string
  description?: string
  is_system?: boolean
  company_id?: string
  companyId?: string
  permissions: {
    pages: Record<string, PermissionItem>
    features: Record<string, PermissionItem>
    sections?: Record<string, PermissionItem>
    raw?: Array<{ resource_type: string; resource_key: string; can_read: boolean; can_write: boolean }>
  }
  userCount?: number
  created_at?: string
  updated_at?: string
}

export interface User {
  id: string
  name: string
  username?: string
  email: string
  company_id?: string
  company_name?: string
  company_code?: string
  companyId?: string
  companyName?: string
  role_id?: string
  role_name?: string
  role_description?: string
  isSuperadmin: boolean
  isCompanyAdmin?: boolean
  is_company_admin?: boolean
  isActive?: boolean
  vessels: string[]
  permissions: UserPermissions
  created_at?: string
  updated_at?: string
}

export interface AuthResponse {
  success: boolean
  accessToken: string
  refreshToken?: string
  user: User
}

const TOKEN_KEY = "box_nav_access_token"
const USER_KEY = "box_nav_user"

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function setStoredUser(user: User | null) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(USER_KEY)
  }
}

const BASE_URL = "/api/v1/auth"

async function authRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
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
    let errMessage = `HTTP Error ${response.status}`
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

export const authApi = {
  async login(credentials: { email: string; password: string }): Promise<AuthResponse> {
    const res = await authRequest<AuthResponse>("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    })
    setStoredToken(res.accessToken)
    setStoredUser(res.user)
    return res
  },

  async register(data: { name: string; email: string; password: string }): Promise<{ success: boolean; message: string }> {
    return authRequest<{ success: boolean; message: string }>("/register", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async getMe(): Promise<User> {
    const user = await authRequest<User>("/me")
    setStoredUser(user)
    return user
  },

  async logout(): Promise<void> {
    try {
      await authRequest<{ success: boolean }>("/logout", { method: "POST" })
    } catch {
      // Ignore network errors on logout
    } finally {
      setStoredToken(null)
      setStoredUser(null)
    }
  },

  // --- Superadmin User Management ---
  async listUsers(): Promise<{ users: User[] }> {
    return authRequest<{ users: User[] }>("/users")
  },

  async createUser(data: any): Promise<{ success: boolean; user: User }> {
    return authRequest<{ success: boolean; user: User }>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateUser(id: string, data: any): Promise<{ success: boolean; user: User }> {
    return authRequest<{ success: boolean; user: User }>(`/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  async deleteUser(id: string): Promise<{ success: boolean }> {
    return authRequest<{ success: boolean }>(`/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
  },

  // --- Superadmin Role Management ---
  async listRoles(): Promise<{ roles: Role[] }> {
    return authRequest<{ roles: Role[] }>("/roles")
  },

  async createRole(data: {
    name: string
    description?: string
    company_id?: string
    permissions: Array<{ resource_type: string; resource_key: string; can_read: boolean; can_write: boolean }>
  }): Promise<{ success: boolean; role: Role }> {
    return authRequest<{ success: boolean; role: Role }>("/roles", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateRole(
    id: string,
    data: {
      name?: string
      description?: string
      company_id?: string
      permissions?: Array<{ resource_type: string; resource_key: string; can_read: boolean; can_write: boolean }>
    }
  ): Promise<{ success: boolean; role: Role }> {
    return authRequest<{ success: boolean; role: Role }>(`/roles/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  async deleteRole(id: string): Promise<{ success: boolean; message?: string }> {
    return authRequest<{ success: boolean; message?: string }>(`/roles/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
  },

  // --- Multi-Company Tenancy Management ---
  async listCompanies(): Promise<Company[]> {
    const res = await fetch("/api/v1/companies", {
      headers: {
        Authorization: `Bearer ${getStoredToken() || ""}`,
      },
    })
    return res.json()
  },

  async createCompany(data: {
    name: string
    code?: string
    description?: string
    admin_name?: string
    admin_email?: string
    admin_password?: string
  }): Promise<{ success: boolean; company: Company; adminUser?: User }> {
    const res = await fetch("/api/v1/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getStoredToken() || ""}`,
      },
      body: JSON.stringify(data),
    })
    return res.json()
  },

  async updateCompany(id: string, data: { name?: string; code?: string; description?: string }): Promise<{ success: boolean; company: Company }> {
    const res = await fetch(`/api/v1/companies/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getStoredToken() || ""}`,
      },
      body: JSON.stringify(data),
    })
    return res.json()
  },

  async deleteCompany(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/v1/companies/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getStoredToken() || ""}`,
      },
    })
    return res.json()
  },
}
