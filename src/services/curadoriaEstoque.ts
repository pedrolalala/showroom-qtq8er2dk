/**
 * Tela /admin, aba "Fotos do estoque" (SPEC-148, Fluxo A): subir/trocar a foto de um produto
 * já em estoque (`produtos.estoque_showroom > 0`) direto por upload de arquivo, sem depender
 * do PowerPoint importado. Mesmo padrão de `src/services/curadoria.ts`: funções puras
 * chamando `db.from()/db.rpc()`, credencial explícita em cada chamada de escrita, sem hook de
 * estado global.
 */
import { supabase } from '@/lib/supabase/client'
import { db } from '@/lib/supabase/db'
import type { Credencial } from './curadoria'
import { VIEW } from './showroom'

const BUCKET = 'showroom-lucenera'

export interface ProdutoEstoque {
  codigo_produto: number
  nome: string
  codigo_legado: number | null
  referencia: string | null
  estoque_showroom: number
  imagem_showroom_url: string | null
  marca: string | null
  /** SPEC-148 (Fluxo B): true quando este produto já é o principal de um conjunto. */
  eh_principal_de_grupo: boolean
  /** SPEC-148 (Fluxo B): código do principal quando este produto já é membro de outro conjunto. */
  membro_de_codigo_produto: number | null
}

function erroCred(msg: string): Error {
  return new Error(/senha|usu[aá]rio|28000/i.test(msg) ? 'Usuário ou senha inválidos' : msg)
}

/** Lista produtos com `estoque_showroom > 0` (com ou sem foto), busca por nome/código legado/código. */
export async function listarProdutosEstoque(termo?: string): Promise<ProdutoEstoque[]> {
  const { data, error } = await db.rpc('showroom_listar_produtos_estoque', {
    p_termo: termo?.trim() || null,
  })
  if (error) throw error
  return (data ?? []) as ProdutoEstoque[]
}

/**
 * SPEC-165: códigos dos produtos que aparecem hoje na página inicial (`vw_showroom_publico`),
 * pra aba de fotos marcar/filtrar "Na vitrine" com a mesma regra do site público.
 */
export async function listarCodigosNaVitrine(): Promise<Set<number>> {
  const { data, error } = await db.from(VIEW).select('codigo_produto')
  if (error) throw error
  return new Set((data ?? []).map((r: { codigo_produto: number }) => r.codigo_produto))
}

/** SPEC-184: peça tirada da vitrine pelo /admin (produto, foto e estoque ficam intactos). */
export interface PecaOculta {
  codigo_produto: number
  nome: string
  marca: string | null
  referencia: string | null
  estoque_showroom: number
  imagem_showroom_url: string | null
  ocultado_em: string
}

export async function listarOcultas(c: Credencial): Promise<PecaOculta[]> {
  const { data, error } = await db.rpc('showroom_listar_ocultas', {
    p_user: c.user,
    p_senha: c.senha,
  })
  if (error) throw erroCred(error.message)
  return (data ?? []) as PecaOculta[]
}

export async function ocultarPeca(c: Credencial, codigoProduto: number): Promise<void> {
  const { error } = await db.rpc('showroom_ocultar_peca', {
    p_user: c.user,
    p_senha: c.senha,
    p_codigo_produto: codigoProduto,
  })
  if (error) throw erroCred(error.message)
}

export async function reexibirPeca(c: Credencial, codigoProduto: number): Promise<void> {
  const { error } = await db.rpc('showroom_reexibir_peca', {
    p_user: c.user,
    p_senha: c.senha,
    p_codigo_produto: codigoProduto,
  })
  if (error) throw erroCred(error.message)
}

/**
 * Passo 1 do upload: pede ao banco a liberação temporária (TTL 15 min) de um path em
 * `produtos/` para este produto. Retorna o path novo e, se houver, o path antigo (só quando
 * já está em `produtos/` — nunca aponta pra `import/`).
 */
export async function liberarUpload(
  c: Credencial,
  codigoProduto: number,
  extensao: string,
): Promise<{ path: string; oldPath: string | null }> {
  const { data, error } = await db.rpc('showroom_liberar_upload_produto', {
    p_user: c.user,
    p_senha: c.senha,
    p_codigo_produto: codigoProduto,
    p_extensao: extensao,
  })
  if (error) throw erroCred(error.message)
  return { path: data.path as string, oldPath: (data.old_path as string | null) ?? null }
}

/**
 * Passo 3 do upload: confirma que o arquivo já subiu (o banco confere que existe no Storage
 * no path liberado), grava `produtos.imagem_showroom_url` e consome a liberação. Retorna o
 * `old_path` (se houver) para o caller decidir remover o arquivo antigo do Storage — só depois
 * desta chamada ter sucesso.
 */
export async function confirmarFoto(
  c: Credencial,
  codigoProduto: number,
  urlPublica: string,
): Promise<{ oldPath: string | null }> {
  const { data, error } = await db.rpc('showroom_confirmar_foto_produto', {
    p_user: c.user,
    p_senha: c.senha,
    p_codigo_produto: codigoProduto,
    p_url_publica: urlPublica,
  })
  if (error) throw erroCred(error.message)
  return { oldPath: (data.old_path as string | null) ?? null }
}

/**
 * Fluxo completo de upload de foto (§10 da SPEC-148): liberar -> subir no Storage -> obter URL
 * pública -> confirmar no banco -> remover arquivo antigo (só depois da confirmação).
 */
export async function trocarFotoProduto(
  c: Credencial,
  codigoProduto: number,
  file: File,
): Promise<string> {
  const extensao = (file.name.split('.').pop() || '').toLowerCase()
  const { path } = await liberarUpload(c, codigoProduto, extensao)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { oldPath: oldPathConfirmado } = await confirmarFoto(c, codigoProduto, publicUrl)

  if (oldPathConfirmado) {
    // Best-effort: se a remoção do arquivo antigo falhar, a troca de foto já foi concluída
    // com sucesso (produtos.imagem_showroom_url já aponta pro novo arquivo) — só fica lixo
    // órfão no bucket, não é motivo pra reportar erro ao usuário.
    await supabase.storage
      .from(BUCKET)
      .remove([oldPathConfirmado])
      .catch(() => undefined)
  }

  return publicUrl
}
