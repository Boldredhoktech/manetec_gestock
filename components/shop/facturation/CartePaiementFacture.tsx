'use client'

import { useActionState } from 'react'
import { payerFacture } from '@/actions/facturation'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle, CreditCard } from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Props {
    facture: { id: string; montant_restant: number; montant_ttc: number }
}

interface EtatAction { erreur?: string; succes?: boolean }

export default function CartePaiementFacture({ facture }: Props) {
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

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Montant</label>
                        <input name="montant" type="number" min="0.01" step="0.01"
                               defaultValue={facture.montant_restant}
                               required disabled={enAttente}
                               className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Moyen de paiement</label>
                        <select name="moyen" disabled={enAttente}
                                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            {MOYENS_PAIEMENT.map(m => (
                                <option key={m.code} value={m.code}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <input name="reference" type="text" placeholder="Référence (optionnel)"
                           disabled={enAttente}
                           className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    <input name="note" type="text" placeholder="Note (optionnel)"
                           disabled={enAttente}
                           className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>

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