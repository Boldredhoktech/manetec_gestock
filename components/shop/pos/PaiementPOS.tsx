'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatMontant } from '@/lib/utils'
import type { PaiementVente } from '@/actions/ventes'
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Client {
    id: string; nom: string
    advance_balance: number; change_balance: number; credit_balance: number
}

interface Props {
    montantTotal:   number
    devise:         string
    client:         Client | null
    enAttente:      boolean
    erreur?:        string
    onValider:      (
        paiements: PaiementVente[],
        creditAccorde: number,
        advanceUtilise: number,
        changeUtilise: number,
        creditUtilise: number,
        garderMonnaie: boolean,
        montantRecu: number,
        montantRendu: number,
    ) => void
    onRetour:       () => void
}

export default function PaiementPOS({
                                        montantTotal, devise, client,
                                        enAttente, erreur, onValider, onRetour,
                                    }: Props) {
    const [paiements, setPaiements] = useState<PaiementVente[]>([
        { moyen_paiement: 'cash', montant: montantTotal, reference: '' }
    ])
    const [creditAccorde, setCreditAccorde]   = useState(0)
    const [advanceUtilise, setAdvanceUtilise] = useState(0)
    const [changeUtilise, setChangeUtilise]   = useState(0)
    const [garderMonnaie, setGarderMonnaie]   = useState(false)

    const totalPaiements = paiements.reduce((a, p) => a + p.montant, 0)
    const totalSpeciaux  = advanceUtilise + changeUtilise + creditAccorde
    const montantRecu    = totalPaiements
    const resteAPayer    = montantTotal - totalPaiements - advanceUtilise - changeUtilise
    const montantRendu   = Math.max(0, montantRecu - (montantTotal - advanceUtilise - changeUtilise))
    const peutValider    = resteAPayer <= 0.001 || creditAccorde >= resteAPayer

    function ajouterPaiement() {
        setPaiements(prev => [...prev, { moyen_paiement: 'cash', montant: 0, reference: '' }])
    }

    function modifierPaiement(index: number, champ: keyof PaiementVente, valeur: string | number) {
        setPaiements(prev => prev.map((p, i) =>
            i === index ? { ...p, [champ]: valeur } : p
        ))
    }

    function retirerPaiement(index: number) {
        setPaiements(prev => prev.filter((_, i) => i !== index))
    }

    function handleValider() {
        const paiementsFiltres = paiements.filter(p => p.montant > 0)
        onValider(
            paiementsFiltres,
            creditAccorde,
            advanceUtilise,
            changeUtilise,
            0,
            garderMonnaie,
            montantRecu,
            montantRendu,
        )
    }

    return (
        <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-6 space-y-5">

            <button
                type="button"
                onClick={onRetour}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="w-4 h-4" />
                Retour au panier
            </button>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Paiement</h2>

                <div className="flex justify-between text-lg font-bold text-foreground">
                    <span>Total à régler</span>
                    <span>{formatMontant(montantTotal, devise)}</span>
                </div>

                {/* Lignes de paiement */}
                <div className="space-y-2">
                    {paiements.map((p, i) => (
                        <div key={i} className="flex gap-2">
                            <select
                                value={p.moyen_paiement}
                                onChange={e => modifierPaiement(i, 'moyen_paiement', e.target.value)}
                                className="flex-1 px-2 py-2 bg-background border border-input rounded-lg text-xs focus:outline-none"
                            >
                                {MOYENS_PAIEMENT.map(m => (
                                    <option key={m.code} value={m.code}>{m.label}</option>
                                ))}
                            </select>
                            <input
                                type="number" min="0" step="0.01"
                                value={p.montant}
                                onChange={e => modifierPaiement(i, 'montant', parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-2 bg-background border border-input rounded-lg text-xs focus:outline-none"
                            />
                            {MOYENS_PAIEMENT.find(m => m.code === p.moyen_paiement)?.reference_requise && (
                                <input
                                    type="text"
                                    placeholder="Réf."
                                    value={p.reference}
                                    onChange={e => modifierPaiement(i, 'reference', e.target.value)}
                                    className="w-24 px-2 py-2 bg-background border border-input rounded-lg text-xs focus:outline-none"
                                />
                            )}
                            {paiements.length > 1 && (
                                <button type="button" onClick={() => retirerPaiement(i)}
                                        className="text-destructive p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={ajouterPaiement}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un mode de paiement
                </button>

                {/* Soldes client */}
                {client && (
                    <div className="pt-3 border-t border-border space-y-2">
                        <p className="text-xs font-medium text-foreground">
                            Soldes de {client.nom}
                        </p>
                        {client.advance_balance > 0 && (
                            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">
                  Avance ({formatMontant(client.advance_balance, devise)})
                </span>
                                <input
                                    type="number" min="0"
                                    max={Math.min(client.advance_balance, montantTotal)}
                                    step="0.01" value={advanceUtilise}
                                    onChange={e => setAdvanceUtilise(parseFloat(e.target.value) || 0)}
                                    className="w-28 px-2 py-1.5 bg-background border border-input rounded text-xs"
                                />
                            </div>
                        )}
                        {client.change_balance > 0 && (
                            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">
                  Monnaie ({formatMontant(client.change_balance, devise)})
                </span>
                                <input
                                    type="number" min="0"
                                    max={Math.min(client.change_balance, montantTotal)}
                                    step="0.01" value={changeUtilise}
                                    onChange={e => setChangeUtilise(parseFloat(e.target.value) || 0)}
                                    className="w-28 px-2 py-1.5 bg-background border border-input rounded text-xs"
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">
                Accorder un crédit
              </span>
                            <input
                                type="number" min="0" step="0.01"
                                value={creditAccorde}
                                onChange={e => setCreditAccorde(parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1.5 bg-background border border-input rounded text-xs"
                            />
                        </div>
                    </div>
                )}

                {/* Résumé */}
                <div className="pt-3 border-t border-border space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Total paiements</span>
                        <span>{formatMontant(totalPaiements + advanceUtilise + changeUtilise, devise)}</span>
                    </div>
                    {resteAPayer > 0.001 && creditAccorde < resteAPayer && (
                        <div className="flex justify-between text-destructive font-medium">
                            <span>Reste à payer</span>
                            <span>{formatMontant(resteAPayer, devise)}</span>
                        </div>
                    )}
                    {montantRendu > 0.001 && (
                        <div className="flex justify-between text-green-600 font-medium">
                            <span>Monnaie à rendre</span>
                            <span>{formatMontant(montantRendu, devise)}</span>
                        </div>
                    )}
                    {montantRendu > 0.001 && client && (
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input type="checkbox" checked={garderMonnaie}
                                   onChange={e => setGarderMonnaie(e.target.checked)}
                                   className="rounded" />
                            <span className="text-muted-foreground">
                Garder {formatMontant(montantRendu, devise)} en attente pour ce client
              </span>
                        </label>
                    )}
                </div>

                {erreur && (
                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {erreur}
                    </div>
                )}

                <Button
                    onClick={handleValider}
                    disabled={!peutValider || enAttente}
                    className="w-full"
                >
                    {enAttente
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                        : 'Confirmer la vente'
                    }
                </Button>
            </div>
        </div>
    )
}