import { Badge } from '@/components/ui/badge'
import { ROTULO_STATUS, type StatusEmprestimo } from '@/services/emprestimos'

const CORES: Record<StatusEmprestimo, string> = {
  em_aberto: 'bg-amber-500 text-white hover:bg-amber-500',
  atrasado: 'bg-destructive text-destructive-foreground hover:bg-destructive',
  devolvido: 'bg-emerald-600 text-white hover:bg-emerald-600',
  devolvido_com_dano: 'bg-orange-700 text-white hover:bg-orange-700',
  cancelado: 'bg-muted text-muted-foreground hover:bg-muted',
}

export function StatusEmprestimoBadge({ status }: { status: StatusEmprestimo }) {
  return <Badge className={CORES[status]}>{ROTULO_STATUS[status]}</Badge>
}
