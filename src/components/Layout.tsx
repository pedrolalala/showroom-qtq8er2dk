import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <main className="w-screen h-screen min-h-screen bg-white text-[#0A0A0A] flex items-center justify-center overflow-hidden select-none">
      <Outlet />
    </main>
  )
}
