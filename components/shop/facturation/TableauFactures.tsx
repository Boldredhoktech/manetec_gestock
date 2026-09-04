'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import { etatFacture, CLASSES_TON } from '@/lib/facturation/etat-facture'

interface Facture {
    id: string
    public_id: string
    statut: string
    date_facture: string
    date_echeance: string | null
    montant_ttc: number
    montant_paye: number
    montant_restant: number
    objet: string | null
    // Supabase retourne un tableau pour les jointures, même pour un seul objet
    clients: { nom: string } | { nom: string }[] | null
}

interface Props { factures: Facture[] }

export default function TableauFactures({ factures }: Props) {
    if (factures.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground text-sm bg-card border border-border rounded-xl">
                Aucune facture.
            </div>
        )
    }

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Facture</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total TTC</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Restant</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Échéance</th>
                        <th className="px-4 py-3" />
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                    {factures.map(f => {
                        // Le retard se calcule ici, il n'est jamais stocké
                        // (décision D1). L'ancien calcul local ne le
                        // voyait que sur les factures « émises » : une
                        // facture partiellement payée et échue passait
                        // pour simplement « partielle ».
                        const etat = etatFacture(f)
                        return (
                            <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-mono text-xs font-medium text-foreground">
                                        {f.public_id}
                                    </p>
                                    {f.objet && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-32">
                                            {f.objet}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {formatDate(f.date_facture)}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-xs text-foreground">
                                    {(Array.isArray(f.clients) ? f.clients[0]?.nom : f.clients?.nom) ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${CLASSES_TON[etat.ton]}`}>
                      {etat.libelle}
                    </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-foreground text-xs">
                                    {formatMontant(f.montant_ttc)}
                                </td>
                                <td className="px-4 py-3 text-xs">
                                    {f.montant_restant > 0 ? (
                                        <span className="text-destructive font-medium">
                        {formatMontant(f.montant_restant)}
                      </span>
                                    ) : (
                                        <span className="text-green-600 font-medium">Soldée</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                    {f.date_echeance ? formatDate(f.date_echeance) : '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <Link href={`/admin/factures/${f.id}`}
                                          className="flex items-center gap-1 text-xs text-primary hover:underline">
                                        Voir <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}