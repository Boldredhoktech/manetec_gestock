'use client'

import { useActionState } from 'react'
import { creerAvoir } from '@/actions/facturation'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle, RotateCcw, Info } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import ChampNombre from '@/components/ui/ChampNombre'
import { useState } from 'react'

interface Avoir {
    id: string; public_id: string; motif: string
    montant: number; created_at: string; est_applique: boolean
    montant_deduit: number; montant_avance: number
}

interface Props {
    factureId:   string
    avoirs:      Avoir[]
    resteAPayer: number
    montantTtc:  number
    aUnClient:   boolean
}
interface EtatAction { erreur?: string; succes?: boolean; detail?: string }

export default function CarteAvoir({
    factureId, avoirs, resteAPayer, montantTtc, aUnClient,
}: Props) {
    const [montant, setMontant] = useState(0)

    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            const res = await creerAvoir(formData)
            if (res?.erreur) return { erreur: res.erreur }
            return { succes: true, detail: res?.detail }
        },
        {}
    )

    // Un avoir ne peut pas dépasser ce que la facture a facturé, avoirs
    // déjà émis déduits.
    const dejaAvoir = avoirs.reduce((somme, a) => somme + a.montant, 0)
    const couvrable = montantTtc - dejaAvoir

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
                                {a.montant_avance > 0 && (
                                    <p className="text-muted-foreground mt-0.5">
                                        {a.montant_deduit > 0
                                            ? `${formatMontant(a.montant_deduit)} déduits · ${formatMontant(a.montant_avance)} en avance client`
                                            : `${formatMontant(a.montant_avance)} portés à l'avance du client`}
                                    </p>
                                )}
                            </div>
                            <p className="font-semibold text-foreground shrink-0">{formatMontant(a.montant)}</p>
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
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Avoir créé. {etat.detail}</span>
                </div>
            )}

            {/* Formulaire */}
            <form action={action} className="space-y-3">
                <input type="hidden" name="factureId" value={factureId} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Montant</label>
                        <ChampNombre
                            name="montant" value={montant} onChange={setMontant}
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

                <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                        {resteAPayer > 0
                            ? `L'avoir vient en déduction du reste à payer (${formatMontant(resteAPayer)}).`
                            : 'Cette facture est réglée : l\'avoir sera porté à l\'avance du client, réutilisable sur un prochain achat.'}
                        {' '}Maximum possible : {formatMontant(couvrable)}.
                        {!aUnClient && resteAPayer <= 0 && ' Cette facture n\'a pas de client : aucun avoir ne peut y être porté.'}
                    </span>
                </p>

                <Button type="submit" variant="outline" size="sm"
                        disabled={enAttente || couvrable <= 0 || (!aUnClient && resteAPayer <= 0)}
                        className="w-full">
                    {enAttente
                        ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Création...</>
                        : 'Émettre un avoir'
                    }
                </Button>
            </form>
        </div>
    )
}