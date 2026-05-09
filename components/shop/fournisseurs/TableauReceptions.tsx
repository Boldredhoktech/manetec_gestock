import { formatDate, formatMontant } from '@/lib/utils'

interface Reception {
    id: string; public_id: string
    date_reception: string; montant_total: number
}

interface Paiement {
    id: string; public_id: string; montant: number
    moyen_paiement: string; date_paiement: string
}

interface Props { receptions: Reception[]; paiements: Paiement[] }

export default function TableauReceptions({ receptions, paiements }: Props) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Réceptions */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                    Réceptions ({receptions.length})
                </h2>
                {receptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune réception.</p>
                ) : (
                    <div className="divide-y divide-border">
                        {receptions.map(r => (
                            <div key={r.id} className="flex justify-between py-2.5 text-xs">
                                <div>
                                    <p className="font-mono font-medium text-foreground">{r.public_id}</p>
                                    <p className="text-muted-foreground mt-0.5">{formatDate(r.date_reception)}</p>
                                </div>
                                <span className="font-medium text-foreground">
                  {formatMontant(r.montant_total)}
                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Paiements */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                    Paiements ({paiements.length})
                </h2>
                {paiements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement.</p>
                ) : (
                    <div className="divide-y divide-border">
                        {paiements.map(p => (
                            <div key={p.id} className="flex justify-between py-2.5 text-xs">
                                <div>
                                    <p className="font-mono font-medium text-foreground">{p.public_id}</p>
                                    <p className="text-muted-foreground mt-0.5">
                                        {p.moyen_paiement} · {formatDate(p.date_paiement)}
                                    </p>
                                </div>
                                <span className="font-medium text-green-600">
                  {formatMontant(p.montant)}
                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    )
}