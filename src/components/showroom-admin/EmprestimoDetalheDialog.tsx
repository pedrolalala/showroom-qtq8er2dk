/**
 * Detalhe do empréstimo (SPEC-219): termo em PDF, devolução peça a peça (OK ou com dano) e
 * cancelamento (só enquanto nenhuma peça foi devolvida).
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileDown } from 'lucide-react'
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
import type { Credencial } from '@/services/curadoria'
import {
  cancelarEmprestimo,
  numeroEmprestimo,
  obterEmprestimo,
  registrarDevolucao,
  ROTULO_SITUACAO,
  type EmprestimoDetalhe,
  type ItemEmprestimo,
} from '@/services/emprestimos'
import { StatusEmprestimoBadge } from './StatusEmprestimoBadge'

const fmtDia = (v: string | null) => {
  if (!v) return '-'
  const [a, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const brParaNumero = (t: string) => {
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

interface Props {
  emprestimoId: string | null
  onOpenChange: (open: boolean) => void
  cred: Credencial
  onAuthError: () => void
  onAlterado: () => void
}

export function EmprestimoDetalheDialog({ emprestimoId, onOpenChange, cred, onAuthError, onAlterado }: Props) {
  const [emp, setEmp] = useState<EmprestimoDetalhe | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  // devolução com dano em edição (uma peça por vez)
  const [danoItem, setDanoItem] = useState<ItemEmprestimo | null>(null)
  const [danoDescricao, setDanoDescricao] = useState('')
  const [danoValor, setDanoValor] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const tratarErro = useCallback(
    (e: unknown, padrao: string) => {
      const msg = e instanceof Error ? e.message : padrao
      toast.error(msg)
      if (/senha|usu[aá]rio/i.test(msg)) onAuthError()
    },
    [onAuthError],
  )

  const carregar = useCallback(async () => {
    if (!emprestimoId) return
    try {
      setEmp(await obterEmprestimo(cred, emprestimoId))
    } catch (e) {
      tratarErro(e, 'Falha ao abrir empréstimo')
    }
  }, [cred, emprestimoId, tratarErro])

  useEffect(() => {
    setEmp(null)
    setDanoItem(null)
    setCancelando(false)
    setMotivo('')
    void carregar()
  }, [carregar])

  async function baixarPdf() {
    if (!emp) return
    setGerandoPdf(true)
    try {
      const { baixarTermoEmprestimo } = await import('@/lib/pdf-termo-emprestimo')
      await baixarTermoEmprestimo(emp)
    } catch (e) {
      tratarErro(e, 'Erro ao gerar o PDF')
    } finally {
      setGerandoPdf(false)
    }
  }

  async function devolverOk(item: ItemEmprestimo) {
    setOcupado(true)
    try {
      await registrarDevolucao(cred, item.id, false)
      toast.success(`Devolução registrada: ${item.nome}`)
      await carregar()
      onAlterado()
    } catch (e) {
      tratarErro(e, 'Erro ao registrar devolução')
    } finally {
      setOcupado(false)
    }
  }

  function abrirDano(item: ItemEmprestimo) {
    setDanoItem(item)
    setDanoDescricao('')
    setDanoValor((item.valor_unitario * item.quantidade).toFixed(2).replace('.', ','))
  }

  async function confirmarDano() {
    if (!danoItem) return
    const valor = brParaNumero(danoValor)
    const integral = danoItem.valor_unitario * danoItem.quantidade
    if (!danoDescricao.trim()) return toast.error('Descreva o dano.')
    if (Number.isNaN(valor) || valor < 0 || valor > integral + 0.005)
      return toast.error(`O valor deve ficar entre R$ 0,00 e ${formatarPreco(integral)} (valor integral).`)
    setOcupado(true)
    try {
      await registrarDevolucao(cred, danoItem.id, true, danoDescricao, valor)
      toast.success(`Devolução com dano registrada: ${danoItem.nome}`)
      setDanoItem(null)
      await carregar()
      onAlterado()
    } catch (e) {
      tratarErro(e, 'Erro ao registrar devolução')
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarCancelamento() {
    if (!emp || !motivo.trim()) return
    setOcupado(true)
    try {
      await cancelarEmprestimo(cred, emp.id, motivo)
      toast.success(`Empréstimo ${numeroEmprestimo(emp.numero)} cancelado`)
      setCancelando(false)
      await carregar()
      onAlterado()
    } catch (e) {
      tratarErro(e, 'Erro ao cancelar')
    } finally {
      setOcupado(false)
    }
  }

  const cancelado = !!emp?.cancelado_em
  const podeCancelar = !!emp && !cancelado && emp.itens.every((i) => i.situacao === 'emprestado')
  const total = emp ? emp.itens.reduce((a, i) => a + i.valor_unitario * i.quantidade, 0) : 0

  return (
    <Dialog open={!!emprestimoId} onOpenChange={(v) => !ocupado && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Empréstimo {emp ? numeroEmprestimo(emp.numero) : ''}
            {emp && <StatusEmprestimoBadge status={emp.status} />}
          </DialogTitle>
          <DialogDescription>
            {emp
              ? `${emp.empresa.nome} · emprestado em ${fmtDia(emp.data_emprestimo)} · devolver até ${fmtDia(emp.data_prevista_devolucao)}`
              : 'Carregando…'}
          </DialogDescription>
        </DialogHeader>

        {emp && (
          <div className="space-y-4 text-sm">
            <div className="rounded border border-border px-3 py-2">
              <div className="font-medium">{emp.cliente.nome}</div>
              <div className="text-xs text-muted-foreground">
                {[emp.cliente.cpf_cnpj, emp.cliente.telefone, emp.cliente.email].filter(Boolean).join(' · ') ||
                  'Sem documento/contato no cadastro'}
              </div>
              {emp.observacoes && <p className="mt-1 text-xs">Obs.: {emp.observacoes}</p>}
              {cancelado && (
                <p className="mt-1 text-xs text-destructive">
                  Cancelado em {new Date(emp.cancelado_em as string).toLocaleDateString('pt-BR')}: {emp.cancelado_motivo}
                </p>
              )}
            </div>

            <ul className="space-y-2">
              {emp.itens.map((i) => (
                <li key={i.id} className="rounded border border-border px-3 py-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs text-muted-foreground">{i.codigo_produto}</span>{' '}
                      <span className="font-medium">{i.nome}</span>
                      <div className="text-xs text-muted-foreground">
                        {i.quantidade} × {formatarPreco(i.valor_unitario)} ={' '}
                        {formatarPreco(i.quantidade * i.valor_unitario)} · {ROTULO_SITUACAO[i.situacao]}
                        {i.data_devolucao && ` em ${fmtDia(i.data_devolucao)}`}
                      </div>
                      {i.situacao === 'devolvido_com_dano' && (
                        <p className="mt-0.5 text-xs text-destructive">
                          Dano: {i.descricao_dano} — cobrar {formatarPreco(i.valor_dano ?? 0)}
                        </p>
                      )}
                    </div>
                    {i.situacao === 'emprestado' && !cancelado && (
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => devolverOk(i)}>
                          Devolvida OK
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={ocupado}
                          onClick={() => abrirDano(i)}
                        >
                          Com dano
                        </Button>
                      </div>
                    )}
                  </div>

                  {danoItem?.id === i.id && (
                    <div className="mt-2 space-y-2 rounded bg-secondary/50 p-2">
                      <div className="space-y-1">
                        <Label htmlFor="dano-desc">O que aconteceu com a peça?</Label>
                        <Textarea
                          id="dano-desc"
                          rows={2}
                          value={danoDescricao}
                          onChange={(e) => setDanoDescricao(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="dano-valor">Valor a cobrar (R$)</Label>
                        <Input
                          id="dano-valor"
                          value={danoValor}
                          onChange={(e) => setDanoValor(e.target.value)}
                          inputMode="decimal"
                          className="h-8 w-40"
                        />
                        <p className="text-xs text-muted-foreground">
                          Valor integral: {formatarPreco(i.valor_unitario * i.quantidade)}. Só diminua se nem todas
                          as unidades voltaram danificadas.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="destructive" disabled={ocupado} onClick={confirmarDano}>
                          Registrar devolução com dano
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => setDanoItem(null)}>
                          Voltar
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="rounded bg-secondary/50 px-3 py-2">
              Valor total das peças: <strong>{formatarPreco(total)}</strong>
            </div>

            {cancelando && (
              <div className="space-y-2 rounded border border-destructive/40 p-2">
                <Label htmlFor="cancel-motivo">Motivo do cancelamento</Label>
                <Textarea id="cancel-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={ocupado || !motivo.trim()}
                    onClick={confirmarCancelamento}
                  >
                    Confirmar cancelamento
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => setCancelando(false)}>
                    Voltar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {podeCancelar && !cancelando ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={ocupado}
              onClick={() => setCancelando(true)}
            >
              Cancelar empréstimo
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={baixarPdf} disabled={!emp || gerandoPdf}>
            <FileDown className="mr-1 h-4 w-4" />
            {gerandoPdf ? 'Gerando…' : 'Baixar termo (PDF)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
