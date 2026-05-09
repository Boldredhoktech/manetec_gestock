'use client'

import { useActionState } from 'react'
import { creerAvoir } from '@/actions/facturation'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

interface Avoir {
    id: string; public_id: string; motif: string
    montant: number; created_at: string; est_applique: boolean
}

interface Props { factureId: string; avoirs: Avoir[] }
interface EtatAction { erreur?: string; succes?: boolean }

export default function CarteAvoir({ factureId, avoirs }: Props) {
    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            const res = await creerAvoir(formData)
            if (res?.erreur) return { erreur: res.erreur }
            return { succes: true }
        },
        {}
    )

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Avoirs
            </h2>

            {/* Avoirs existants */}
            {avoirs.length > 0 && (
                <div className="space-y-2">
                    {avoirs.map(a => (
                        <div key={a.id}
                             className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                            <div>
                                <p className="font-mono font-medium text-foreground">{a.public_id}</p>
                                <p className="text-muted-foreground mt-0.5">{a.motif}</p>
                                <p className="text-muted-foreground">{formatDate(a.created_at)}</p>
                            </div>
                            <p className="font-semibold text-foreground">{formatMontant(a.montant)}</p>
                        </div>
                    ))}
                </div>
            )}

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
                    Avoir créé avec succès.
                </div>
            )}

            {/* Formulaire */}
            <form action={action} className="space-y-3">
                <input type="hidden" name="factureId" value={factureId} />

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Montant</label>
                        <input name="montant" type="number" min="0.01" step="0.01"
                               required disabled={enAttente}
                               className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Motif</label>
                        <input name="motif" type="text" required disabled={enAttente}
                               placeholder="Raison de l'avoir"
                               className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>

                <Button type="submit" variant="outline" size="sm"
                        disabled={enAttente} className="w-full">
                    {enAttente
                        ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Création...</>
                        : 'Émettre un avoir'
                    }
                </Button>
            </form>
        </div>
    )
}