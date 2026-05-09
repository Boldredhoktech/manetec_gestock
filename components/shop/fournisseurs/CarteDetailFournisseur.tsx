import { Phone, Mail, MapPin } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Props {
    fournisseur: {
        nom: string; nom_contact: string | null
        telephone: string | null; email: string | null
        adresse: string | null; ville: string | null
        ifu: string | null; rccm: string | null
        solde_dû: number
    }
}

export default function CarteDetailFournisseur({ fournisseur }: Props) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Informations</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {fournisseur.nom_contact && (
                    <div>
                        <p className="text-xs text-muted-foreground">Contact</p>
                        <p className="font-medium text-foreground">{fournisseur.nom_contact}</p>
                    </div>
                )}
                {fournisseur.telephone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{fournisseur.telephone}</span>
                    </div>
                )}
                {fournisseur.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span>{fournisseur.email}</span>
                    </div>
                )}
                {(fournisseur.ville || fournisseur.adresse) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>{[fournisseur.adresse, fournisseur.ville].filter(Boolean).join(', ')}</span>
                    </div>
                )}
            </div>

            {(fournisseur.ifu || fournisseur.rccm) && (
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-t border-border pt-3">
                    {fournisseur.ifu && <span>IFU : {fournisseur.ifu}</span>}
                    {fournisseur.rccm && <span>RCCM : {fournisseur.rccm}</span>}
                </div>
            )}

            <div className="flex justify-between items-center border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Solde dû</span>
                <span className={`text-sm font-bold ${fournisseur.solde_dû > 0 ? 'text-destructive' : 'text-green-600'}`}>
          {fournisseur.solde_dû > 0 ? formatMontant(fournisseur.solde_dû) : 'Soldé'}
        </span>
            </div>
        </div>
    )
}