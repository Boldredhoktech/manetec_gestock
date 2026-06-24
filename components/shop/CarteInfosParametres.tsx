import BadgePlan from '@/components/redhok/BadgePlan'
import { formatDate } from '@/lib/utils'
import { Store, Phone, Mail, Globe, FileText, Hash } from 'lucide-react'

interface Props {
    boutique: {
        public_id: string
        nom: string
        pays: string
        ville: string | null
        adresse: string | null
        telephone_1: string
        telephone_2: string | null
        email: string | null
        site_web: string | null
        ifu: string | null
        rccm: string | null
        devise: string
        remise_max_pct: number
        plan: string
        plan_expire_le: string | null
        created_at: string
    }
}

export default function CarteInfosParametres({ boutique }: Props) {
    return (
        <div className="space-y-5">

            {/* Identité */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Store className="w-4 h-4" />
                        Identité de la boutique
                    </h2>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
            {boutique.public_id}
          </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Nom</p>
                        <p className="font-medium text-foreground">{boutique.nom}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Devise</p>
                        <p className="font-medium text-foreground">{boutique.devise}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Pays</p>
                        <p className="font-medium text-foreground">{boutique.pays}</p>
                    </div>
                    {boutique.ville && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Ville</p>
                            <p className="font-medium text-foreground">{boutique.ville}</p>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{boutique.telephone_1}</span>
                    </div>
                    {boutique.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span>{boutique.email}</span>
                        </div>
                    )}
                    {boutique.site_web && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span>{boutique.site_web}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Informations légales */}
            {(boutique.ifu || boutique.rccm) && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Informations légales
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {boutique.ifu && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-0.5">IFU</p>
                                <p className="font-mono font-medium text-foreground">{boutique.ifu}</p>
                            </div>
                        )}
                        {boutique.rccm && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-0.5">RCCM</p>
                                <p className="font-mono font-medium text-foreground">{boutique.rccm}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Abonnement */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Abonnement
                </h2>
                <div className="flex items-center justify-between">
                    <BadgePlan plan={boutique.plan} />
                    <span className="text-xs text-muted-foreground">
            Expire le {boutique.plan_expire_le
                        ? formatDate(boutique.plan_expire_le)
                        : '—'}
          </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Remise maximale autorisée : <strong>{boutique.remise_max_pct}%</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                    Boutique créée le {formatDate(boutique.created_at)}
                </p>
            </div>

        </div>
    )
}