'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { modifierDepense, annulerDepense } from '@/actions/comptabilite'
import { formatDate, formatMontant } from '@/lib/utils'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Ban, Pencil, CheckCircle } from 'lucide-react'
import HistoriqueCorrections, { type EntreeHistorique } from './HistoriqueCorrections'

interface Depense {
    id:               string
    public_id:        string
    libelle:          string
    montant:          number
    moyen_paiement:   string
    category_id:      string | null
    date_depense:     string
    note:             string | null
    reference:        string | null
    created_at:       string
    est_annule:       boolean
    annule_le:        string | null
    motif_annulation: string | null
    modifie_le:       string | null
}

interface Props {
    depense:      Depense
    categories:   { id: string; nom: string; est_actif: boolean }[]
    historique:   EntreeHistorique[]
    peutModifier: boolean
}

export default function FicheDepense({ depense, categories, historique, peutModifier }: Props) {
    const router = useRouter()

    const [mode, setMode]           = useState<'lecture' | 'edition' | 'annulation'>('lecture')
    const [erreur, setErreur]       = useState('')
    const [message, setMessage]     = useState('')
    const [enAttente, setEnAttente] = useState(false)
    const [motif, setMotif]         = useState('')

    const aujourdhui = new Date().toISOString().split('T')[0]

    async function enregistrer(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setEnAttente(true)
        setErreur('')
        setMessage('')

        const formData = new FormData(e.currentTarget)
        formData.set('id', depense.id)

        const res = await modifierDepense(formData)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setMode('lecture')
        setMessage(res?.aucunChangement ? 'Aucune modification à enregistrer.' : 'Dépense modifiée.')
        router.refresh()
    }

    async function annuler() {
        setEnAttente(true)
        setErreur('')

        const res = await annulerDepense(depense.id, motif)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setMode('lecture')
        setMotif('')
        setMessage('Dépense annulée : elle est retirée de tous les totaux.')
        router.refresh()
    }

    const moyenLabel = MOYENS_PAIEMENT.find(m => m.code === depense.moyen_paiement)?.label
        ?? depense.moyen_paiement
    const categorieNom = categories.find(c => c.id === depense.category_id)?.nom ?? null

    return (
        <div className="space-y-5">

            {depense.est_annule && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <Ban className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium">
                            Dépense annulée{depense.annule_le ? ` le ${formatDate(depense.annule_le)}` : ''}
                        </p>
                        {depense.motif_annulation && (
                            <p className="mt-0.5 opacity-90">« {depense.motif_annulation} »</p>
                        )}
                        <p className="mt-1 text-xs opacity-80">
                            Elle reste consultable mais ne compte plus dans le tableau de bord
                            ni dans les rapports.
                        </p>
                    </div>
                </div>
            )}

            {message && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    {message}
                </div>
            )}

            {erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{erreur}</span>
                </div>
            )}

            {mode === 'edition' ? (
                <form onSubmit={enregistrer} className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-foreground">Modifier la dépense</h2>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Libellé <span className="text-destructive">*</span>
                        </label>
                        <input name="libelle" type="text" required defaultValue={depense.libelle}
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                Montant <span className="text-destructive">*</span>
                            </label>
                            <input name="montant" type="number" min="0.01" step="0.01" required
                                   defaultValue={depense.montant} disabled={enAttente}
                                   className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">Date</label>
                            <input name="dateDepense" type="date" required
                                   defaultValue={depense.date_depense} max={aujourdhui}
                                   disabled={enAttente}
                                   className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">Catégorie</label>
                            <select name="categoryId" defaultValue={depense.category_id ?? ''}
                                    disabled={enAttente}
                                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                                <option value="">— Aucune —</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.nom}{c.est_actif ? '' : ' (retirée)'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">Moyen de paiement</label>
                            <select name="moyen" defaultValue={depense.moyen_paiement}
                                    disabled={enAttente}
                                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                                {MOYENS_PAIEMENT.map(m => (
                                    <option key={m.code} value={m.code}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Note</label>
                        <input name="note" type="text" defaultValue={depense.note ?? ''}
                               placeholder="Note optionnelle" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>

                    <p className="text-xs text-muted-foreground">
                        L&apos;ancienne valeur de chaque champ modifié sera conservée dans
                        l&apos;historique, avec votre nom et la date.
                    </p>

                    <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1"
                                disabled={enAttente} onClick={() => setMode('lecture')}>
                            Annuler
                        </Button>
                        <Button type="submit" className="flex-1" disabled={enAttente}>
                            {enAttente
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</>
                                : 'Enregistrer'
                            }
                        </Button>
                    </div>
                </form>
            ) : (
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs text-muted-foreground">Montant</p>
                            <p className={`text-2xl font-bold tabular-nums ${
                                depense.est_annule ? 'text-muted-foreground line-through' : 'text-destructive'
                            }`}>
                                {formatMontant(depense.montant)}
                            </p>
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-t border-border pt-4">
                        <div>
                            <dt className="text-xs text-muted-foreground">Date</dt>
                            <dd className="text-foreground">{formatDate(depense.date_depense)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Moyen</dt>
                            <dd className="text-foreground">{moyenLabel}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Catégorie</dt>
                            <dd className="text-foreground">{categorieNom ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Référence</dt>
                            <dd className="text-foreground">{depense.reference ?? '—'}</dd>
                        </div>
                        {depense.note && (
                            <div className="col-span-2">
                                <dt className="text-xs text-muted-foreground">Note</dt>
                                <dd className="text-foreground">{depense.note}</dd>
                            </div>
                        )}
                        <div className="col-span-2 text-xs text-muted-foreground">
                            Saisie le {formatDate(depense.created_at)}
                            {depense.modifie_le && ` · modifiée le ${formatDate(depense.modifie_le)}`}
                        </div>
                    </dl>

                    {peutModifier && !depense.est_annule && (
                        mode === 'annulation' ? (
                            <div className="border-t border-border pt-4 space-y-3">
                                <label className="text-sm font-medium text-foreground block">
                                    Pourquoi annuler cette dépense ?
                                </label>
                                <input
                                    type="text"
                                    value={motif}
                                    onChange={e => setMotif(e.target.value)}
                                    placeholder="Ex : saisie en double le même jour"
                                    disabled={enAttente}
                                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                />
                                <p className="text-xs text-muted-foreground">
                                    La dépense restera consultable, barrée, avec ce motif — mais elle
                                    sortira du tableau de bord et des rapports. Pour corriger un
                                    montant ou une date, préférez la modification.
                                </p>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" className="flex-1"
                                            disabled={enAttente} onClick={() => { setMode('lecture'); setMotif('') }}>
                                        Retour
                                    </Button>
                                    <Button type="button" variant="destructive" className="flex-1"
                                            disabled={enAttente} onClick={annuler}>
                                        {enAttente
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : 'Confirmer l’annulation'
                                        }
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-2 border-t border-border pt-4">
                                <Button type="button" className="flex-1" onClick={() => setMode('edition')}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Modifier
                                </Button>
                                <Button type="button" variant="outline" className="flex-1"
                                        onClick={() => setMode('annulation')}>
                                    <Ban className="w-4 h-4 mr-2" />
                                    Annuler la dépense
                                </Button>
                            </div>
                        )
                    )}
                </div>
            )}

            <HistoriqueCorrections entrees={historique} />
        </div>
    )
}
