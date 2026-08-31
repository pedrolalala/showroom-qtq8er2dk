import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ImageOff, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { obterPecaPorCodigo, type PecaShowroom } from '@/services/showroom'
import { formatarPreco, formatarQuantidade } from '@/lib/format'
import { CONTATO, linkWhatsApp } from '@/lib/contato'

export default function PecaDetalhe() {
  const { codigo } = useParams<{ codigo: string }>()
  const [peca, setPeca] = useState<PecaShowroom | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'nao-encontrada' | 'erro'>(
    'carregando',
  )
  const [erroImg, setErroImg] = useState(false)

  useEffect(() => {
    const n = Number(codigo)
    if (!codigo || Number.isNaN(n)) {
      setEstado('nao-encontrada')
      return
    }
    let vivo = true
    setEstado('carregando')
    obterPecaPorCodigo(n)
      .then((p) => {
        if (!vivo) return
        setPeca(p)
        setEstado(p ? 'ok' : 'nao-encontrada')
      })
      .catch(() => vivo && setEstado('erro'))
    return () => {
      vivo = false
    }
  }, [codigo])

  return (
    <div className="animate-fade-in">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à vitrine
      </Link>

      {estado === 'carregando' && (
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="w-full pt-[85%]" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      )}

      {(estado === 'nao-encontrada' || estado === 'erro') && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">
            {estado === 'erro'
              ? 'Não foi possível carregar esta peça agora.'
              : 'Esta peça não está mais disponível no showroom.'}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Ver a vitrine</Link>
          </Button>
        </div>
      )}

      {estado === 'ok' && peca && (
        <div className="grid gap-8 md:grid-cols-2">
          <div className="relative w-full overflow-hidden rounded-lg border border-border bg-white pt-[85%]">
            {!erroImg && peca.imagem_showroom_url ? (
              <img
                src={peca.imagem_showroom_url}
                alt={peca.nome}
                onError={() => setErroImg(true)}
                className="absolute inset-0 h-full w-full object-contain p-6"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary text-muted-foreground">
                <ImageOff className="mb-2 h-10 w-10 opacity-50" />
                <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
                  Sem imagem
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {peca.marca && (
              <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {peca.marca}
              </span>
            )}
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{peca.nome}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className="border-none bg-primary text-primary-foreground">
                {formatarQuantidade(peca.estoque_showroom)}
              </Badge>
              {peca.categoria && <Badge variant="secondary">{peca.categoria}</Badge>}
              <span className="text-xs text-muted-foreground">Cód. {peca.codigo_produto}</span>
            </div>

            <p className="mt-4 text-3xl font-bold">{formatarPreco(peca.valor_venda)}</p>

            {peca.descricao_tecnica && (
              <div className="mt-6">
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Descrição técnica
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {peca.descricao_tecnica}
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="sm:flex-1">
                <a
                  href={linkWhatsApp(
                    `Olá! Tenho interesse na peça "${peca.nome}" (cód. ${peca.codigo_produto}) do showroom.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Falar com o showroom
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="sm:flex-1">
                <a href={`tel:${CONTATO.telefoneExibicao.replace(/\D/g, '')}`}>
                  Ligar {CONTATO.telefoneExibicao}
                </a>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Disponibilidade e preço sujeitos a alteração. Confirme com o showroom antes de vir
              buscar.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
