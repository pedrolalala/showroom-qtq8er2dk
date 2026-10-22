/**
 * Tela /admin, aba "Empréstimos" (SPEC-219): peças emprestadas a clientes + termo em PDF.
 * Só registro — não mexe em estoque_showroom nem na vitrine. Mesmo padrão de curadoria.ts:
 * funções puras, credencial do /admin explícita em toda RPC (as tabelas não têm grant;
 * dado de cliente só sai pelas RPCs showroom_emp_*).
 */
import { supabase } from '@/lib/supabase/client'
import { db } from '@/lib/supabase/db'
import { compactarFoto } from '@/lib/foto-compacta'
import type { Credencial } from './curadoria'

// Bucket PRIVADO (fase 2 da SPEC-219): envio e leitura só com liberação temporária por RPC.
const BUCKET_FOTOS = 'showroom-emprestimos'

export type StatusEmprestimo =
  | 'em_aberto'
  | 'atrasado'
  | 'devolvido'
  | 'devolvido_com_dano'
  | 'cancelado'

export type SituacaoItem = 'emprestado' | 'devolvido' | 'devolvido_com_dano'

export const ROTULO_STATUS: Record<StatusEmprestimo, string> = {
  em_aberto: 'Em aberto',
  atrasado: 'Atrasado',
  devolvido: 'Devolvido',
  devolvido_com_dano: 'Devolvido com dano',
  cancelado: 'Cancelado',
}

export const ROTULO_SITUACAO: Record<SituacaoItem, string> = {
  emprestado: 'Com o cliente',
  devolvido: 'Devolvida',
  devolvido_com_dano: 'Devolvida com dano',
}

export function numeroEmprestimo(n: number): string {
  return `EMP-${String(n).padStart(4, '0')}`
}

export interface ClienteBusca {
  id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  estado: string | null
}

export interface EmpresaOpcao {
  id: string
  codigo: number
  nome: string
}

export interface EmAbertoPorPeca {
  codigo_produto: number
  quantidade_em_aberto: number
  estoque_showroom: number
}

export interface EmprestimoResumo {
  id: string
  numero: number
  empresa_nome: string
  cliente_nome: string
  data_emprestimo: string
  data_prevista_devolucao: string
  status: StatusEmprestimo
  qtd_pecas: number
  qtd_pecas_em_aberto: number
  valor_total: number
  valor_dano: number
  /** fotos de como as peças saíram da Lucenera */
  fotos_saida: number
  criado_em: string
}

export type MomentoFoto = 'saida' | 'devolucao'

export interface FotoEmprestimo {
  id: string
  /** nulo nas fotos de saída (são do empréstimo todo) */
  item_id: string | null
  momento: MomentoFoto
  path: string
  criado_em: string
  /** link temporário (10 min) */
  url: string | null
}

export interface ClienteSnapshot {
  nome: string
  razao_social: string | null
  cpf_cnpj: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
}

export interface EmpresaTermo {
  id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  inscricao_estadual: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
}

export interface ItemEmprestimo {
  id: string
  codigo_produto: number
  nome: string
  referencia: string | null
  quantidade: number
  valor_unitario: number
  situacao: SituacaoItem
  data_devolucao: string | null
  descricao_dano: string | null
  valor_dano: number | null
  devolvido_registrado_por: string | null
}

export interface EmprestimoDetalhe {
  id: string
  numero: number
  status: StatusEmprestimo
  data_emprestimo: string
  data_prevista_devolucao: string
  observacoes: string | null
  cancelado_em: string | null
  cancelado_motivo: string | null
  criado_por: string | null
  criado_em: string
  cliente: ClienteSnapshot
  empresa: EmpresaTermo
  itens: ItemEmprestimo[]
}

export interface NovoEmprestimoInput {
  empresaId: string
  contatoId: string
  dataPrevista: string
  observacoes: string
  itens: { codigo_produto: number; quantidade: number }[]
}

function erroCred(msg: string): Error {
  return new Error(/senha|usu[aá]rio|28000/i.test(msg) ? 'Usuário ou senha inválidos' : msg)
}

export async function buscarCliente(c: Credencial, termo: string): Promise<ClienteBusca[]> {
  const t = termo.trim()
  if (t.length < 2) return []
  const { data, error } = await db.rpc('showroom_emp_buscar_cliente', {
    p_user: c.user,
    p_senha: c.senha,
    p_termo: t,
  })
  if (error) throw erroCred(error.message)
  return (data ?? []) as ClienteBusca[]
}

export async function listarEmpresas(c: Credencial): Promise<EmpresaOpcao[]> {
  const { data, error } = await db.rpc('showroom_emp_listar_empresas', {
    p_user: c.user,
    p_senha: c.senha,
  })
  if (error) throw erroCred(error.message)
  return (data ?? []) as EmpresaOpcao[]
}

export async function emAbertoPorPeca(c: Credencial, codigos: number[]): Promise<EmAbertoPorPeca[]> {
  if (codigos.length === 0) return []
  const { data, error } = await db.rpc('showroom_emp_em_aberto_por_peca', {
    p_user: c.user,
    p_senha: c.senha,
    p_codigos: codigos,
  })
  if (error) throw erroCred(error.message)
  return (data ?? []) as EmAbertoPorPeca[]
}

