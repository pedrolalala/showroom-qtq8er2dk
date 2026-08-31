/**
 * Dados de contato do showroom exibidos no site publico.
 * TODO(SPEC-125 P-2): substituir pelos dados oficiais da Lucenera antes de publicar.
 */
export const CONTATO = {
  whatsapp: '5516999999999', // so digitos, com DDI+DDD
  telefoneExibicao: '(16) 99999-9999',
  email: 'showroom@lucenera.com.br',
  endereco: 'Rua Exemplo, 000 - Bairro - Ribeirão Preto/SP',
  horario: 'Segunda a sexta, 9h às 18h',
  mapaUrl: '',
}

export function linkWhatsApp(mensagem: string): string {
  return `https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(mensagem)}`
}
