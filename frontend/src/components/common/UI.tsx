import { X } from "lucide-react"
import type { ReactNode } from "react"

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-600">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const style =
    (normalized.includes("connect") && !normalized.includes("dis")) ||
    normalized === "live" ||
    normalized === "underway"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
      : normalized.includes("warn") ||
          normalized === "delayed" ||
          normalized === "stale" ||
          normalized === "anchored" ||
          normalized === "testing"
        ? "bg-amber-50 text-amber-700 ring-amber-600/10"
        : normalized.includes("critical") ||
            normalized.includes("dis") ||
            normalized === "offline"
          ? "bg-red-50 text-red-700 ring-red-600/10"
          : "bg-slate-100 text-slate-600 ring-slate-500/10"
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold capitalize ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[2000] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <div
        className={`my-auto w-full ${
          wide ? "max-w-3xl" : "max-w-lg"
        } rounded-2xl border border-slate-200 bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {description && (
              <p className="mt-1 text-[11px] text-slate-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#db4040] focus:ring-2 focus:ring-[#db4040]/15"
export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#db4040] hover:bg-[#b92b2b] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-500/25 transition disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
export const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isAlert = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning" | "info"
  isAlert?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-red-50 text-[#db4040] ring-1 ring-red-100"
                : variant === "warning"
                ? "bg-amber-50 text-amber-600 ring-1 ring-amber-100"
                : "bg-blue-50 text-blue-600 ring-1 ring-blue-100"
            }`}
          >
            <span className="text-xl font-bold">!</span>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <div className="mt-1.5 text-xs leading-relaxed text-slate-500">{message}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          {!isAlert && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer ${
              variant === "danger"
                ? "bg-[#db4040] hover:bg-red-700 shadow-red-500/20"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