export async function criarEmprestimo(
  c: Credencial,
  input: NovoEmprestimoInput,
): Promise<{ id: string; numero: number }> {
  const { data, error } = await db.rpc('showroom_emp_criar', {
    p_user: c.user,
    p_senha: c.senha,
    p_empresa_id: input.empresaId,
    p_contato_id: input.contatoId,
    p_data_prevista: input.dataPrevista,
    p_observacoes: input.observacoes.trim() || null,
    p_itens: input.itens,
  })
  if (error) throw erroCred(error.message)
  return data as { id: string; numero: number }
}

export async function listarEmprestimos(
  c: Credencial,
  status: StatusEmprestimo | null,
  termo: string,
): Promise<EmprestimoResumo[]> {
  const { data, error } = await db.rpc('showroom_emp_listar', {
    p_user: c.user,
    p_senha: c.senha,
    p_status: status,
    p_termo: termo.trim() || null,
  })
  if (error) throw erroCred(error.message)
  return ((data ?? []) as EmprestimoResumo[]).map((r) => ({
    ...r,
    valor_total: Number(r.valor_total) || 0,
    valor_dano: Number(r.valor_dano) || 0,
  }))
}

export async function obterEmprestimo(c: Credencial, id: string): Promise<EmprestimoDetalhe> {
  const { data, error } = await db.rpc('showroom_emp_obter', {
    p_user: c.user,
    p_senha: c.senha,
    p_id: id,
  })
  if (error) throw erroCred(error.message)
  const d = data as EmprestimoDetalhe
  return {
    ...d,
    itens: d.itens.map((i) => ({
      ...i,
      valor_unitario: Number(i.valor_unitario) || 0,
      valor_dano: i.valor_dano == null ? null : Number(i.valor_dano),
    })),
  }
}

/**
 * Libera, compacta e sobe as fotos; devolve os paths já no servidor (ainda não gravados no
 * empréstimo — quem grava é confirmarFotosSaida ou registrarDevolucao).
 */
async function enviarFotos(
  c: Credencial,
  emprestimoId: string,
  momento: MomentoFoto,
  itemId: string | null,
  arquivos: File[],
): Promise<string[]> {
  const blobs = await Promise.all(arquivos.map(compactarFoto))
  const { data, error } = await db.rpc('showroom_emp_liberar_fotos', {
    p_user: c.user,
    p_senha: c.senha,
    p_emprestimo_id: emprestimoId,
    p_momento: momento,
    p_item_id: itemId,
    p_extensoes: blobs.map(() => 'jpg'),
  })
  if (error) throw erroCred(error.message)
  const paths = data as string[]
  for (let i = 0; i < paths.length; i++) {
    const { error: up } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(paths[i], blobs[i], { contentType: 'image/jpeg', upsert: false })
    if (up) throw new Error(`Falha ao enviar a foto ${i + 1}: ${up.message}`)
  }
  return paths
}

export async function adicionarFotosSaida(c: Credencial, emprestimoId: string, arquivos: File[]): Promise<void> {
  const paths = await enviarFotos(c, emprestimoId, 'saida', null, arquivos)
  const { error } = await db.rpc('showroom_emp_confirmar_fotos_saida', {
    p_user: c.user,
    p_senha: c.senha,
    p_emprestimo_id: emprestimoId,
    p_paths: paths,
  })
  if (error) throw erroCred(error.message)
}

/** Fotos do empréstimo com link temporário (10 min) para mostrar na tela e no PDF. */
export async function listarFotos(c: Credencial, emprestimoId: string): Promise<FotoEmprestimo[]> {
  const { data, error } = await db.rpc('showroom_emp_liberar_leitura_fotos', {
    p_user: c.user,
    p_senha: c.senha,
    p_emprestimo_id: emprestimoId,
  })
  if (error) throw erroCred(error.message)
  const fotos = (data ?? []) as Omit<FotoEmprestimo, 'url'>[]
  if (fotos.length === 0) return []
  const { data: urls } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(
    fotos.map((f) => f.path),
    600,
  )
  const porPath = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]))
  return fotos.map((f) => ({ ...f, url: porPath.get(f.path) ?? null }))
}

/** Devolução de uma peça: exige pelo menos 1 foto de como ela voltou. */
export async function registrarDevolucao(
  c: Credencial,
  emprestimoId: string,
  itemId: string,
  fotos: File[],
  comDano: boolean,
  descricaoDano?: string,
  valorDano?: number | null,
): Promise<void> {
  if (fotos.length === 0) throw new Error('Tire pelo menos 1 foto de como a peça voltou.')
  const paths = await enviarFotos(c, emprestimoId, 'devolucao', itemId, fotos)
  const { error } = await db.rpc('showroom_emp_registrar_devolucao', {
    p_user: c.user,
    p_senha: c.senha,
    p_item_id: itemId,
    p_com_dano: comDano,
    p_descricao_dano: comDano ? (descricaoDano ?? '').trim() : null,
    p_valor_dano: comDano ? (valorDano ?? null) : null,
    p_fotos: paths,
  })
  if (error) throw erroCred(error.message)
}

export async function cancelarEmprestimo(c: Credencial, id: string, motivo: string): Promise<void> {
  const { error } = await db.rpc('showroom_emp_cancelar', {
    p_user: c.user,
    p_senha: c.senha,
    p_id: id,
    p_motivo: motivo.trim(),
  })
  if (error) throw erroCred(error.message)
}
