import { useEffect, useRef, useState } from 'react'
import { Search, PackageOpen, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PecaCard } from '@/components/showroom/PecaCard'
import { useVitrine } from '@/hooks/useVitrine'
import { listarFacetas } from '@/services/showroom'
import type { Ordenacao } from '@/services/showroom'

const TODAS = '__todas__'

const ORDENS: { valor: Ordenacao; rotulo: string }[] = [
  { valor: 'nome', rotulo: 'Nome (A–Z)' },
  { valor: 'preco-asc', rotulo: 'Menor preço' },
  { valor: 'preco-desc', rotulo: 'Maior preço' },
  { valor: 'recentes', rotulo: 'Mais recentes' },
]

export default function Vitrine() {
  const v = useVitrine()
  const [facetas, setFacetas] = useState<{ marcas: string[]; categorias: string[] }>({
    marcas: [],
    categorias: [],
  })
  const sentinela = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listarFacetas()
      .then(setFacetas)
      .catch(() => setFacetas({ marcas: [], categorias: [] }))
  }, [])

  const carregarMais = v.carregarMais
  useEffect(() => {
    const el = sentinela.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) carregarMais()
      },
      { rootMargin: '600px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [carregarMais, v.itens.length])

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Peças em pronta entrega</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que está disponível agora no showroom Lucenera.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={v.busca}
            onChange={(e) => v.setBusca(e.target.value)}
            placeholder="Buscar por nome, marca ou categoria"
            className="pl-9"
            aria-label="Buscar peças"
          />
        </div>

        <Select value={v.marca || TODAS} onValueChange={(x) => v.setMarca(x === TODAS ? '' : x)}>
          <SelectTrigger className="sm:w-44" aria-label="Filtrar por marca">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as marcas</SelectItem>
            {facetas.marcas.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={v.categoria || TODAS}
          onValueChange={(x) => v.setCategoria(x === TODAS ? '' : x)}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por categoria">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as categorias</SelectItem>
            {facetas.categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={v.ordenacao} onValueChange={(x) => v.setOrdenacao(x as Ordenacao)}>
          <SelectTrigger className="sm:w-40" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDENS.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contador */}
      {!v.carregando && !v.erro && (
        <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
          {v.total === 0
            ? 'Nenhuma peça encontrada'
            : `${v.total} ${v.total === 1 ? 'peça' : 'peças'}`}
        </p>
      )}

      {/* Erro */}
      {v.erro && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-secondary py-16 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar as peças agora.</p>
          <Button variant="outline" size="sm" onClick={v.recarregar}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar de novo
          </Button>
        </div>
      )}

      {/* Loading inicial */}
      {v.carregando && !v.erro && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="w-full pt-[85%]" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Vazio */}
      {!v.carregando && !v.erro && v.total === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            Nenhuma peça disponível no momento. Volte em breve.
          </p>
        </div>
      )}

      {/* Grade */}
      {!v.carregando && !v.erro && v.itens.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {v.itens.map((p) => (
              <PecaCard key={p.codigo_produto} peca={p} />
            ))}
          </div>
          <div ref={sentinela} className="h-10" />
          {v.carregandoMais && (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando mais…</p>
          )}
        </>
      )}
    </div>
  )
}
