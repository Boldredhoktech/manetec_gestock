'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { payerSalaire } from '@/actions/comptabilite'
import { formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, AlertCircle, User, History } from 'lucide-react'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Paiement {
    montant_net: number
    periode_mois: number
    periode_annee: number
}

interface Employe {
    id: string
    nom_complet: string
    poste: string | null
    salaire_base: number
    est_actif: boolean
    salary_payments: Paiement[]
}

interface Props { employes: Employe[] }

export default function ListeEmployes({ employes }: Props) {
    const router      = useRouter()
    const maintenant  = new Date()
    const moisCourant = maintenant.getMonth() + 1
    const anneeCourant = maintenant.getFullYear()

    const [enAttenteId, setEnAttenteId] = useState<string | null>(null)
    const [erreurs, setErreurs]         = useState<Record<string, string>>({})
    const [succesIds, setSuccesIds]     = useState<Set<string>>(new Set())

    const dejaPaye = (employe: Employe) =>
        employe.salary_payments.some(
            p => p.periode_mois === moisCourant && p.periode_annee === anneeCourant
        ) || succesIds.has(employe.id)

    const dernierPaiement = (employe: Employe) => {
        const sorted = [...employe.salary_payments].sort((a, b) =>
            b.periode_annee - a.periode_annee || b.periode_mois - a.periode_mois
        )
        return sorted[0] ?? null
    }

    async function handlePayer(e: React.FormEvent<HTMLFormElement>, employeId: string) {
        e.preventDefault()
        setEnAttenteId(employeId)
        setErreurs(prev => ({ ...prev, [employeId]: '' }))

        const formData = new FormData(e.currentTarget)
        formData.set('mois', moisCourant.toString())
        formData.set('annee', anneeCourant.toString())

        const res = await payerSalaire(formData)
        setEnAttenteId(null)

        if (res?.erreur) {
            setErreurs(prev => ({ ...prev, [employeId]: res.erreur! }))
        } else {
            setSuccesIds(prev => new Set([...prev, employeId]))
            // Rafraîchir après 2s pour voir le nouveau paiement dans l'historique
            setTimeout(() => router.refresh(), 2000)
        }
    }

    const MOIS_LABELS = [
        '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ]

    if (employes.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground text-sm">
                Aucun employé enregistré.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Période de paie : <strong className="text-foreground">
                    {MOIS_LABELS[moisCourant]} {anneeCourant}
                </strong>
                </p>
                <p className="text-xs text-muted-foreground">
                    {employes.filter(e => dejaPaye(e)).length}/{employes.length} payés ce mois
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {employes.map(emp => {
                    const paye      = dejaPaye(emp)
                    const enAttente = enAttenteId === emp.id
                    const dernier   = dernierPaiement(emp)

                    return (
                        <div key={emp.id}
                             className="bg-card border border-border rounded-xl p-5 space-y-4">

                            {/* En-tête employé */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-primary/10 p-2 rounded-full">
                                        <User className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">
                                            {emp.nom_complet}
                                        </p>
                                        {emp.poste && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{emp.poste}</p>
                                        )}
                                    </div>
                                </div>
                                {paye && (
                                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Payé
                  </span>
                                )}
                            </div>

                            {/* Dernier paiement */}
                            {dernier && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                                    <History className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                    Dernier : {MOIS_LABELS[dernier.periode_mois]} {dernier.periode_annee}
                                        — {formatMontant(dernier.montant_net)}
                  </span>
                                </div>
                            )}

                            {/* Erreur */}
                            {erreurs[emp.id] && (
                                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded px-2 py-1.5 text-xs">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {erreurs[emp.id]}
                                </div>
                            )}

                            {/* Formulaire paiement */}
                            {!paye ? (
                                <form onSubmit={e => handlePayer(e, emp.id)} className="space-y-2">
                                    <input type="hidden" name="employeeId" value={emp.id} />

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                        <div>
                                            <label className="text-xs text-muted-foreground">Base</label>
                                            <input name="salaireBase" type="number"
                                                   defaultValue={emp.salaire_base} min="0" step="0.01"
                                                   className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground">Bonus</label>
                                            <input name="bonus" type="number"
                                                   defaultValue="0" min="0" step="0.01"
                                                   className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground">Déductions</label>
                                            <input name="deductions" type="number"
                                                   defaultValue="0" min="0" step="0.01"
                                                   className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring" />
                                        </div>
                                    </div>

                                    <select name="moyen"
                                            className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                                        {MOYENS_PAIEMENT.map(m => (
                                            <option key={m.code} value={m.code}>{m.label}</option>
                                        ))}
                                    </select>

                                    <Button type="submit" size="sm" disabled={enAttente} className="w-full">
                                        {enAttente
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : `Payer — ${formatMontant(emp.salaire_base)}`
                                        }
                                    </Button>
                                </form>
                            ) : (
                                <div className="text-center py-3 space-y-1">
                                    <p className="text-xs text-green-600 font-medium">
                                        ✓ Salaire de {MOIS_LABELS[moisCourant]} versé
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Disponible à nouveau en {MOIS_LABELS[moisCourant === 12 ? 1 : moisCourant + 1]}
                                    </p>
                                </div>
                            )}

                        </div>
                    )
                })}
            </div>
        </div>
    )
}