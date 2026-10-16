import { ArrowLeft, Navigation } from "lucide-react"
import { Link } from "react-router"

export function NotFoundPage() {
  return (
    <main className="grid min-h-[calc(100vh-68px)] place-items-center p-6 text-center">
      <div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-900 text-teal-300">
          <Navigation className="h-8 w-8" />
        </span>
        <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-600">
          404 • Off course
        </div>
        <h1 className="mt-2 text-2xl font-bold">
          This route is not on the chart
        </h1>
        <p className="mt-2 text-xs text-slate-400">
          Return to the operations overview to continue monitoring your fleet.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
      </div>
    </main>
  )
}
