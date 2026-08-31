import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ImageOff, Link2, Search, Undo2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  buscarProduto,
  desvincular,
  listarImportPecas,
  login,
  vincular,
  type Credencial,
  type ImportPeca,
  type ProdutoBusca,
} from '@/services/curadoria'

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

function Thumb({ url, alt }: { url: string; alt: string }) {
  const [erro, setErro] = useState(false)
  if (erro || !url) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
        <ImageOff className="h-6 w-6 opacity-50" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      onError={() => setErro(true)}
      className="h-24 w-24 shrink-0 rounded border border-border object-contain"
    />
  )
}

function BuscaProduto({ onEscolher }: { onEscolher: (cod: number, nome: string) => void }) {
  const [termo, setTermo] = useState('')
  const [res, setRes] = useState<ProdutoBusca[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const t = termo.trim()
    if (t.length < 2) {
      setRes([])
      return
    }
    const id = setTimeout(() => {
      setBuscando(true)
      buscarProduto(t)
        .then(setRes)
        .catch(() => setRes([]))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(id)
  }, [termo])

  return (
    <div className="mt-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar produto por código, nome, SKU…"
          className="h-8 pl-8 text-sm"
        />
      </div>
      {buscando && <p className="mt-1 text-xs text-muted-foreground">Buscando…</p>}
      {res.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-auto rounded border border-border">
          {res.map((p) => (
            <li key={p.codigo_produto}>
              <button
                type="button"
                onClick={() => onEscolher(p.codigo_produto, p.nome)}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <span className="truncate">
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.codigo_produto}
                  </span>{' '}
                  {p.nome}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.marca ?? ''} · sh {p.estoque_showroom}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
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
        Entre para vincular as peças do PowerPoint aos produtos.
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
  const [pecas, setPecas] = useState<ImportPeca[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)

  const aoEntrar = useCallback((c: Credencial) => {
    gravarCred(c)
    setCred(c)
  }, [])

  const sair = useCallback(() => {
    gravarCred(null)
    setCred(null)
    setPecas(null)
  }, [])

  const carregar = useCallback(() => {
    listarImportPecas()
      .then(setPecas)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar'))
  }, [])

  useEffect(() => {
    if (cred) carregar()
  }, [cred, carregar])

  const { aVincular, vinculadas } = useMemo(() => {
    const lista = pecas ?? []
    return {
      aVincular: lista.filter((p) => !p.codigo_produto_vinculado),
      vinculadas: lista.filter((p) => p.codigo_produto_vinculado),
    }
  }, [pecas])

  async function acaoVincular(slide: number, codigo: number, nome: string) {
    if (!cred) return
    setOcupado(slide)
    try {
      await vincular(cred, slide, codigo)
      toast.success(`Peça ${slide} → ${nome}`)
      setPecas((atual) =>
        (atual ?? []).map((p) =>
          p.slide === slide
            ? { ...p, codigo_produto_vinculado: codigo, vinculado_em: new Date().toISOString() }
            : p,
        ),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro'
      toast.error(msg)
      if (/senha|usu[aá]rio/i.test(msg)) sair()
    } finally {
      setOcupado(null)
    }
  }

  async function acaoDesvincular(slide: number) {
    if (!cred) return
    setOcupado(slide)
    try {
      await desvincular(cred, slide)
      toast.success(`Peça ${slide} desvinculada`)
      setPecas((atual) =>
        (atual ?? []).map((p) =>
          p.slide === slide ? { ...p, codigo_produto_vinculado: null, vinculado_em: null } : p,
        ),
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setOcupado(null)
    }
  }

  if (!cred) {
    return <LoginForm onOk={aoEntrar} />
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Curadoria do showroom</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pecas ? `${vinculadas.length} de ${pecas.length} peças vinculadas` : 'Carregando…'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={sair}>
          Sair
        </Button>
      </div>

      {erro && <p className="mb-4 text-sm text-destructive">{erro}</p>}

      {!pecas && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {pecas && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            A vincular ({aVincular.length})
          </h2>
          <ul className="space-y-3">
            {aVincular.map((p) => (
              <li
                key={p.slide}
                className="flex gap-4 rounded-lg border border-border p-3 sm:items-start"
              >
                <Thumb url={p.imagem_url} alt={p.nome_ppt} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.nome_ppt}</span>
                    {p.marca_ppt && <Badge variant="secondary">{p.marca_ppt}</Badge>}
                    {p.qtd_ppt != null && (
                      <span className="text-xs text-muted-foreground">qtd {p.qtd_ppt}</span>
                    )}
                    <span className="text-xs text-muted-foreground">slide {p.slide}</span>
                  </div>
                  {p.observacoes && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.observacoes}</p>
                  )}

                  {p.candidatos?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.candidatos.map((c) => (
                        <Button
                          key={c.codigo}
                          size="sm"
                          variant="outline"
                          disabled={ocupado === p.slide}
                          onClick={() => acaoVincular(p.slide, c.codigo, c.nome)}
                          className="h-auto py-1 text-left"
                          title={c.nome}
                        >
                          <Link2 className="mr-1 h-3 w-3 shrink-0" />
                          <span className="truncate">
                            <span className="font-mono text-[10px] opacity-70">{c.codigo}</span>{' '}
                            {c.nome.length > 40 ? c.nome.slice(0, 40) + '…' : c.nome}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}

                  <BuscaProduto onEscolher={(cod, nome) => acaoVincular(p.slide, cod, nome)} />
                </div>
              </li>
            ))}
            {aVincular.length === 0 && (
              <li className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Tudo vinculado 🎉
              </li>
            )}
          </ul>

          {vinculadas.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Vinculadas ({vinculadas.length})
              </h2>
              <ul className="space-y-2">
                {vinculadas.map((p) => (
                  <li
                    key={p.slide}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <Thumb url={p.imagem_url} alt={p.nome_ppt} />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{p.nome_ppt}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        → {p.codigo_produto_vinculado}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={ocupado === p.slide}
                      onClick={() => acaoDesvincular(p.slide)}
                    >
                      <Undo2 className="mr-1 h-3 w-3" />
                      Desfazer
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
