'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import { convertirDevisEnFacture, modifierStatutDevis } from '@/actions/facturation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface Devis {
    id: string
    public_id: string
    statut: string
    date_devis: string
    date_validite: string | null
    montant_ttc: number
    objet: string | null
    // Supabase retourne un tableau pour les jointures, même pour un seul objet
    business_clients: { nom: string } | { nom: string }[] | null
}

interface Props { devis: Devis[] }

const STATUT_CONFIG: Record<string, { label: string; classe: string }> = {
    brouillon: { label: 'Brouillon', classe: 'bg-muted text-muted-foreground border-border'    },
    envoye:    { label: 'Envoyé',    classe: 'bg-blue-100 text-blue-700 border-blue-200'        },
    accepte:   { label: 'Accepté',   classe: 'bg-green-100 text-green-700 border-green-200'     },
    refuse:    { label: 'Refusé',    classe: 'bg-red-100 text-red-700 border-red-200'            },
    expire:    { label: 'Expiré',    classe: 'bg-amber-100 text-amber-700 border-amber-200'     },
}

export default function TableauDevis({ devis }: Props) {
    const [enAttenteId, setEnAttenteId] = useState<string | null>(null)

    async function handleConvertir(devisId: string) {
        setEnAttenteId(devisId)
        await convertirDevisEnFacture(devisId)
        setEnAttenteId(null)
    }

    if (devis.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground text-sm bg-card border border-border rounded-xl">
                Aucun devis.
            </div>
        )
    }

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Devis</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Montant TTC</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Validité</th>
                        <th className="px-4 py-3" />
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                    {devis.map(d => {
                        const config = STATUT_CONFIG[d.statut]
                        return (
                            <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-mono text-xs font-medium text-foreground">
                                        {d.public_id}
                                    </p>
                                    {d.objet && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-32">
                                            {d.objet}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {formatDate(d.date_devis)}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-xs text-foreground">
                                    {(Array.isArray(d.business_clients) ? d.business_clients[0]?.nom : d.business_clients?.nom) ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${config?.classe ?? ''}`}>
                      {config?.label ?? d.statut}
                    </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-foreground text-xs">
                                    {formatMontant(d.montant_ttc)}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                    {d.date_validite ? formatDate(d.date_validite) : '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {['brouillon', 'envoye'].includes(d.statut) && (
                                            <Button
                                                variant="outline" size="sm"
                                                className="text-xs h-7"
                                                disabled={enAttenteId === d.id}
                                                onClick={() => handleConvertir(d.id)}
                                            >
                                                {enAttenteId === d.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : 'Facturer'
                                                }
                                            </Button>
                                        )}
                                        <Link href={`/admin/factures/devis/${d.id}`}
                                              className="flex items-center gap-1 text-xs text-primary hover:underline">
                                            Voir <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
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