import { RouterProvider } from "react-router"
import { router } from "@/app/routes"
import { AuthProvider } from "@/state/AuthProvider"

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
