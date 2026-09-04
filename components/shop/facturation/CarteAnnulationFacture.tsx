'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { annulerFacture } from '@/actions/facturation'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Ban, Info } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

// Une facture émise par erreur restait due pour toujours : le statut
// `annulee` était prévu, l'interface le gérait, et rien ne le posait.
export default function CarteAnnulationFacture({
    factureId, statut, montantPaye, annuleLe, motifAnnulation, peutAnnuler,
}: {
    factureId:       string
    statut:          string
    montantPaye:     number
    annuleLe:        string | null
    motifAnnulation: string | null
    peutAnnuler:     boolean
}) {
    const router = useRouter()

    const [ouvert, setOuvert]       = useState(false)
    const [motif, setMotif]         = useState('')
    const [erreur, setErreur]       = useState('')
    const [enAttente, setEnAttente] = useState(false)

    if (statut === 'annulee') {
        return (
            <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-3 text-sm">
                    <Ban className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                        <p className="font-medium text-foreground">
                            Facture annulée{annuleLe ? ` le ${formatDate(annuleLe)}` : ''}
                        </p>
                        {motifAnnulation && (
                            <p className="text-muted-foreground mt-0.5">« {motifAnnulation} »</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            Elle reste consultable et conserve son numéro, mais ne compte plus
                            parmi les sommes dues.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (!peutAnnuler) return null

    // Une facture déjà encaissée ne s'annule pas d'un trait : l'argent est
    // entré. Le serveur le refuse ; on le dit ici plutôt que de laisser
    // l'utilisateur découvrir l'erreur après coup.
    const dejaEncaissee = montantPaye > 0

    async function confirmer() {
        setEnAttente(true)
        setErreur('')

        const res = await annulerFacture(factureId, motif)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setOuvert(false)
        setMotif('')
        router.refresh()
    }

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Ban className="w-4 h-4 text-muted-foreground" />
                Annuler la facture
            </h2>

            {erreur && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{erreur}</span>
                </div>
            )}

            {dejaEncaissee ? (
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                        Cette facture a déjà reçu {formatMontant(montantPaye)} de règlements :
                        elle ne peut pas être annulée telle quelle. Annulez d&apos;abord les
                        règlements, ce qui laisse une trace, ou émettez un avoir.
                    </span>
                </p>
            ) : !ouvert ? (
                <>
                    <p className="text-xs text-muted-foreground">
                        Une facture annulée garde son numéro et reste consultable, mais sort des
                        sommes dues et du rapport des impayés. À réserver aux factures émises
                        par erreur.
                    </p>
                    <Button type="button" variant="outline" size="sm"
                            onClick={() => setOuvert(true)}>
                        Annuler cette facture
                    </Button>
                </>
            ) : (
                <div className="space-y-3">
                    <label htmlFor="motif-annul" className="text-sm font-medium text-foreground block">
                        Pourquoi cette facture est-elle annulée ?
                    </label>
                    <input
                        id="motif-annul"
                        type="text"
                        value={motif}
                        onChange={e => setMotif(e.target.value)}
                        placeholder="Ex : émise en double le même jour"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1"
                                disabled={enAttente}
                                onClick={() => { setOuvert(false); setMotif(''); setErreur('') }}>
                            Retour
                        </Button>
                        <Button type="button" variant="destructive" className="flex-1"
                                disabled={enAttente} onClick={confirmer}>
                            {enAttente
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : 'Confirmer l’annulation'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
