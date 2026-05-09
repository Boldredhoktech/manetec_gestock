'use client'

import { useActionState } from 'react'
import { operationSoldeClient } from '@/actions/clients'
import { Button } from '@/components/ui/button'
import { formatMontant } from '@/lib/utils'
import { Loader2, AlertCircle, CheckCircle, Wallet } from 'lucide-react'

interface Props {
    client: {
        id: string
        est_anonyme: boolean
        credit_balance: number
        advance_balance: number
        change_balance: number
    }
}

interface EtatAction { erreur?: string; succes?: boolean }

export default function CarteSoldesClient({ client }: Props) {
    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            const res = await operationSoldeClient(formData)
            if (res?.erreur) return { erreur: res.erreur }
            return { succes: true }
        },
        {}
    )

    if (client.est_anonyme) return null

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Soldes
            </h2>

            {/* Soldes actuels */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Crédit dû</p>
                    <p className={`text-sm font-bold ${client.credit_balance > 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {formatMontant(client.credit_balance)}
                    </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Avance</p>
                    <p className={`text-sm font-bold ${client.advance_balance > 0 ? 'text-green-600' : 'text-foreground'}`}>
                        {formatMontant(client.advance_balance)}
                    </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Monnaie</p>
                    <p className={`text-sm font-bold ${client.change_balance > 0 ? 'text-blue-600' : 'text-foreground'}`}>
                        {formatMontant(client.change_balance)}
                    </p>
                </div>
            </div>

            {/* Messages */}
            {etat.erreur && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {etat.erreur}
                </div>
            )}
            {etat.succes && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    Opération enregistrée avec succès.
                </div>
            )}

            {/* Formulaire opération */}
            <form action={action} className="space-y-3">
                <input type="hidden" name="clientId" value={client.id} />

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Type d'opération
                        </label>
                        <select name="typeOperation" disabled={enAttente}
                                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            <option value="credit_remboursement">Rembourser crédit</option>
                            <option value="advance_depot">Déposer avance</option>
                            <option value="advance_utilisation">Utiliser avance</option>
                            <option value="change_depot">Déposer monnaie</option>
                            <option value="change_utilisation">Utiliser monnaie</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Montant</label>
                        <input name="montant" type="number" min="0.01" step="0.01"
                               required disabled={enAttente}
                               placeholder="0.00"
                               className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>

                <input name="note" type="text" placeholder="Note optionnelle"
                       disabled={enAttente}
                       className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />

                <Button type="submit" size="sm" variant="outline"
                        disabled={enAttente} className="w-full">
                    {enAttente
                        ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Traitement...</>
                        : 'Enregistrer l\'opération'
                    }
                </Button>
            </form>
        </div>
    )
}