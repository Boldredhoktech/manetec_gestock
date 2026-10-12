// components/redhok/CarteHistoriquePaiements.tsx
// Historique des paiements d'abonnement d'une boutique, côté plateforme
// (ABO-18). Avant, il n'en restait qu'une ligne SHOP_PLAN_CHANGED dans
// le journal d'audit, sans montant ni moyen.

import { Receipt } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { labelPlan, DUREES, estDuree, formatMontant } from '@/lib/abonnement/catalogue'

export interface PaiementAbonnementLigne {
    id:                    string
    public_id:             string
    plan:                  string
    duree:                 string
    montant:               number
    moyen:                 string
    statut:                string
    sandbox:               boolean
    reference_transaction: string | null
    periode_debut:         string | null
    periode_fin:           string | null
    note:                  string | null
    motif_echec:           string | null
    created_at:            string
}

const STATUTS: Record<string, { label: string; classe: string }> = {
    reussi:     { label: 'Payé',       classe: 'bg-green-100 text-green-700' },
    en_attente: { label: 'En attente', classe: 'bg-gray-100 text-gray-600'   },
    echoue:     { label: 'Échoué',     classe: 'bg-red-100 text-red-700'     },
    abandonne:  { label: 'Abandonné',  classe: 'bg-gray-100 text-gray-600'   },
    rembourse:  { label: 'Remboursé',  classe: 'bg-amber-100 text-amber-700' },
}

export default function CarteHistoriquePaiements({ paiements }: { paiements: PaiementAbonnementLigne[] }) {
    const encaisse = paiements
        .filter(p => p.statut === 'reussi' && !p.sandbox)
        .reduce((s, p) => s + Number(p.montant), 0)

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Paiements d&apos;abonnement
                </h2>
                <span className="text-xs text-muted-foreground">
                    Total encaissé : <strong className="text-foreground">{formatMontant(encaisse)}</strong>
                </span>
            </div>

            {paiements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                                <th className="py-2 pr-3 font-medium">Paiement</th>
                                <th className="py-2 pr-3 font-medium">Plan</th>
                                <th className="py-2 pr-3 font-medium">Montant</th>
                                <th className="py-2 pr-3 font-medium">Moyen</th>
                                <th className="py-2 pr-3 font-medium">Statut</th>
                                <th className="py-2 pr-3 font-medium">Période couverte</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paiements.map(p => {
                                const st = STATUTS[p.statut] ?? STATUTS.en_attente
                                return (
                                    <tr key={p.id} className="border-b border-border/60 align-top">
                                        <td className="py-2 pr-3">
                                            <p className="font-mono">{p.public_id}</p>
                                            <p className="text-muted-foreground">{formatDate(p.created_at)}</p>
                                        </td>
                                        <td className="py-2 pr-3">
                                            {labelPlan(p.plan)} · {estDuree(p.duree) ? DUREES[p.duree].label : p.duree}
                                        </td>
                                        <td className="py-2 pr-3 font-semibold">{formatMontant(Number(p.montant))}</td>
                                        <td className="py-2 pr-3">
                                            {p.moyen === 'kkiapay' ? 'KkiaPay' : 'Manuel'}
                                            {p.sandbox && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">TEST</span>}
                                            {p.reference_transaction && <p className="text-muted-foreground font-mono">{p.reference_transaction}</p>}
                                        </td>
                                        <td className="py-2 pr-3">
                                            <span className={`px-2 py-0.5 rounded-full font-bold ${st.classe}`}>{st.label}</span>
                                            {(p.motif_echec || p.note) && (
                                                <p className="text-muted-foreground mt-1 max-w-[16rem]">{p.motif_echec ?? p.note}</p>
                                            )}
                                        </td>
                                        <td className="py-2 pr-3 text-muted-foreground">
                                            {p.periode_debut && p.periode_fin
                                                ? `${formatDate(p.periode_debut)} → ${formatDate(p.periode_fin)}`
                                                : '—'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
