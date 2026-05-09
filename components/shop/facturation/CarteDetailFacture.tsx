import { formatDate, formatMontant } from '@/lib/utils'

interface Props {
    facture: any
    boutique: any
}

const STATUT_CONFIG: Record<string, { label: string; classe: string }> = {
    emise:               { label: 'Émise',              classe: 'bg-blue-100 text-blue-700 border-blue-200'    },
    partiellement_payee: { label: 'Partiellement payée', classe: 'bg-amber-100 text-amber-700 border-amber-200' },
    payee:               { label: 'Payée',              classe: 'bg-green-100 text-green-700 border-green-200' },
    annulee:             { label: 'Annulée',            classe: 'bg-muted text-muted-foreground border-border' },
}

export default function CarteDetailFacture({ facture, boutique }: Props) {
    const config = STATUT_CONFIG[facture.statut]

    return (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">

            {/* En-tête */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-2xl font-bold text-foreground">{facture.public_id}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Émise le {formatDate(facture.date_facture)}
                        {facture.date_echeance && ` · Échéance le ${formatDate(facture.date_echeance)}`}
                    </p>
                </div>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${config?.classe}`}>
          {config?.label ?? facture.statut}
        </span>
            </div>

            {/* Boutique ↔ Client */}
            <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">De</p>
                    <p className="font-semibold text-foreground">{boutique?.nom}</p>
                    {boutique?.adresse && <p className="text-muted-foreground">{boutique.adresse}</p>}
                    {boutique?.telephone_1 && <p className="text-muted-foreground">{boutique.telephone_1}</p>}
                    {boutique?.ifu && <p className="text-muted-foreground text-xs">IFU : {boutique.ifu}</p>}
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">À</p>
                    {facture.business_clients ? (
                        <>
                            <p className="font-semibold text-foreground">{facture.business_clients.nom}</p>
                            {facture.business_clients.adresse && (
                                <p className="text-muted-foreground">{facture.business_clients.adresse}</p>
                            )}
                            {facture.business_clients.telephone && (
                                <p className="text-muted-foreground">{facture.business_clients.telephone}</p>
                            )}
                            {facture.business_clients.ifu && (
                                <p className="text-muted-foreground text-xs">IFU : {facture.business_clients.ifu}</p>
                            )}
                        </>
                    ) : (
                        <p className="text-muted-foreground">Client non spécifié</p>
                    )}
                </div>
            </div>

            {/* Lignes */}
            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Désignation</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qté</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Prix HT</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Remise</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">TVA</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total TTC</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                    {facture.facture_items?.map((item: any) => (
                        <tr key={item.id}>
                            <td className="px-4 py-2.5 text-foreground">{item.designation}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">{item.quantite}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                                {formatMontant(item.prix_unitaire)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                                {item.remise_pct > 0 ? `${item.remise_pct}%` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                                {item.tva_pct > 0 ? `${item.tva_pct}%` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-foreground">
                                {formatMontant(item.montant_ttc)}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Totaux */}
            <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Sous-total HT</span>
                        <span>{formatMontant(facture.montant_ht + facture.remise_val)}</span>
                    </div>
                    {facture.remise_val > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Remise ({facture.remise_pct}%)</span>
                            <span>-{formatMontant(facture.remise_val)}</span>
                        </div>
                    )}
                    {facture.montant_tva > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>TVA</span>
                            <span>{formatMontant(facture.montant_tva)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
                        <span>Total TTC</span>
                        <span>{formatMontant(facture.montant_ttc)}</span>
                    </div>
                    {facture.montant_paye > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Payé</span>
                            <span>{formatMontant(facture.montant_paye)}</span>
                        </div>
                    )}
                    {facture.montant_restant > 0 && (
                        <div className="flex justify-between text-destructive font-semibold">
                            <span>Reste à payer</span>
                            <span>{formatMontant(facture.montant_restant)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Paiements reçus */}
            {facture.facture_payments?.length > 0 && (
                <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Paiements reçus
                    </p>
                    <div className="space-y-1.5">
                        {facture.facture_payments.map((p: any) => (
                            <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
                                <span>{p.moyen_paiement} · {formatDate(p.created_at)}</span>
                                <span className="font-medium text-green-600">{formatMontant(p.montant)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}