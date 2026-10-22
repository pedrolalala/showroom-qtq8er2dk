/**
 * Aba "Empréstimos" (SPEC-219): peças do showroom emprestadas a clientes, com termo em PDF para
 * o cliente assinar e controle da devolução. Só registro — não mexe em estoque nem na vitrine.
 */
import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatarPreco } from '@/lib/format'
import type { Credencial } from '@/services/curadoria'
import {
  listarEmprestimos,
  numeroEmprestimo,
  type EmprestimoResumo,
  type StatusEmprestimo,
} from '@/services/emprestimos'
import { NovoEmprestimoDialog } from './NovoEmprestimoDialog'
import { EmprestimoDetalheDialog } from './EmprestimoDetalheDialog'
import { StatusEmprestimoBadge } from './StatusEmprestimoBadge'

// "Em aberto" inclui os atrasados (tudo que ainda tem peça com o cliente).
const FILTROS: { valor: StatusEmprestimo | null; rotulo: string }[] = [
  { valor: 'em_aberto', rotulo: 'Em aberto' },
  { valor: 'atrasado', rotulo: 'Atrasados' },
  { valor: 'devolvido_com_dano', rotulo: 'Com dano' },
  { valor: null, rotulo: 'Todos' },
]

const fmtDia = (v: string) => {
  const [a, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

interface Props {
  cred: Credencial
  onAuthError: () => void
}

export function EmprestimosTab({ cred, onAuthError }: Props) {
  const [lista, setLista] = useState<EmprestimoResumo[] | null>(null)
  const [filtro, setFiltro] = useState<StatusEmprestimo | null>('em_aberto')
  const [termo, setTermo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [detalheId, setDetalheId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    try {
      setLista(await listarEmprestimos(cred, filtro, termo))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao carregar empréstimos'
      setErro(msg)
      setLista([])
      if (/senha|usu[aá]rio/i.test(msg)) onAuthError()
    }
  }, [cred, filtro, termo, onAuthError])

  useEffect(() => {
    const id = setTimeout(() => void carregar(), termo ? 300 : 0)
    return () => clearTimeout(id)
  }, [carregar, termo])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <Button
              key={f.rotulo}
              type="button"
              size="sm"
              variant={filtro === f.valor ? 'default' : 'outline'}
              onClick={() => setFiltro(f.valor)}
            >
              {f.rotulo}
            </Button>
          ))}
          <span className="text-sm text-muted-foreground">
            {lista ? `${lista.length} empréstimo${lista.length === 1 ? '' : 's'}` : 'Carregando…'}
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por cliente ou número…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Button type="button" size="sm" onClick={() => setNovoAberto(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo empréstimo
          </Button>
        </div>
      </div>

      {erro && <p className="mb-4 text-sm text-destructive">{erro}</p>}

      {lista === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setDetalheId(e.id)}
                className="flex w-full flex-col gap-2 rounded-lg border border-border p-3 text-left transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {numeroEmprestimo(e.numero)}
                    </span>
                    <span className="font-medium">{e.cliente_nome}</span>
                    <StatusEmprestimoBadge status={e.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.empresa_nome} · emprestado em {fmtDia(e.data_emprestimo)} · devolver até{' '}
                    <span className={e.status === 'atrasado' ? 'font-semibold text-destructive' : ''}>
                      {fmtDia(e.data_prevista_devolucao)}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <div>
                    {e.qtd_pecas} peça{e.qtd_pecas === 1 ? '' : 's'}
                    {e.qtd_pecas_em_aberto > 0 && e.qtd_pecas_em_aberto < e.qtd_pecas && (
                      <span className="text-muted-foreground"> ({e.qtd_pecas_em_aberto} com o cliente)</span>
                    )}
                  </div>
                  <div className="font-medium">{formatarPreco(e.valor_total)}</div>
                  {e.valor_dano > 0 && (
                    <div className="text-xs text-destructive">Dano: {formatarPreco(e.valor_dano)}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
          {lista.length === 0 && (
            <li className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Nenhum empréstimo{filtro ? ' neste filtro' : ''}.
            </li>
          )}
        </ul>
      )}

      <NovoEmprestimoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        cred={cred}
        onAuthError={onAuthError}
        onCriado={(id) => {
          void carregar()
          setDetalheId(id)
        }}
      />
      <EmprestimoDetalheDialog
        emprestimoId={detalheId}
        onOpenChange={(v) => !v && setDetalheId(null)}
        cred={cred}
        onAuthError={onAuthError}
        onAlterado={() => void carregar()}
      />
    </div>
  )
}
