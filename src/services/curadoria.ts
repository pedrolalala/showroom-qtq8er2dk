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
  /** SPEC-148: true quando este produto já é o principal de um conjunto (peça composta). */
  eh_principal_de_grupo: boolean
  /** SPEC-148: código do principal quando este produto já é membro de outro conjunto. */
  membro_de_codigo_produto: number | null
}

/** SPEC-148: membro de um conjunto, retornado por `obterComposicao`. */
export interface MembroComposicao {
  codigo_produto: number
  nome: string
  sku: string | null
  estoque_showroom: number
  valor_venda: number
  quantidade: number
}

/** SPEC-148: item mandado para `definirComposicao` (substituição total da lista de membros). */
export interface MembroComposicaoInput {
  codigo_produto: number
  quantidade: number
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

/**
 * SPEC-148 (Fluxo B — peça composta): lista os membros atuais de um produto principal.
 * Sem credencial (mesmo padrão de `buscarProduto` — leitura não sensível).
 */
export async function obterComposicao(
  codigoProdutoPrincipal: number,
): Promise<MembroComposicao[]> {
  const { data, error } = await db.rpc('showroom_obter_composicao', {
    p_codigo_produto_principal: codigoProdutoPrincipal,
  })
  if (error) throw error
  return (data ?? []) as MembroComposicao[]
}

/**
 * SPEC-148 (Fluxo B): substituição total e idempotente da lista de membros de um principal —
 * mandar `[]` limpa o conjunto (produto volta a ser peça avulsa).
 */
export async function definirComposicao(
  c: Credencial,
  codigoProdutoPrincipal: number,
  membros: MembroComposicaoInput[],
): Promise<void> {
  const { error } = await db.rpc('showroom_definir_composicao', {
    p_user: c.user,
    p_senha: c.senha,
    p_codigo_produto_principal: codigoProdutoPrincipal,
    p_membros: membros.map((m) => ({ codigo_produto: m.codigo_produto, quantidade: m.quantidade })),
  })
  if (error) throw erroCred(error.message)
}
