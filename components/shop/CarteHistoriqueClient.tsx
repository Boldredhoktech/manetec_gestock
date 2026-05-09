import { formatDate, formatMontant } from '@/lib/utils'
import { History } from 'lucide-react'

interface Operation {
    id: string
    type_operation: string
    montant: number
    solde_avant: number
    solde_apres: number
    note: string | null
    created_at: string
}

interface Props { operations: Operation[] }

const TYPE_LABELS: Record<string, { label: string; couleur: string }> = {
    credit_remboursement: { label: 'Remboursement crédit', couleur: 'text-green-600'     },
    credit_utilisation:   { label: 'Crédit accordé',       couleur: 'text-destructive'   },
    advance_depot:        { label: 'Dépôt avance',          couleur: 'text-blue-600'      },
    advance_utilisation:  { label: 'Utilisation avance',    couleur: 'text-amber-600'     },
    change_depot:         { label: 'Dépôt monnaie',         couleur: 'text-purple-600'    },
    change_utilisation:   { label: 'Utilisation monnaie',   couleur: 'text-muted-foreground' },
}

export default function CarteHistoriqueClient({ operations }: Props) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4" />
                Historique des opérations
            </h2>

            {operations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                    Aucune opération enregistrée.
                </p>
            ) : (
                <div className="space-y-2">
                    {operations.map(op => {
                        const config = TYPE_LABELS[op.type_operation]
                        return (
                            <div key={op.id}
                                 className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                                <div>
                                    <p className={`text-xs font-medium ${config?.couleur ?? 'text-foreground'}`}>
                                        {config?.label ?? op.type_operation}
                                    </p>
                                    {op.note && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{op.note}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {formatDate(op.created_at)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-foreground">
                                        {formatMontant(op.montant)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        → {formatMontant(op.solde_apres)}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}