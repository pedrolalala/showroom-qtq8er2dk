import { Link, NavLink, Outlet } from 'react-router-dom'
import { CONTATO } from '@/lib/contato'

function Marca() {
  return (
    <Link to="/" className="flex items-baseline gap-2 select-none">
      <span className="text-xl font-extrabold tracking-tight text-foreground">LUCENERA</span>
      <span className="text-sm font-medium uppercase tracking-widest text-primary">Showroom</span>
    </Link>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Marca />
          <nav className="flex items-center gap-4 text-sm font-medium">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }
            >
              Vitrine
            </NavLink>
            <NavLink
              to="/showroom"
              className={({ isActive }) =>
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }
            >
              Visite
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-secondary">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span className="font-semibold text-foreground">Showroom Lucenera</span>
          <span>{CONTATO.endereco}</span>
          <span>
            {CONTATO.horario} · {CONTATO.telefoneExibicao} · {CONTATO.email}
          </span>
          <span className="mt-2 text-xs">
            Disponibilidade e preços sujeitos a alteração. Peças de pronta entrega no showroom.
          </span>
          <Link
            to="/admin"
            className="mt-1 text-xs text-muted-foreground/60 hover:text-foreground hover:underline"
          >
            Curadoria (equipe)
          </Link>
        </div>
      </footer>
    </div>
  )
}
