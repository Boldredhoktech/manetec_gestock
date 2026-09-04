'use client'

import { useActionState, useState } from 'react'
import { payerFacture } from '@/actions/facturation'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import ChampsReglement from '@/components/shop/compta/ChampsReglement'
import { Loader2, AlertCircle, CheckCircle, CreditCard } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Props {
    facture: { id: string; montant_restant: number; montant_ttc: number }
}

interface EtatAction { erreur?: string; succes?: boolean }

export default function CartePaiementFacture({ facture }: Props) {
    const [montant, setMontant] = useState(facture.montant_restant)
    const aujourdhui = new Date().toISOString().split('T')[0]

    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            const res = await payerFacture(formData)
            if (res?.erreur) return { erreur: res.erreur }
            return { succes: true }
        },
        {}
    )

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Enregistrer un paiement
            </h2>

            <p className="text-sm text-muted-foreground">
                Reste à payer : <strong className="text-destructive">
                {formatMontant(facture.montant_restant)}
            </strong>
            </p>

            {etat.erreur && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {etat.erreur}
                </div>
            )}
            {etat.succes && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    Paiement enregistré avec succès.
                </div>
            )}

            <form action={action} className="space-y-3">
                <input type="hidden" name="factureId" value={facture.id} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Montant</label>
                        <ChampNombre
                            name="montant" value={montant} onChange={setMontant}
                            required disabled={enAttente}
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Date du règlement
                        </label>
                        <input name="datePaiement" type="date" required
                               defaultValue={aujourdhui} max={aujourdhui}
                               disabled={enAttente}
                               className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                        <p className="text-xs text-muted-foreground">
                            La date où l&apos;argent a été reçu, pas celle de la saisie.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ChampsReglement disabled={enAttente} />
                </div>

                {/* La référence est portée par ChampsReglement, qui ne
                    l'affiche que pour les moyens qui l'exigent et la rend
                    alors obligatoire. Un second champ du même nom aurait
                    envoyé deux valeurs. */}
                <input name="note" type="text" placeholder="Note (facultative)"
                       disabled={enAttente}
                       className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />

                <Button type="submit" variant="outline" size="sm"
                        disabled={enAttente} className="w-full">
                    {enAttente
                        ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Traitement...</>
                        : 'Confirmer le paiement'
                    }
                </Button>
            </form>
        </div>
    )
}