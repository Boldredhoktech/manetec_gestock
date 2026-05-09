import { Phone, Mail, MapPin, FileText } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Props {
    client: {
        nom: string
        telephone: string | null
        email: string | null
        adresse: string | null
        notes: string | null
        est_actif: boolean
        created_at: string
    }
}

export default function CarteDetailClient({ client }: Props) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
                Informations générales
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {client.telephone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{client.telephone}</span>
                    </div>
                )}
                {client.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span>{client.email}</span>
                    </div>
                )}
                {client.adresse && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>{client.adresse}</span>
                    </div>
                )}
                {client.notes && (
                    <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                        <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{client.notes}</span>
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Client depuis le {formatDate(client.created_at)}
            </p>
        </div>
    )
}