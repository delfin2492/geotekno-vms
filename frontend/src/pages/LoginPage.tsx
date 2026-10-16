import React, { useState } from "react"
import { useNavigate, useLocation, Navigate } from "react-router"
import { useAuth } from "@/state/AuthProvider"
import { Lock, User as UserIcon, ArrowRight, AlertCircle, Eye, EyeOff, Compass } from "lucide-react"

export function LoginPage() {
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as any)?.from?.pathname || "/"

  // Jika pengguna sudah login, langsung alihkan ke halaman tujuan / utama
  if (!authLoading && isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login({ email: identifier, password })
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your email address and password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100 selection:bg-[#db4040]/30 selection:text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#db4040]/10 blur-[120px]" />

      {/* Main Centered Login Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        {/* Brand Logo & Platform Title */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-block transition hover:opacity-90">
            <img
              src="/logo.png"
              alt="GEOTEKNO"
              className="h-9 w-auto max-w-[180px] object-contain"
            />
          </div>
          <h1 className="mt-3 text-lg font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
            GeoTekno <span className="text-[#db4040]">VMS</span>
          </h1>
          <p className="mt-1 text-[11px] font-medium text-slate-400">
            Vessel Monitoring & Fleet Telemetry System
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/50 p-3 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Email Address
            </label>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <UserIcon className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@geotekno.id"
                autoFocus
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 shadow-sm transition focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Password
            </label>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 pr-10 pl-10 text-xs text-white placeholder-slate-500 shadow-sm transition focus:border-[#db4040] focus:ring-1 focus:ring-[#db4040] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#db4040] py-3 text-xs font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-600 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Compass className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center text-[11px] text-slate-500">
          Forgot your password? Ask an administrator to reset it.
        </div>
      </div>
    </div>
  )
}
