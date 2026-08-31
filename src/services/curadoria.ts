/**
 * Tela /admin (SPEC-125): vincular as peças do PowerPoint aos produtos de estoque.
 * Protegida por PIN (tabela showroom_config no banco). O PIN é digitado na tela e
 * enviado em cada RPC — nunca fica no bundle.
 */
import { db } from '@/lib/supabase/db'

export interface Candidato {
  codigo: number
  nome: string
  score?: string
}

export interface ImportPeca {
  slide: number
  nome_ppt: string
  qtd_ppt: number | null
  marca_ppt: string | null
  observacoes: string | null
  imagem_url: string
  candidatos: Candidato[]
  codigo_produto_vinculado: number | null
  vinculado_em: string | null
}

export interface ProdutoBusca {
  codigo_produto: number
  nome: string
  marca: string | null
  estoque_showroom: number
  valor_venda: number
}

export async function listarImportPecas(): Promise<ImportPeca[]> {
  const { data, error } = await db
    .from('showroom_import_pecas')
    .select(
      'slide,nome_ppt,qtd_ppt,marca_ppt,observacoes,imagem_url,candidatos,codigo_produto_vinculado,vinculado_em',
    )
    .order('slide')
  if (error) throw error
  return (data ?? []) as ImportPeca[]
}

export async function buscarProduto(termo: string): Promise<ProdutoBusca[]> {
  const t = termo.trim()
  if (!t) return []
  const { data, error } = await db.rpc('showroom_buscar_produto', { p_termo: t })
  if (error) throw error
  return (data ?? []) as ProdutoBusca[]
}

export async function vincular(pin: string, slide: number, codigo: number): Promise<void> {
  const { error } = await db.rpc('showroom_vincular_peca', {
    p_pin: pin,
    p_slide: slide,
    p_codigo_produto: codigo,
  })
  if (error) throw new Error(error.message.includes('PIN') ? 'PIN inválido' : error.message)
}

export async function desvincular(pin: string, slide: number): Promise<void> {
  const { error } = await db.rpc('showroom_desvincular_peca', { p_pin: pin, p_slide: slide })
  if (error) throw new Error(error.message.includes('PIN') ? 'PIN inválido' : error.message)
}
