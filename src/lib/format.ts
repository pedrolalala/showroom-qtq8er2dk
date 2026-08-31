const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Preco de venda do produto. Regra SPEC-125: mostrar sempre o valor_venda;
 * se for 0 (nao cadastrado), exibir "R$ 0,00" mesmo — e o sinal de que
 * alguem precisa cadastrar o preco em Peças/Produtos.
 */
export function formatarPreco(valor: number | null | undefined): string {
  return BRL.format(Number(valor) || 0)
}

export function formatarQuantidade(qtd: number | null | undefined): string {
  const n = Math.max(0, Math.trunc(Number(qtd) || 0))
  return n === 1 ? '1 disponível' : `${n} disponíveis`
}
