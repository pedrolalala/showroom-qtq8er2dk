import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarPecas,
  type FiltrosVitrine,
  type Ordenacao,
  type PecaShowroom,
} from '@/services/showroom'

const TAMANHO_PAGINA = 24
const INTERVALO_REFRESH_MS = 3 * 60 * 1000

export interface EstadoVitrine {
  itens: PecaShowroom[]
  total: number
  carregando: boolean
  carregandoMais: boolean
  erro: string | null
  temMais: boolean
  busca: string
  marca: string
  categoria: string
  ordenacao: Ordenacao
  setBusca: (v: string) => void
  setMarca: (v: string) => void
  setCategoria: (v: string) => void
  setOrdenacao: (v: Ordenacao) => void
  carregarMais: () => void
  recarregar: () => void
}

export function useVitrine(): EstadoVitrine {
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('nome')

  const [itens, setItens] = useState<PecaShowroom[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300)
    return () => clearTimeout(t)
  }, [busca])

  const filtros = useCallback(
    (p: number): FiltrosVitrine => ({
      busca: buscaDebounced,
      marca,
      categoria,
      ordenacao,
      pagina: p,
      tamanhoPagina: TAMANHO_PAGINA,
    }),
    [buscaDebounced, marca, categoria, ordenacao],
  )

  // Recarrega da estaca zero sempre que um filtro muda.
  useEffect(() => {
    const id = ++reqId.current
    setCarregando(true)
    setErro(null)
    listarPecas(filtros(0))
      .then(({ itens, total }) => {
        if (id !== reqId.current) return
        setItens(itens)
        setTotal(total)
        setPagina(0)
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return
        setErro(e instanceof Error ? e.message : 'Falha ao carregar as peças.')
        setItens([])
        setTotal(0)
      })
      .finally(() => {
        if (id === reqId.current) setCarregando(false)
      })
  }, [filtros])

  const carregarMais = useCallback(() => {
    if (carregandoMais || carregando) return
    if (itens.length >= total) return
    const prox = pagina + 1
    const id = reqId.current
    setCarregandoMais(true)
    listarPecas(filtros(prox))
      .then(({ itens: novos }) => {
        if (id !== reqId.current) return
        setItens((atual) => {
          const vistos = new Set(atual.map((x) => x.codigo_produto))
          return [...atual, ...novos.filter((x) => !vistos.has(x.codigo_produto))]
        })
        setPagina(prox)
      })
      .catch(() => {})
      .finally(() => {
        if (id === reqId.current) setCarregandoMais(false)
      })
  }, [carregandoMais, carregando, itens.length, total, pagina, filtros])

  const recarregar = useCallback(() => {
    // Forca o efeito de recarregar mexendo numa dependencia estavel.
    setBuscaDebounced((v) => v)
    reqId.current++
    setCarregando(true)
    listarPecas(filtros(0))
      .then(({ itens, total }) => {
        setItens(itens)
        setTotal(total)
        setPagina(0)
        setErro(null)
      })
      .catch((e: unknown) =>
        setErro(e instanceof Error ? e.message : 'Falha ao carregar as peças.'),
      )
      .finally(() => setCarregando(false))
  }, [filtros])

  // Atualizacao leve: so quando o usuario esta na 1a pagina (sem scroll infinito
  // em andamento), pra nao embaralhar a lista. Ver SPEC-125 (sem realtime: anon
  // nao le `produtos`).
  useEffect(() => {
    const aoFocar = () => {
      if (pagina === 0 && !carregandoMais) recarregar()
    }
    const timer = setInterval(aoFocar, INTERVALO_REFRESH_MS)
    window.addEventListener('focus', aoFocar)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', aoFocar)
    }
  }, [pagina, carregandoMais, recarregar])

  return {
    itens,
    total,
    carregando,
    carregandoMais,
    erro,
    temMais: itens.length < total,
    busca,
    marca,
    categoria,
    ordenacao,
    setBusca,
    setMarca,
    setCategoria,
    setOrdenacao,
    carregarMais,
    recarregar,
  }
}
