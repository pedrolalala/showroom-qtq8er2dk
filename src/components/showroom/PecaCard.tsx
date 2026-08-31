import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatarPreco, formatarQuantidade } from '@/lib/format'
import type { PecaShowroom } from '@/services/showroom'

export function PecaCard({ peca }: { peca: PecaShowroom }) {
  const [erroImg, setErroImg] = useState(false)

  return (
    <Link
      to={`/peca/${peca.codigo_produto}`}
      className="group block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Card className="flex h-full flex-col overflow-hidden border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-elevation">
        <div className="relative w-full overflow-hidden bg-white pt-[85%]">
          {!erroImg && peca.imagem_showroom_url ? (
            <img
              src={peca.imagem_showroom_url}
              alt={peca.nome}
              loading="lazy"
              draggable={false}
              onError={() => setErroImg(true)}
              className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary text-muted-foreground">
              <ImageOff className="mb-2 h-8 w-8 opacity-50" />
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                Sem imagem
              </span>
            </div>
          )}
          <Badge className="absolute left-3 top-3 border-none bg-primary text-primary-foreground shadow-sm">
            {formatarQuantidade(peca.estoque_showroom)}
          </Badge>
        </div>

        <CardContent className="flex flex-1 flex-col gap-1 p-4">
          {peca.marca && (
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {peca.marca}
            </span>
          )}
          <h3
            className="line-clamp-2 font-semibold leading-tight text-foreground transition-colors group-hover:text-primary"
            title={peca.nome}
          >
            {peca.nome}
          </h3>
          <p className="mt-auto pt-2 text-lg font-bold text-foreground">
            {formatarPreco(peca.valor_venda)}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
