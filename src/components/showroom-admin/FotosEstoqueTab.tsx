/**
 * Aba "Fotos do estoque" (SPEC-148, Fluxo A): lista produtos com `estoque_showroom > 0` e
 * permite subir/trocar a foto direto, sem depender do PowerPoint importado. Reaproveita a
 * mesma sessão/credencial da tela `/admin` (recebida via prop, já validada pelo pai).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Layers, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Thumb } from './Thumb'
import { ComposicaoConjuntoModal } from './ComposicaoConjuntoModal'
import { listarProdutosEstoque, trocarFotoProduto, type ProdutoEstoque } from '@/services/curadoriaEstoque'
import type { Credencial } from '@/services/curadoria'

const TAMANHO_MAX_BYTES = 5 * 1024 * 1024
const TIPOS_ACEITOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

interface Props {
  cred: Credencial
  onAuthError: () => void
}

export function FotosEstoqueTab({ cred, onAuthError }: Props) {
  const [produtos, setProdutos] = useState<ProdutoEstoque[] | null>(null)
  const [termo, setTermo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<number | null>(null)
  const [composicaoAlvo, setComposicaoAlvo] = useState<ProdutoEstoque | null>(null)
  const inputsRef = useRef<Record<number, HTMLInputElement | null>>({})

  const carregar = useCallback((t?: string) => {
    setErro(null)
    listarProdutosEstoque(t)
      .then(setProdutos)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar produtos'))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    const id = setTimeout(() => carregar(termo), 300)
    return () => clearTimeout(id)
  }, [termo, carregar])

  const atualizarProduto = useCallback((codigo: number, patch: Partial<ProdutoEstoque>) => {
    setProdutos((atual) =>
      (atual ?? []).map((p) => (p.codigo_produto === codigo ? { ...p, ...patch } : p)),
    )
  }, [])

  async function escolherArquivo(p: ProdutoEstoque, file: File | undefined) {
    if (!file) return
    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error('Formato não suportado — use JPEG, PNG ou WEBP')
      return
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      toast.error('Arquivo muito grande — máximo 5MB')
      return
    }
    setEnviando(p.codigo_produto)
    try {
      const url = await trocarFotoProduto(cred, p.codigo_produto, file)
      atualizarProduto(p.codigo_produto, { imagem_showroom_url: url })
      toast.success(`Foto atualizada: ${p.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha no upload'
      toast.error(msg)
      if (/senha|usu[aá]rio/i.test(msg)) onAuthError()
    } finally {
      setEnviando(null)
      const input = inputsRef.current[p.codigo_produto]
      if (input) input.value = ''
    }
  }

  const contagem = useMemo(() => produtos?.length ?? 0, [produtos])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {produtos ? `${contagem} produto${contagem === 1 ? '' : 's'} em estoque` : 'Carregando…'}
        </p>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por nome, SKU, código…"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {erro && <p className="mb-4 text-sm text-destructive">{erro}</p>}

      {!produtos && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {produtos && (
        <ul className="space-y-3">
          {produtos.map((p) => {
            const ehMembro = p.membro_de_codigo_produto != null
            const desabilitadoPorConjunto = ehMembro
            return (
              <li
                key={p.codigo_produto}
                className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start"
              >
                <Thumb url={p.imagem_showroom_url} alt={p.nome} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.nome}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      #{p.codigo_produto}
                    </span>
                    {p.marca && <Badge variant="secondary">{p.marca}</Badge>}
                    <span className="text-xs text-muted-foreground">
                      estoque {p.estoque_showroom}
                    </span>
                    {p.eh_principal_de_grupo && (
                      <Badge variant="outline" className="gap-1">
                        <Layers className="h-3 w-3" /> Conjunto
                      </Badge>
                    )}
                    {p.membro_de_codigo_produto != null && (
                      <Badge variant="outline">
                        Já está no conjunto de #{p.membro_de_codigo_produto}
                      </Badge>
                    )}
                  </div>
                  {(p.sku || p.referencia) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.sku && <>SKU {p.sku}</>}
                      {p.sku && p.referencia && ' · '}
                      {p.referencia && <>Ref. {p.referencia}</>}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      ref={(el) => {
                        inputsRef.current[p.codigo_produto] = el
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => escolherArquivo(p, e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={enviando === p.codigo_produto || desabilitadoPorConjunto}
                      title={
                        desabilitadoPorConjunto
                          ? `Este produto já é membro do conjunto #${p.membro_de_codigo_produto} — gerencie a foto pelo principal`
                          : undefined
                      }
                      onClick={() => inputsRef.current[p.codigo_produto]?.click()}
                    >
                      <ImagePlus className="mr-1 h-3.5 w-3.5" />
                      {enviando === p.codigo_produto
                        ? 'Enviando…'
                        : p.imagem_showroom_url
                          ? 'Trocar foto'
                          : 'Adicionar foto'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={desabilitadoPorConjunto}
                      title={
                        desabilitadoPorConjunto
                          ? `Este produto já é membro do conjunto #${p.membro_de_codigo_produto}`
                          : undefined
                      }
                      onClick={() => setComposicaoAlvo(p)}
                    >
                      <Layers className="mr-1 h-3.5 w-3.5" />
                      Gerenciar composição
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
          {produtos.length === 0 && (
            <li className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </li>
          )}
        </ul>
      )}

      {composicaoAlvo && (
        <ComposicaoConjuntoModal
          open
          onOpenChange={(v) => !v && setComposicaoAlvo(null)}
          cred={cred}
          codigoProdutoPrincipal={composicaoAlvo.codigo_produto}
          nomePrincipal={composicaoAlvo.nome}
          onAuthError={onAuthError}
          onSalvo={() => carregar(termo)}
        />
      )}
    </div>
  )
}
