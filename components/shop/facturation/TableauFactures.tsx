'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

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
    business_clients: { nom: string } | null
}

interface Props { factures: Facture[] }

const STATUT_CONFIG: Record<string, { label: string; classe: string }> = {
    emise:              { label: 'Émise',             classe: 'bg-blue-100 text-blue-700 border-blue-200'    },
    partiellement_payee:{ label: 'Partiel',            classe: 'bg-amber-100 text-amber-700 border-amber-200' },
    payee:              { label: 'Payée',              classe: 'bg-green-100 text-green-700 border-green-200' },
    en_retard:          { label: 'En retard',          classe: 'bg-red-100 text-red-700 border-red-200'       },
    annulee:            { label: 'Annulée',            classe: 'bg-muted text-muted-foreground border-border' },
}

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
                        const config = STATUT_CONFIG[f.statut]
                        const enRetard = f.statut === 'emise' && f.date_echeance &&
                            new Date(f.date_echeance) < new Date()
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
                                    {f.business_clients?.nom ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        enRetard
                            ? STATUT_CONFIG.en_retard.classe
                            : config?.classe ?? ''
                    }`}>
                      {enRetard ? 'En retard' : config?.label ?? f.statut}
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