import { formatDate, formatMontant } from '@/lib/utils'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

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
                                    <Link href={`/stock/fournisseurs/commandes/${b.id}`}
                                          className="text-primary hover:text-primary/80">
                                        <ChevronRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}