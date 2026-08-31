import { Link } from 'react-router-dom'
import { MapPin, Clock, Phone, Mail, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CONTATO, linkWhatsApp } from '@/lib/contato'

export default function Showroom() {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Visite o showroom</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Venha ver de perto as peças disponíveis para pronta entrega.
      </p>

      <dl className="mt-8 space-y-5">
        <div className="flex gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <dt className="text-sm font-semibold">Endereço</dt>
            <dd className="text-sm text-muted-foreground">{CONTATO.endereco}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <dt className="text-sm font-semibold">Horário</dt>
            <dd className="text-sm text-muted-foreground">{CONTATO.horario}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <dt className="text-sm font-semibold">Telefone</dt>
            <dd className="text-sm text-muted-foreground">{CONTATO.telefoneExibicao}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <dt className="text-sm font-semibold">E-mail</dt>
            <dd className="text-sm text-muted-foreground">{CONTATO.email}</dd>
          </div>
        </div>
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="sm:flex-1">
          <a
            href={linkWhatsApp('Olá! Gostaria de visitar o showroom Lucenera.')}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Falar no WhatsApp
          </a>
        </Button>
        <Button asChild size="lg" variant="outline" className="sm:flex-1">
          <Link to="/">Ver a vitrine</Link>
        </Button>
      </div>
    </div>
  )
}
