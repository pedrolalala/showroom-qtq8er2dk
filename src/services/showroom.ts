/**
 * Acesso somente-leitura a vw_showroom_publico (SPEC-125).
 *
 * A view expoe apenas a whitelist de campos do produto e ja filtra
 * `ativo AND imagem_showroom_url IS NOT NULL AND estoque_showroom > 0`.
 * Nenhuma escrita, nenhum login. Chave anonima (VITE_SUPABASE_PUBLISHABLE_KEY).
 */
import { db } from '@/lib/supabase/db'

export const VIEW = 'vw_showroom_publico'

export interface PecaShowroom {
  codigo_produto: number
  nome: string
  marca: string | null
  categoria: string | null
  estoque_showroom: number
  valor_venda: number
  descricao_tecnica: string | null
  imagem_showroom_url: string
  atualizado_em: string | null
}

export type Ordenacao = 'nome' | 'preco-asc' | 'preco-desc' | 'recentes'

export interface FiltrosVitrine {
  busca?: string
  marca?: string
  categoria?: string
  ordenacao?: Ordenacao
  pagina?: number
  tamanhoPagina?: number
}

const COLS =
  'codigo_produto,nome,marca,categoria,estoque_showroom,valor_venda,descricao_tecnica,imagem_showroom_url,atualizado_em'

function aplicarOrdenacao(q: any, ord: Ordenacao) {
  switch (ord) {
    case 'preco-asc':
      return q.order('valor_venda', { ascending: true }).order('nome', { ascending: true })
    case 'preco-desc':
      return q.order('valor_venda', { ascending: false }).order('nome', { ascending: true })
    case 'recentes':
      return q.order('atualizado_em', { ascending: false, nullsFirst: false }).order('nome', {
        ascending: true,
      })
    default:
      return q.order('nome', { ascending: true })
  }
}

export async function listarPecas(
  filtros: FiltrosVitrine = {},
): Promise<{ itens: PecaShowroom[]; total: number }> {
  const {
    busca = '',
    marca = '',
    categoria = '',
    ordenacao = 'nome',
    pagina = 0,
    // Dataset do showroom e pequeno (<= algumas centenas). Paginacao por range
    // e suficiente; ver SPEC-081 sobre o teto de 1000 linhas do PostgREST.
    tamanhoPagina = 24,
  } = filtros

  let q = db.from(VIEW).select(COLS, { count: 'exact' })

  const termo = busca.trim()
  if (termo) {
    // No filtro `or` do PostgREST o curinga do ilike e `*` (nao `%`); tiramos
    // virgula/parenteses/asterisco do texto do usuario pra nao quebrar a sintaxe.
    const t = termo.replace(/[%,()*]/g, ' ').trim()
    if (t) q = q.or(`nome.ilike.*${t}*,marca.ilike.*${t}*,categoria.ilike.*${t}*`)
  }
  if (marca) q = q.eq('marca', marca)
  if (categoria) q = q.eq('categoria', categoria)

  q = aplicarOrdenacao(q, ordenacao)

  const from = pagina * tamanhoPagina
  q = q.range(from, from + tamanhoPagina - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { itens: (data ?? []) as PecaShowroom[], total: count ?? 0 }
}

export async function obterPecaPorCodigo(codigo: number): Promise<PecaShowroom | null> {
  const { data, error } = await db
    .from(VIEW)
    .select(COLS)
    .eq('codigo_produto', codigo)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as PecaShowroom) ?? null
}

/** Valores distintos para os selects de filtro (dataset pequeno, dedupe no cliente). */
export async function listarFacetas(): Promise<{ marcas: string[]; categorias: string[] }> {
  const { data, error } = await db.from(VIEW).select('marca,categoria')
  if (error) throw error
  const marcas = new Set<string>()
  const categorias = new Set<string>()
  for (const row of data ?? []) {
    if (row.marca) marcas.add(row.marca)
    if (row.categoria) categorias.add(row.categoria)
  }
  const ordenar = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return { marcas: ordenar(marcas), categorias: ordenar(categorias) }
}
