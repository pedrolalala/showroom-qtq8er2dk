import { useCallback, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PPTTab } from '@/components/showroom-admin/PPTTab'
import { FotosEstoqueTab } from '@/components/showroom-admin/FotosEstoqueTab'
import { EmprestimosTab } from '@/components/showroom-admin/EmprestimosTab'
import { login, type Credencial } from '@/services/curadoria'

const CRED_KEY = 'showroom_admin_cred'

function lerCred(): Credencial | null {
  try {
    const raw = sessionStorage.getItem(CRED_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Credencial
    return c.user && c.senha ? c : null
  } catch {
    return null
  }
}

function gravarCred(c: Credencial | null) {
  try {
    if (c) sessionStorage.setItem(CRED_KEY, JSON.stringify(c))
    else sessionStorage.removeItem(CRED_KEY)
  } catch {
    /* ignore */
  }
}

function LoginForm({ onOk }: { onOk: (c: Credencial) => void }) {
  const [user, setUser] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user.trim() || !senha) return
    setEntrando(true)
    setErro(null)
    const c = { user: user.trim(), senha }
    try {
      await login(c)
      onOk(c)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-lg font-semibold">Curadoria do showroom</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Entre para cuidar das peças e fotos do showroom e dos empréstimos.
      </p>
      <form className="mt-4 space-y-2" onSubmit={submit}>
        <Input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="Usuário"
          autoFocus
          autoComplete="username"
        />
        <Input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          autoComplete="current-password"
        />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="w-full" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}

export default function Admin() {
  const [cred, setCred] = useState<Credencial | null>(() => lerCred())

  const aoEntrar = useCallback((c: Credencial) => {
    gravarCred(c)
    setCred(c)
  }, [])

  const sair = useCallback(() => {
    gravarCred(null)
    setCred(null)
  }, [])

  if (!cred) {
    return <LoginForm onOk={aoEntrar} />
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Curadoria do showroom</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vincule peças do PowerPoint, suba fotos dos produtos em estoque ou registre peças emprestadas.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={sair}>
          Sair
        </Button>
      </div>

      {/* SPEC-165: abre em "Peças e fotos" — é a única aba com todas as peças da vitrine. */}
      <Tabs defaultValue="estoque">
        <TabsList>
          <TabsTrigger value="estoque">Peças e fotos</TabsTrigger>
          <TabsTrigger value="ppt">Vincular do PPT</TabsTrigger>
          <TabsTrigger value="emprestimos">Empréstimos</TabsTrigger>
        </TabsList>
        <TabsContent value="estoque">
          <FotosEstoqueTab cred={cred} onAuthError={sair} />
        </TabsContent>
        <TabsContent value="ppt">
          <PPTTab cred={cred} onAuthError={sair} />
        </TabsContent>
        {/* SPEC-219: peças emprestadas a clientes + termo para assinar */}
        <TabsContent value="emprestimos">
          <EmprestimosTab cred={cred} onAuthError={sair} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
