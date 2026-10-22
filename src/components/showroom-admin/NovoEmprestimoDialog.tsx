/**
 * Novo empréstimo (SPEC-219): empresa, cliente do cadastro, peças + quantidade e prazo.
 * Avisa (sem bloquear) quando a quantidade emprestada em aberto passa do estoque do showroom.
 * SPEC-216: Enter só pula de campo; salvar só no clique.
 */
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Minus, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatarPreco } from '@/lib/format'
import { buscarProduto, type Credencial, type ProdutoBusca } from '@/services/curadoria'
import {
  buscarCliente,
  criarEmprestimo,
  emAbertoPorPeca,
  listarEmpresas,
  numeroEmprestimo,
  type ClienteBusca,
  type EmAbertoPorPeca,
  type EmpresaOpcao,
} from '@/services/emprestimos'

interface PecaEscolhida {
  codigo_produto: number
  nome: string
  valor_venda: number
  quantidade: number
}

function hojeMais(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cred: Credencial
  onAuthError: () => void
  onCriado: (id: string) => void
}

export function NovoEmprestimoDialog({ open, onOpenChange, cred, onAuthError, onCriado }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [cliente, setCliente] = useState<ClienteBusca | null>(null)
  const [termoCliente, setTermoCliente] = useState('')
  const [clientes, setClientes] = useState<ClienteBusca[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [pecas, setPecas] = useState<PecaEscolhida[]>([])
  const [termoPeca, setTermoPeca] = useState('')
  const [resultadosPeca, setResultadosPeca] = useState<ProdutoBusca[]>([])
  const [buscandoPeca, setBuscandoPeca] = useState(false)
  const [emAberto, setEmAberto] = useState<Map<number, EmAbertoPorPeca>>(new Map())
  const [dataPrevista, setDataPrevista] = useState(hojeMais(7))
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)

  const tratarErro = (e: unknown, padrao: string) => {
    const msg = e instanceof Error ? e.message : padrao
    toast.error(msg)
    if (/senha|usu[aá]rio/i.test(msg)) onAuthError()
  }

  useEffect(() => {
    if (!open) return
    setCliente(null)
    setTermoCliente('')
    setClientes([])
    setPecas([])
    setTermoPeca('')
    setResultadosPeca([])
    setDataPrevista(hojeMais(7))
    setObservacoes('')
    listarEmpresas(cred)
      .then((lista) => {
        setEmpresas(lista)
        setEmpresaId((atual) => (lista.some((e) => e.id === atual) ? atual : (lista[0]?.id ?? '')))
      })
      .catch((e) => tratarErro(e, 'Falha ao carregar empresas'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cred])

  useEffect(() => {
    const t = termoCliente.trim()
    if (cliente || t.length < 2) {
      setClientes([])
      return
    }
    const id = setTimeout(() => {
      setBuscandoCliente(true)
      buscarCliente(cred, t)
        .then(setClientes)
        .catch(() => setClientes([]))
        .finally(() => setBuscandoCliente(false))
    }, 300)
    return () => clearTimeout(id)
  }, [termoCliente, cliente, cred])

  useEffect(() => {
    const t = termoPeca.trim()
    if (t.length < 2) {
      setResultadosPeca([])
      return
    }
    const id = setTimeout(() => {
      setBuscandoPeca(true)
      // inclui peças ocultas da vitrine: qualquer peça do showroom pode ser emprestada
      buscarProduto(t, true)
        .then(setResultadosPeca)
        .catch(() => setResultadosPeca([]))
        .finally(() => setBuscandoPeca(false))
    }, 300)
    return () => clearTimeout(id)
  }, [termoPeca])

  const codigos = useMemo(() => pecas.map((p) => p.codigo_produto).sort((a, b) => a - b).join(','), [pecas])
  useEffect(() => {
    if (!open || !codigos) {
      setEmAberto(new Map())
      return
    }
    emAbertoPorPeca(cred, codigos.split(',').map(Number))
      .then((r) => setEmAberto(new Map(r.map((x) => [x.codigo_produto, x]))))
      .catch(() => setEmAberto(new Map()))
  }, [open, codigos, cred])

  function adicionarPeca(p: ProdutoBusca) {
    setPecas((atual) =>
      atual.some((x) => x.codigo_produto === p.codigo_produto)
        ? atual.map((x) => (x.codigo_produto === p.codigo_produto ? { ...x, quantidade: x.quantidade + 1 } : x))
        : [...atual, { codigo_produto: p.codigo_produto, nome: p.nome, valor_venda: Number(p.valor_venda) || 0, quantidade: 1 }],
    )
    setTermoPeca('')
    setResultadosPeca([])
  }

  function alterarQuantidade(codigo: number, delta: number) {
    setPecas((atual) =>
      atual.map((p) => (p.codigo_produto === codigo ? { ...p, quantidade: Math.max(1, p.quantidade + delta) } : p)),
    )
  }

  const total = pecas.reduce((acc, p) => acc + p.valor_venda * p.quantidade, 0)
  const hoje = hojeMais(0)
  const podeSalvar = !!empresaId && !!cliente && pecas.length > 0 && !!dataPrevista && dataPrevista >= hoje

  async function salvar() {
    if (!cliente || !podeSalvar) return
    setSalvando(true)
    try {
      const r = await criarEmprestimo(cred, {
        empresaId,
        contatoId: cliente.id,
        dataPrevista,
        observacoes,
        itens: pecas.map((p) => ({ codigo_produto: p.codigo_produto, quantidade: p.quantidade })),
      })
      toast.success(`Empréstimo ${numeroEmprestimo(r.numero)} registrado — baixe o termo para o cliente assinar`)
      onOpenChange(false)
      onCriado(r.id)
    } catch (e) {
      tratarErro(e, 'Erro ao registrar empréstimo')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo empréstimo de peças</DialogTitle>
          <DialogDescription>
            O cliente leva as peças e assina o termo: devolver no mesmo estado ou pagar o valor integral da
            peça danificada. O estoque do showroom não muda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="emp-empresa">Empresa</Label>
              <select
                id="emp-empresa"
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="emp-prazo">Devolver até</Label>
              <Input
                id="emp-prazo"
                type="date"
                min={hoje}
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="emp-cliente">Cliente</Label>
            {cliente ? (
              <div className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{cliente.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {[cliente.cpf_cnpj, cliente.telefone, cliente.cidade && `${cliente.cidade}/${cliente.estado ?? ''}`]
                      .filter(Boolean)
                      .join(' · ') || 'Sem documento/telefone no cadastro'}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCliente(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="emp-cliente"
                    value={termoCliente}
                    onChange={(e) => setTermoCliente(e.target.value)}
                    placeholder="Buscar cliente por nome, CPF ou CNPJ…"
                    className="h-9 pl-8 text-sm"
                    autoComplete="off"
                  />
                </div>
                {buscandoCliente && <p className="text-xs text-muted-foreground">Buscando…</p>}
                {!buscandoCliente && termoCliente.trim().length >= 2 && clientes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum cliente encontrado. O cliente precisa estar no cadastro de clientes.
                  </p>
                )}
                {clientes.length > 0 && (
                  <ul className="max-h-44 overflow-auto rounded border border-border">
                    {clientes.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setCliente(c)}
                          className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-secondary"
                        >
                          <span className="truncate">{c.nome}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {c.cpf_cnpj ?? c.cidade ?? ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="emp-peca">Peças</Label>
            {pecas.length > 0 && (
              <ul className="space-y-1.5">
                {pecas.map((p) => {
                  const info = emAberto.get(p.codigo_produto)
                  const passa = info && info.quantidade_em_aberto + p.quantidade > info.estoque_showroom
                  return (
                    <li key={p.codigo_produto} className="rounded border border-border px-2 py-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-xs text-muted-foreground">{p.codigo_produto}</span>{' '}
                          <span className="font-medium">{p.nome}</span>
                          <div className="text-xs text-muted-foreground">
                            {formatarPreco(p.valor_venda)} × {p.quantidade} ={' '}
                            <strong>{formatarPreco(p.valor_venda * p.quantidade)}</strong>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => alterarQuantidade(p.codigo_produto, -1)}
                            disabled={p.quantidade <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-xs">{p.quantidade}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => alterarQuantidade(p.codigo_produto, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => setPecas((a) => a.filter((x) => x.codigo_produto !== p.codigo_produto))}
                          title="Tirar do empréstimo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {passa && info && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Showroom tem {info.estoque_showroom}; já há {info.quantidade_em_aberto} emprestada
                          {info.quantidade_em_aberto === 1 ? '' : 's'} em aberto. Confira se a peça existe.
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="emp-peca"
                value={termoPeca}
                onChange={(e) => setTermoPeca(e.target.value)}
                placeholder="Buscar peça por código, nome ou referência…"
                className="h-9 pl-8 text-sm"
                autoComplete="off"
              />
            </div>
            {buscandoPeca && <p className="text-xs text-muted-foreground">Buscando…</p>}
            {resultadosPeca.length > 0 && (
              <ul className="max-h-44 overflow-auto rounded border border-border">
                {resultadosPeca.map((p) => (
                  <li key={p.codigo_produto}>
                    <button
                      type="button"
                      onClick={() => adicionarPeca(p)}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-secondary"
                    >
                      <span className="truncate">
                        <span className="font-mono text-xs text-muted-foreground">{p.codigo_produto}</span> {p.nome}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatarPreco(p.valor_venda)} · showroom {p.estoque_showroom}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="emp-obs">Observações (saem no termo)</Label>
            <Textarea
              id="emp-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Ex.: para teste na obra; retirada por…"
            />
          </div>

          <div className="rounded bg-secondary/50 px-3 py-2 text-sm">
            Valor total das peças: <strong>{formatarPreco(total)}</strong>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando || !podeSalvar}>
            {salvando ? 'Registrando…' : 'Registrar empréstimo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
