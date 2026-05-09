'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, AlertCircle } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Client {
    id: string
    public_id: string
    nom: string
    telephone: string | null
    email: string | null
    credit_balance: number
    advance_balance: number
    change_balance: number
    est_actif: boolean
}

interface Props { clients: Client[] }

export default function TableauClients({ clients }: Props) {
    const [recherche, setRecherche] = useState('')

    const filtres = clients.filter(c =>
        c.nom.toLowerCase().includes(recherche.toLowerCase()) ||
        (c.telephone ?? '').includes(recherche) ||
        c.public_id.toLowerCase().includes(recherche.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Rechercher par nom, téléphone, ID..."
                    value={recherche}
                    onChange={e => setRecherche(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

            {filtres.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                    Aucun client trouvé.
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Téléphone</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Crédit dû</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Avance</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Monnaie</th>
                                <th className="px-4 py-3" />
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                            {filtres.map(c => (
                                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="font-medium text-foreground">{c.nom}</p>
                                            <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                                {c.public_id}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                        {c.telephone ?? '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {c.credit_balance > 0 ? (
                                            <span className="flex items-center gap-1 text-destructive text-xs font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                                                {formatMontant(c.credit_balance)}
                        </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {c.advance_balance > 0 ? (
                                            <span className="text-xs font-medium text-green-600">
                          {formatMontant(c.advance_balance)}
                        </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {c.change_balance > 0 ? (
                                            <span className="text-xs font-medium text-blue-600">
                          {formatMontant(c.change_balance)}
                        </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/admin/clients/${c.id}`}
                                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                                        >
                                            Voir <ChevronRight className="w-3.5 h-3.5" />
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