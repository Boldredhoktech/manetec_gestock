'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Search, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react'
import BadgePlan from '@/components/redhok/BadgePlan'
import { formatDate } from '@/lib/utils'

interface Boutique {
    id: string
    public_id: string
    nom: string
    ville: string | null
    pays: string
    telephone_1: string
    email: string | null
    plan: string
    plan_expire_le: string | null
    est_active: boolean
    created_at: string
}

interface Props {
    boutiques: Boutique[]
}

export default function TableauBoutiques({ boutiques }: Props) {
    const [recherche, setRecherche] = useState('')
    const [filtrePlan, setFiltrePlan] = useState('tous')
    const [filtreStatut, setFiltreStatut] = useState('tous')

    const filtrees = boutiques.filter(b => {
        const matchRecherche =
            b.nom.toLowerCase().includes(recherche.toLowerCase()) ||
            b.public_id.toLowerCase().includes(recherche.toLowerCase()) ||
            (b.ville ?? '').toLowerCase().includes(recherche.toLowerCase())

        const matchPlan = filtrePlan === 'tous' || b.plan === filtrePlan
        const matchStatut =
            filtreStatut === 'tous' ||
            (filtreStatut === 'active' && b.est_active) ||
            (filtreStatut === 'inactive' && !b.est_active)

        return matchRecherche && matchPlan && matchStatut
    })

    return (
        <div className="space-y-4">

            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, ID, ville..."
                        value={recherche}
                        onChange={e => setRecherche(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
                <select
                    value={filtrePlan}
                    onChange={e => setFiltrePlan(e.target.value)}
                    className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="tous">Tous les plans</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                </select>
                <select
                    value={filtreStatut}
                    onChange={e => setFiltreStatut(e.target.value)}
                    className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="tous">Tous les statuts</option>
                    <option value="active">Actives</option>
                    <option value="inactive">Inactives</option>
                </select>
            </div>

            {/* Tableau */}
            {filtrees.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                    Aucune boutique trouvée.
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Boutique</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expiration</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Créée le</th>
                                <th className="px-4 py-3" />
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                            {filtrees.map(boutique => (
                                <tr
                                    key={boutique.id}
                                    className="hover:bg-muted/30 transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="font-medium text-foreground">{boutique.nom}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {[boutique.ville, boutique.pays].filter(Boolean).join(', ')}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {boutique.public_id}
                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <BadgePlan plan={boutique.plan} />
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                        {boutique.plan_expire_le
                                            ? formatDate(boutique.plan_expire_le)
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {!boutique.est_active ? (
                                            <span className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          Inactive
                        </span>
                                        ) : (boutique.plan_expire_le && new Date(boutique.plan_expire_le) < new Date()) ? (
                                            <span className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Expirée
                        </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Active
                        </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                        {formatDate(boutique.created_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/redhok/boutiques/${boutique.id}`}
                                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                                        >
                                            Voir
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}