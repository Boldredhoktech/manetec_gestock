'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { payerSalaire } from '@/actions/comptabilite'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, AlertCircle, User, History, AlertTriangle } from 'lucide-react'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Versement {
    id:             string
    public_id:      string
    employee_id:    string
    montant_net:    number
    salaire_base:   number
    bonus:          number
    deductions:     number
    date_paiement:  string
    moyen_paiement: string
}

interface DernierVersement {
    employee_id:   string
    montant_net:   number
    periode_mois:  number
    periode_annee: number
    date_paiement: string
}

interface Employe {
    id:           string
    nom_complet:  string
    poste:        string | null
    salaire_base: number
    est_actif:    boolean
}

interface Props {
    employes:           Employe[]
    versementsPeriode:  Versement[]
    derniersVersements: DernierVersement[]
    mois:               number
    annee:              number
}

const MOIS_LABELS = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default function ListeEmployes({
    employes, versementsPeriode, derniersVersements, mois, annee,
}: Props) {
    const router       = useRouter()
    const pathname     = usePathname()
    const searchParams = useSearchParams()

    const aujourdhui = new Date().toISOString().split('T')[0]

    const [enAttenteId, setEnAttenteId] = useState<string | null>(null)
    const [erreurs, setErreurs]         = useState<Record<string, string>>({})
    const [ouvertId, setOuvertId]       = useState<string | null>(null)

    // Un employé peut recevoir plusieurs versements pour une même période
    // (acompte puis solde) : on cumule au lieu de bloquer le second.
    const versementsDe = (employeId: string) =>
        versementsPeriode.filter(v => v.employee_id === employeId)

    const verseA = (employeId: string) =>
        versementsDe(employeId).reduce((total, v) => total + v.montant_net, 0)

    const dernierDe = (employeId: string) =>
        derniersVersements.find(v => v.employee_id === employeId) ?? null

    function changerPeriode(nouveauMois: number, nouvelleAnnee: number) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('mois', String(nouveauMois))
        params.set('annee', String(nouvelleAnnee))
        router.push(`${pathname}?${params.toString()}`)
    }

    async function payer(e: React.FormEvent<HTMLFormElement>, employeId: string) {
        e.preventDefault()
        setEnAttenteId(employeId)
        setErreurs(prev => ({ ...prev, [employeId]: '' }))

        const formData = new FormData(e.currentTarget)
        formData.set('mois', String(mois))
        formData.set('annee', String(annee))

        const res = await payerSalaire(formData)
        setEnAttenteId(null)

        if (res?.erreur) {
            setErreurs(prev => ({ ...prev, [employeId]: res.erreur! }))
        } else {
            setOuvertId(null)
            router.refresh()
        }
    }

    const totalVerse   = versementsPeriode.reduce((t, v) => t + v.montant_net, 0)
    const nbCouverts   = employes.filter(e => verseA(e.id) >= e.salaire_base && e.salaire_base > 0).length
    const anneesChoix  = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i)

    return (
        <div className="space-y-5">

            {/* Sélecteur de période + récapitulatif */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground block">
                            Période de paie
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={mois}
                                onChange={e => changerPeriode(Number(e.target.value), annee)}
                                className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {MOIS_LABELS.slice(1).map((label, i) => (
                                    <option key={i + 1} value={i + 1}>{label}</option>
                                ))}
                            </select>
                            <select
                                value={annee}
                                onChange={e => changerPeriode(mois, Number(e.target.value))}
                                className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {anneesChoix.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 min-w-[180px] grid grid-cols-2 gap-4 sm:justify-items-end">
                        <div>
                            <p className="text-xs text-muted-foreground">Employés couverts</p>
                            <p className="text-lg font-bold text-foreground tabular-nums">
                                {nbCouverts}<span className="text-sm font-normal text-muted-foreground">/{employes.length}</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total versé</p>
                            <p className="text-lg font-bold text-foreground tabular-nums">
                                {formatMontant(totalVerse)}
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground border-t border-border pt-3">
                    Un versement est enregistré <strong className="text-foreground">au titre de {MOIS_LABELS[mois]} {annee}</strong>,
                    mais il compte dans la trésorerie du jour où l&apos;argent sort — c&apos;est la date
                    de versement que vous saisissez. Plusieurs versements sont possibles pour un
                    même mois : acompte puis solde.
                </p>
            </div>

            {employes.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                    Aucun employé enregistré.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employes.map(emp => {
                        const versements = versementsDe(emp.id)
                        const verse      = verseA(emp.id)
                        const reste      = emp.salaire_base - verse
                        const couvert    = emp.salaire_base > 0 && reste <= 0
                        const entame     = versements.length > 0 && !couvert
                        const enAttente  = enAttenteId === emp.id
                        const dernier    = dernierDe(emp.id)
                        const ouvert     = ouvertId === emp.id

                        return (
                            <div key={emp.id}
                                 className="bg-card border border-border rounded-xl p-5 space-y-3.5">

                                {/* En-tête employé */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="bg-primary/10 p-2 rounded-full shrink-0">
                                            <User className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {emp.nom_complet}
                                            </p>
                                            {emp.poste && (
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{emp.poste}</p>
                                            )}
                                        </div>
                                    </div>
                                    {couvert && (
                                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                                            <CheckCircle className="w-3 h-3" />
                                            Couvert
                                        </span>
                                    )}
                                    {entame && (
                                        <span className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                                            Partiel
                                        </span>
                                    )}
                                </div>

                                {/* Versé / reste dû pour la période */}
                                <div className="bg-muted/30 rounded-lg px-3 py-2.5 space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            Versé pour {MOIS_LABELS[mois]}
                                        </span>
                                        <span className="font-semibold text-foreground tabular-nums">
                                            {formatMontant(verse)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            {reste > 0 ? 'Reste dû' : 'Salaire de base'}
                                        </span>
                                        <span className={`font-medium tabular-nums ${
                                            reste > 0 ? 'text-amber-700' : 'text-muted-foreground'
                                        }`}>
                                            {formatMontant(reste > 0 ? reste : emp.salaire_base)}
                                        </span>
                                    </div>

                                    {versements.length > 0 && (
                                        <ul className="pt-1.5 mt-1 border-t border-border space-y-1">
                                            {versements.map(v => (
                                                <li key={v.id} className="flex justify-between text-xs text-muted-foreground">
                                                    <span className="font-mono">{formatDate(v.date_paiement)}</span>
                                                    <span className="tabular-nums">{formatMontant(v.montant_net)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Dernier versement, toutes périodes */}
                                {dernier && versements.length === 0 && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <History className="w-3.5 h-3.5 shrink-0" />
                                        <span>
                                            Dernier : {MOIS_LABELS[dernier.periode_mois]} {dernier.periode_annee}
                                            {' — '}{formatMontant(dernier.montant_net)}
                                        </span>
                                    </div>
                                )}

                                {erreurs[emp.id] && (
                                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded px-2 py-1.5 text-xs">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        {erreurs[emp.id]}
                                    </div>
                                )}

                                {!ouvert ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={couvert ? 'outline' : 'default'}
                                        className="w-full"
                                        onClick={() => setOuvertId(emp.id)}
                                    >
                                        {couvert
                                            ? 'Verser un complément'
                                            : versements.length > 0
                                                ? `Verser le solde — ${formatMontant(reste)}`
                                                : `Payer — ${formatMontant(emp.salaire_base)}`
                                        }
                                    </Button>
                                ) : (
                                    <form onSubmit={e => payer(e, emp.id)} className="space-y-2">
                                        <input type="hidden" name="employeeId" value={emp.id} />

                                        {couvert && (
                                            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1.5 text-xs">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                Le salaire de {MOIS_LABELS[mois]} est déjà couvert. Ce versement
                                                s&apos;ajoutera aux précédents.
                                            </div>
                                        )}

                                        <div className="grid grid-cols-3 gap-1.5">
                                            <div>
                                                <label className="text-xs text-muted-foreground">Base</label>
                                                <input name="salaireBase" type="number"
                                                       defaultValue={reste > 0 ? reste : emp.salaire_base}
                                                       min="0" step="0.01"
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

                                        <div>
                                            <label className="text-xs text-muted-foreground">Date de versement</label>
                                            <input name="datePaiement" type="date"
                                                   defaultValue={aujourdhui} max={aujourdhui} required
                                                   className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring" />
                                        </div>

                                        <select name="moyen"
                                                className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                                            {MOYENS_PAIEMENT.map(m => (
                                                <option key={m.code} value={m.code}>{m.label}</option>
                                            ))}
                                        </select>

                                        <div className="flex gap-2">
                                            <Button type="button" size="sm" variant="outline"
                                                    className="flex-1"
                                                    disabled={enAttente}
                                                    onClick={() => setOuvertId(null)}>
                                                Annuler
                                            </Button>
                                            <Button type="submit" size="sm" className="flex-1" disabled={enAttente}>
                                                {enAttente
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : 'Enregistrer'
                                                }
                                            </Button>
                                        </div>
                                    </form>
                                )}

                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
