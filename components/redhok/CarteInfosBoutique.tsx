import { Store, Phone, Mail, MapPin, Users } from 'lucide-react'
import BadgePlan from '@/components/redhok/BadgePlan'
import { formatDate } from '@/lib/utils'

interface Props {
    boutique: {
        nom: string
        public_id: string
        pays: string
        ville: string | null
        adresse: string | null
        telephone_1: string
        telephone_2: string | null
        email: string | null
        devise: string
        plan: string
        est_active: boolean
        created_at: string
        note_activation: string | null
    }
    nbUtilisateurs: number
}

export default function CarteInfosBoutique({ boutique, nbUtilisateurs }: Props) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    Informations générales
                </h2>
                <BadgePlan plan={boutique.plan} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
            {[boutique.adresse, boutique.ville, boutique.pays]
                .filter(Boolean)
                .join(', ')}
          </span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{boutique.telephone_1}</span>
                    {boutique.telephone_2 && (
                        <span className="text-xs">/ {boutique.telephone_2}</span>
                    )}
                </div>

                {boutique.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span>{boutique.email}</span>
                    </div>
                )}

                <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>{nbUtilisateurs} utilisateur(s)</span>
                </div>
            </div>

            {(() => {
                try {
                    const creds = boutique.note_activation
                        ? JSON.parse(boutique.note_activation)
                        : null
                    if (!creds?.identifiant) return null
                    return (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                            <p className="text-xs font-semibold text-amber-800">
                                🔑 Credentials premier accès — à communiquer au propriétaire
                            </p>
                            <p className="text-xs text-amber-700 font-mono">
                                ID Boutique : {creds.shop_public_id}
                            </p>
                            <p className="text-xs text-amber-700 font-mono">
                                Identifiant : {creds.identifiant}
                            </p>
                            <p className="text-xs text-amber-700 font-mono">
                                Mot de passe : {creds.mot_de_passe}
                            </p>
                        </div>
                    )
                } catch { return null }
            })()}

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Devise : <strong className="text-foreground">{boutique.devise}</strong></span>
                <span>Créée le {formatDate(boutique.created_at)}</span>
            </div>
        </div>
    )
}