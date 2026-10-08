/**
 * ComposicaoConjuntoModal (SPEC-148, Fluxo B — peça composta): modal compartilhado entre as 2
 * abas de `/admin` ("Vincular do PPT" e "Fotos do estoque") para montar/editar o conjunto de
 * produtos representado por uma única foto. Ver SPEC-148 §4.4/§11.
 *
 * Recebe só `codigoProdutoPrincipal` (+ um nome pra exibir enquanto carrega) — busca sozinho a
 * composição atual (`obterComposicao`) e os dados do próprio principal (`buscarProduto`, já
 * que nenhuma das duas telas chamadoras tem `valor_venda` do produto à mão em todos os casos).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatarPreco } from '@/lib/format'
import {
  buscarProduto,
  definirComposicao,
  obterComposicao,
  type Credencial,
  type MembroComposicao,
  type ProdutoBusca,
} from '@/services/curadoria'

type MembroEmEdicao = MembroComposicao

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cred: Credencial
  codigoProdutoPrincipal: number
  nomePrincipal: string
  /** Chamado depois de salvar/limpar com sucesso, pra quem abriu recarregar sua lista. */
  onSalvo?: () => void
  onAuthError?: () => void
}

export function ComposicaoConjuntoModal({
  open,
  onOpenChange,
  cred,
  codigoProdutoPrincipal,
  nomePrincipal,
  onSalvo,
  onAuthError,
}: Props) {
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [membros, setMembros] = useState<MembroEmEdicao[]>([])
  const [principal, setPrincipal] = useState<{
    valor_venda: number
    estoque_showroom: number
  } | null>(null)
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ProdutoBusca[]>([])
  const [buscando, setBuscando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [candidatosPrincipal, atuais] = await Promise.all([
        buscarProduto(String(codigoProdutoPrincipal), true),
        obterComposicao(codigoProdutoPrincipal),
      ])
      const infoPrincipal = candidatosPrincipal.find(
        (p) => p.codigo_produto === codigoProdutoPrincipal,
      )
      setPrincipal({
        valor_venda: infoPrincipal?.valor_venda ?? 0,
        estoque_showroom: infoPrincipal?.estoque_showroom ?? 0,
      })
      setMembros(atuais)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar composição')
    } finally {
      setCarregando(false)
    }
  }, [codigoProdutoPrincipal])

  useEffect(() => {
    if (open) {
      setTermo('')
      setResultados([])
      void carregar()
    }
  }, [open, carregar])

  useEffect(() => {
    const t = termo.trim()
    if (t.length < 2) {
      setResultados([])
      return
    }
    const id = setTimeout(() => {
      setBuscando(true)
      buscarProduto(t, true)
        .then(setResultados)
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(id)
  }, [termo])

  const jaNaLista = useCallback(
    (codigo: number) => membros.some((m) => m.codigo_produto === codigo),
    [membros],
  )

  function adicionarMembro(p: ProdutoBusca) {
    if (p.codigo_produto === codigoProdutoPrincipal || jaNaLista(p.codigo_produto)) return
    setMembros((atual) => [
      ...atual,
      {
        codigo_produto: p.codigo_produto,
        nome: p.nome,
        codigo_legado: null,
        estoque_showroom: p.estoque_showroom,
        valor_venda: p.valor_venda,
        quantidade: 1,
      },
    ])
    setTermo('')
    setResultados([])
  }

  function removerMembro(codigo: number) {
    setMembros((atual) => atual.filter((m) => m.codigo_produto !== codigo))
  }

  function alterarQuantidade(codigo: number, delta: number) {
    setMembros((atual) =>
      atual.map((m) =>
        m.codigo_produto === codigo ? { ...m, quantidade: Math.max(1, m.quantidade + delta) } : m,
      ),
    )
  }

  const preview = useMemo(() => {
    const valorMembros = membros.reduce((acc, m) => acc + m.valor_venda * m.quantidade, 0)
    const valorTotal = (principal?.valor_venda ?? 0) + valorMembros
    const conjuntosMembros =
      membros.length === 0
        ? null
        : Math.min(...membros.map((m) => Math.floor(m.estoque_showroom / m.quantidade)))
    const estoqueConjuntos =
      conjuntosMembros === null
        ? (principal?.estoque_showroom ?? 0)
        : Math.min(principal?.estoque_showroom ?? 0, conjuntosMembros)
    return { valorTotal, estoqueConjuntos }
  }, [membros, principal])

  async function salvar() {
    setSalvando(true)
    try {
      await definirComposicao(
        cred,
        codigoProdutoPrincipal,
        membros.map((m) => ({ codigo_produto: m.codigo_produto, quantidade: m.quantidade })),
      )
      toast.success(
        membros.length > 0
          ? `Composição salva (${membros.length} produto${membros.length > 1 ? 's' : ''})`
          : 'Conjunto limpo — produto voltou a ser peça avulsa',
      )
      onSalvo?.()
      onOpenChange(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar composição'
      toast.error(msg)
      if (/senha|usu[aá]rio/i.test(msg)) onAuthError?.()
    } finally {
      setSalvando(false)
    }
  }

  async function limpar() {
    setSalvando(true)
    try {
      await definirComposicao(cred, codigoProdutoPrincipal, [])
      toast.success('Conjunto limpo — produto voltou a ser peça avulsa')
      onSalvo?.()
      onOpenChange(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao limpar composição'
      toast.error(msg)
      if (/senha|usu[aá]rio/i.test(msg)) onAuthError?.()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Composição de "{nomePrincipal}"</DialogTitle>
          <DialogDescription>
            Um conjunto exibe 1 foto/nome (deste produto principal) representando vários produtos de
            estoque vendidos juntos. O valor exibido é a soma de todos; o estoque é o número de
            conjuntos completos possíveis.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Membros do conjunto ({membros.length})
              </h3>
              {membros.length === 0 && (
                <p className="rounded border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                  Nenhum membro ainda — este produto é uma peça avulsa.
                </p>
              )}
              <ul className="space-y-1.5">
                {membros.map((m) => (
                  <li
                    key={m.codigo_produto}
                    className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {m.codigo_produto}
                      </span>{' '}
                      <span className="font-medium">{m.nome}</span>
                      <div className="text-xs text-muted-foreground">
                        {formatarPreco(m.valor_venda)} · estoque {m.estoque_showroom}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => alterarQuantidade(m.codigo_produto, -1)}
                        disabled={m.quantidade <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-xs">{m.quantidade}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => alterarQuantidade(m.codigo_produto, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removerMembro(m.codigo_produto)}
                      title="Remover do conjunto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adicionar produto ao conjunto
              </h3>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Buscar produto por código, nome, código legado…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
              {buscando && <p className="mt-1 text-xs text-muted-foreground">Buscando…</p>}
              {resultados.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-auto rounded border border-border">
                  {resultados.map((p) => {
                    const ehOProprioPrincipal = p.codigo_produto === codigoProdutoPrincipal
                    const jaNoConjuntoAtual = jaNaLista(p.codigo_produto)
                    const ehPrincipalDeOutroGrupo = p.eh_principal_de_grupo && !ehOProprioPrincipal
                    const ehMembroDeOutroGrupo =
                      p.membro_de_codigo_produto != null &&
                      p.membro_de_codigo_produto !== codigoProdutoPrincipal
                    const desabilitado =
                      ehOProprioPrincipal ||
                      jaNoConjuntoAtual ||
                      ehPrincipalDeOutroGrupo ||
                      ehMembroDeOutroGrupo
                    let motivo: string | null = null
                    if (ehOProprioPrincipal) motivo = 'é este produto principal'
                    else if (jaNoConjuntoAtual) motivo = 'já está na lista acima'
                    else if (ehPrincipalDeOutroGrupo) motivo = 'já é peça própria (tem conjunto)'
                    else if (ehMembroDeOutroGrupo)
                      motivo = `já está em outro conjunto (#${p.membro_de_codigo_produto})`

                    return (
                      <li key={p.codigo_produto}>
                        <button
                          type="button"
                          disabled={desabilitado}
                          onClick={() => adicionarMembro(p)}
                          className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                          title={motivo ?? undefined}
                        >
                          <span className="truncate">
                            <span className="font-mono text-xs text-muted-foreground">
                              {p.codigo_produto}
                            </span>{' '}
                            {p.nome}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {motivo ?? `${p.marca ?? ''} · sh ${p.estoque_showroom}`}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="rounded bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              <p>
                Valor exibido: <strong>{formatarPreco(preview.valorTotal)}</strong> (
                {membros.length + 1} produto{membros.length + 1 > 1 ? 's' : ''})
              </p>
              <p>
                Estoque de conjuntos completos: <strong>{preview.estoqueConjuntos}</strong>
              </p>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={limpar}
            disabled={salvando || carregando || membros.length === 0}
          >
            Limpar conjunto
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando || carregando}>
            {salvando ? 'Salvando…' : 'Salvar composição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
