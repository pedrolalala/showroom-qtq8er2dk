const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Preco de venda do produto (SPEC-125). Mostra `valor_venda`; quando 0/ausente
 * (produto sem preco cadastrado ou peca sem vinculo), mostra "Sob consulta".
 */
export function formatarPreco(valor: number | null | undefined): string {
  const n = Number(valor) || 0
  return n > 0 ? BRL.format(n) : 'Sob consulta'
}

export function formatarQuantidade(qtd: number | null | undefined): string {
  const n = Math.max(0, Math.trunc(Number(qtd) || 0))
  if (n <= 0) return 'Disponível'
  return n === 1 ? '1 disponível' : `${n} disponíveis`
}
