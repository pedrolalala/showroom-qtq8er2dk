/**
 * Thumb (SPEC-148): extraído de `src/pages/Admin.tsx` (era um componente local usado só na
 * aba "Vincular do PPT") pra ser compartilhado também pela aba nova "Fotos do estoque" e pelo
 * `ComposicaoConjuntoModal`. Mesmo comportamento de sempre: placeholder quando não há
 * `url`/a imagem falha ao carregar.
 */
import { useState } from 'react'
import { ImageOff } from 'lucide-react'

export function Thumb({ url, alt }: { url: string | null; alt: string }) {
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
