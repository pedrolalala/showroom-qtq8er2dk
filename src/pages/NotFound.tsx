/* 404 - rota inexistente */
import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404: rota inexistente:', location.pathname)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">
        Showroom Lucenera
      </p>
      <h1 className="mt-2 text-4xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-muted-foreground">O endereço acessado não existe ou saiu do ar.</p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Voltar à vitrine
      </Link>
    </div>
  )
}

export default NotFound
