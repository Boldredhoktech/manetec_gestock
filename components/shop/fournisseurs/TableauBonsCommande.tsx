'use client'

import { formatDate, formatMontant } from '@/lib/utils'
import Link from 'next/link'
import { ChevronRight, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface Bon {
    id: string; public_id: string; statut: string
    date_commande: string; montant_total: number
}

interface Props { bons: Bon[] }

const STATUT_CONFIG: Record<string, { label: string; classe: string }> = {
    brouillon:          { label: 'Brouillon',     classe: 'bg-muted text-muted-foreground border-border'    },
    envoye:             { label: 'Envoyé',         classe: 'bg-blue-100 text-blue-700 border-blue-200'       },
    partiellement_recu: { label: 'Partiel',        classe: 'bg-amber-100 text-amber-700 border-amber-200'    },
    recu:               { label: 'Reçu',           classe: 'bg-green-100 text-green-700 border-green-200'    },
    annule:             { label: 'Annulé',         classe: 'bg-muted text-muted-foreground border-border'    },
}

export default function TableauBonsCommande({ bons }: Props) {
    const [enAttenteId, setEnAttenteId] = useState<string | null>(null)

    async function handleTelecharger(bonId: string, publicId: string) {
        setEnAttenteId(bonId)
        const resp = await fetch(`/api/v1/pdf/bon-commande/${bonId}`)
        const blob = await resp.blob()
        const link = document.createElement('a')
        link.href     = URL.createObjectURL(blob)
        link.download = `bc-${publicId}.pdf`
        link.click()
        setEnAttenteId(null)
    }

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                    Bons de commande ({bons.length})
                </h2>
            </div>

            {bons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun bon de commande.</p>
            ) : (
                <div className="divide-y divide-border">
                    {bons.map(b => {
                        const config = STATUT_CONFIG[b.statut]
                        return (
                            <div key={b.id} className="flex items-center justify-between py-2.5">
                                <div>
                                    <p className="text-xs font-mono font-medium text-foreground">{b.public_id}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {formatDate(b.date_commande)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${config?.classe}`}>
                                        {config?.label}
                                    </span>
                                    <span className="text-xs font-medium text-foreground">
                                        {formatMontant(b.montant_total)}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={enAttenteId === b.id}
                                            onClick={() => handleTelecharger(b.id, b.public_id)}
                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                                        >
                                            {enAttenteId === b.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Download className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                        <Link href={`/stock/fournisseurs/commandes/${b.id}`}
                                              className="flex items-center gap-1 text-xs text-primary hover:underline">
                                            Voir <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}