'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Search, ChevronRight, AlertCircle } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Fournisseur {
    id: string; public_id: string; nom: string
    telephone: string | null; email: string | null
    solde_dû: number; est_actif: boolean
}

interface Props { fournisseurs: Fournisseur[] }

export default function TableauFournisseurs({ fournisseurs }: Props) {
    const [recherche, setRecherche] = useState('')

    const filtres = fournisseurs.filter(f =>
        f.nom.toLowerCase().includes(recherche.toLowerCase()) ||
        f.public_id.toLowerCase().includes(recherche.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Rechercher un fournisseur..."
                       value={recherche} onChange={e => setRecherche(e.target.value)}
                       className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {filtres.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                    Aucun fournisseur trouvé.
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fournisseur</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Téléphone</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Solde dû</th>
                                <th className="px-4 py-3" />
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                            {filtres.map(f => (
                                <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-foreground">{f.nom}</p>
                                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{f.public_id}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {f.telephone ?? '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {f.solde_dû > 0 ? (
                                            <span className="flex items-center gap-1 text-destructive text-xs font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                                                {formatMontant(f.solde_dû)}
                        </span>
                                        ) : (
                                            <span className="text-xs text-green-600 font-medium">Soldé</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link href={`/stock/fournisseurs/${f.id}`}
                                              className="flex items-center gap-1 text-xs text-primary hover:underline">
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