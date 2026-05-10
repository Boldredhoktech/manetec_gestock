import { formatDate, formatMontant } from '@/lib/utils'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Depense {
    id: string; public_id: string; libelle: string
    montant: number; moyen_paiement: string; date_depense: string
    expense_categories: { nom: string } | { nom: string }[] | null
}

interface Props { depenses: Depense[] }

export default function ListeDepenses({ depenses }: Props) {
    if (depenses.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground text-sm bg-card border border-border rounded-xl">
                Aucune dépense enregistrée.
            </div>
        )
    }

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Libellé</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Catégorie</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Moyen</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Montant</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                    {depenses.map(d => (
                        <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                                <p className="font-medium text-foreground">{d.libelle}</p>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">{d.public_id}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {(Array.isArray(d.expense_categories)
                                        ? d.expense_categories[0]?.nom
                                        : d.expense_categories?.nom
                                ) ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {MOYENS_PAIEMENT.find(m => m.code === d.moyen_paiement)?.label ?? d.moyen_paiement}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {formatDate(d.date_depense)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-destructive">
                                {formatMontant(d.montant)}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}