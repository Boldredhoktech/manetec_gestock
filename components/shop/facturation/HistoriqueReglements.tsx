'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { modifierPaiementFacture, annulerPaiementFacture } from '@/actions/facturation'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import ChampsReglement from '@/components/shop/compta/ChampsReglement'
import { Loader2, AlertCircle, Pencil, Ban, CreditCard } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

// Un règlement encaissé était définitif : un montant saisi de travers
// faussait à la fois le solde de la facture et les entrées du tableau de
// bord, sans recours. Il se corrige et s'annule maintenant, et le
// montant payé de la facture est recalculé par la base.
export interface Reglement {
    id:               string
    public_id:        string
    montant:          number
    moyen_paiement:   string
    reference:        string | null
    date_paiement:    string
    est_annule:       boolean
    motif_annulation: string | null
    modifie_le:       string | null
}

export default function HistoriqueReglements({
    factureId, reglements, peutCorriger,
}: {
    factureId:    string
    reglements:   Reglement[]
    peutCorriger: boolean
}) {
    const router = useRouter()

    const [edite, setEdite]         = useState<string | null>(null)
    const [annule, setAnnule]       = useState<string | null>(null)
    const [motif, setMotif]         = useState('')
    const [erreur, setErreur]       = useState('')
    const [enAttente, setEnAttente] = useState<string | null>(null)

    const aujourdhui = new Date().toISOString().split('T')[0]

    const actifs = reglements.filter(r => !r.est_annule)
    const total  = actifs.reduce((somme, r) => somme + r.montant, 0)

    async function corriger(e: React.FormEvent<HTMLFormElement>, id: string) {
        e.preventDefault()
        setEnAttente(id)
        setErreur('')

        const formData = new FormData(e.currentTarget)
        formData.set('paiementId', id)
        formData.set('factureId', factureId)

        const res = await modifierPaiementFacture(formData)
        setEnAttente(null)

        if (res?.erreur) { setErreur(res.erreur); return }
        setEdite(null)
        router.refresh()
    }

    async function confirmerAnnulation(id: string) {
        setEnAttente(id)
        setErreur('')

        const res = await annulerPaiementFacture(id, motif, factureId)
        setEnAttente(null)

        if (res?.erreur) { setErreur(res.erreur); return }
        setAnnule(null)
        setMotif('')
        router.refresh()
    }

    if (reglements.length === 0) {
        return (
            <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    Règlements reçus
                </h2>
                <p className="text-xs text-muted-foreground mt-2">
                    Aucun règlement enregistré sur cette facture.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    Règlements reçus
                </h2>
                <span className="text-sm font-bold text-green-600 tabular-nums">
                    {formatMontant(total)}
                </span>
            </div>

            {erreur && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{erreur}</span>
                </div>
            )}

            <ul className="divide-y divide-border">
                {reglements.map(r => (
                    <li key={r.id} className="py-2.5 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className={`text-sm font-medium ${
                                    r.est_annule ? 'text-muted-foreground line-through' : 'text-foreground'
                                }`}>
                                    {formatMontant(r.montant)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {MOYENS_PAIEMENT.find(m => m.code === r.moyen_paiement)?.label ?? r.moyen_paiement}
                                    {' · '}{formatDate(r.date_paiement)}
                                    {r.reference ? ` · ${r.reference}` : ''}
                                </p>
                                <p className="text-xs font-mono text-muted-foreground">
                                    {r.public_id}
                                    {r.modifie_le && !r.est_annule && (
                                        <span className="font-sans"> · corrigé le {formatDate(r.modifie_le)}</span>
                                    )}
                                </p>
                                {r.est_annule && (
                                    <p className="text-xs text-destructive mt-0.5">
                                        Annulé{r.motif_annulation ? ` — « ${r.motif_annulation} »` : ''}
                                    </p>
                                )}
                            </div>

                            {peutCorriger && !r.est_annule && (
                                <div className="flex gap-1 shrink-0">
                                    <button type="button"
                                            aria-label={`Corriger le règlement ${r.public_id}`}
                                            onClick={() => {
                                                setEdite(edite === r.id ? null : r.id)
                                                setAnnule(null); setErreur('')
                                            }}
                                            className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button type="button"
                                            aria-label={`Annuler le règlement ${r.public_id}`}
                                            onClick={() => {
                                                setAnnule(annule === r.id ? null : r.id)
                                                setEdite(null); setMotif(''); setErreur('')
                                            }}
                                            className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                                        <Ban className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {edite === r.id && (
                            <form onSubmit={e => corriger(e, r.id)}
                                  className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Montant</label>
                                        <MontantReglement valeur={r.montant} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Date du règlement</label>
                                        <input name="datePaiement" type="date" required
                                               defaultValue={r.date_paiement} max={aujourdhui}
                                               className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs" />
                                    </div>
                                </div>

                                <ChampsReglement
                                    compact
                                    moyenParDefaut={r.moyen_paiement}
                                    referenceParDefaut={r.reference ?? ''}
                                />

                                <div className="flex gap-2 pt-1">
                                    <Button type="button" variant="outline" size="sm" className="flex-1"
                                            onClick={() => setEdite(null)}>
                                        Retour
                                    </Button>
                                    <Button type="submit" size="sm" className="flex-1"
                                            disabled={enAttente === r.id}>
                                        {enAttente === r.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : 'Corriger'}
                                    </Button>
                                </div>
                            </form>
                        )}

                        {annule === r.id && (
                            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                                <input
                                    type="text"
                                    value={motif}
                                    onChange={e => setMotif(e.target.value)}
                                    placeholder="Pourquoi ce règlement est-il annulé ?"
                                    className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Le règlement restera visible, barré, et le reste à payer de la
                                    facture sera recalculé.
                                </p>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" className="flex-1"
                                            onClick={() => { setAnnule(null); setMotif('') }}>
                                        Retour
                                    </Button>
                                    <Button type="button" variant="destructive" size="sm" className="flex-1"
                                            disabled={enAttente === r.id}
                                            onClick={() => confirmerAnnulation(r.id)}>
                                        {enAttente === r.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : 'Annuler'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}

// ChampNombre garde son propre état : il lui faut un composant.
function MontantReglement({ valeur }: { valeur: number }) {
    const [montant, setMontant] = useState(valeur)
    return (
        <ChampNombre
            name="montant" value={montant} onChange={setMontant} required
            className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs"
        />
    )
}
