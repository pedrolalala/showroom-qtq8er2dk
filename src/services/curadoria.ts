/**
 * Tela /admin (SPEC-125): vincular as peças do PowerPoint aos produtos de estoque.
 * Protegida por usuário + senha (guardados como hash em showroom_config no banco).
 * A credencial é digitada na tela e enviada em cada RPC — nunca fica no bundle.
 */
import { db } from '@/lib/supabase/db'

export interface Credencial {
  user: string
  senha: string
}

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

function erroCred(msg: string): Error {
  return new Error(/senha|usu[aá]rio|28000/i.test(msg) ? 'Usuário ou senha inválidos' : msg)
}

export async function login(c: Credencial): Promise<void> {
  const { error } = await db.rpc('showroom_login', { p_user: c.user, p_senha: c.senha })
  if (error) throw erroCred(error.message)
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

export async function vincular(c: Credencial, slide: number, codigo: number): Promise<void> {
  const { error } = await db.rpc('showroom_vincular_peca', {
    p_user: c.user,
    p_senha: c.senha,
    p_slide: slide,
    p_codigo_produto: codigo,
  })
  if (error) throw erroCred(error.message)
}

export async function desvincular(c: Credencial, slide: number): Promise<void> {
  const { error } = await db.rpc('showroom_desvincular_peca', {
    p_user: c.user,
    p_senha: c.senha,
    p_slide: slide,
  })
  if (error) throw erroCred(error.message)
}
