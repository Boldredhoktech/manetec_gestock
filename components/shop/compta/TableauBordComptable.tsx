import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Props {
    donnees: {
        totalVentes: number; totalFactures: number; totalEntrees: number
        totalDepenses: number; totalSalaires: number; totalFournisseurs: number
        totalSorties: number; resultat: number; nbVentes: number
        depenses: { libelle: string; montant: number; expense_categories: { nom: string } | null }[]
    }
}

export default function TableauBordComptable({ donnees }: Props) {
    const positif = donnees.resultat >= 0

    return (
        <div className="space-y-6">

            {/* Résultat net */}
            <div className={`rounded-xl p-6 border ${
                positif
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
            }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className={`text-sm font-medium ${positif ? 'text-green-700' : 'text-red-700'}`}>
                            Résultat net du mois
                        </p>
                        <p className={`text-3xl font-bold mt-1 ${positif ? 'text-green-800' : 'text-red-800'}`}>
                            {positif ? '+' : ''}{formatMontant(donnees.resultat)}
                        </p>
                    </div>
                    <div className={`p-3 rounded-full ${positif ? 'bg-green-100' : 'bg-red-100'}`}>
                        {positif
                            ? <TrendingUp className="w-6 h-6 text-green-600" />
                            : <TrendingDown className="w-6 h-6 text-red-600" />
                        }
                    </div>
                </div>
            </div>

            {/* Entrées vs Sorties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Entrées */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        Entrées
                    </h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
              <span className="text-muted-foreground">
                Ventes POS ({donnees.nbVentes})
              </span>
                            <span className="font-medium text-foreground">
                {formatMontant(donnees.totalVentes)}
              </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Paiements factures</span>
                            <span className="font-medium text-foreground">
                {formatMontant(donnees.totalFactures)}
              </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 font-bold text-foreground">
                            <span>Total entrées</span>
                            <span className="text-green-600">{formatMontant(donnees.totalEntrees)}</span>
                        </div>
                    </div>
                </div>

                {/* Sorties */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-destructive" />
                        Sorties
                    </h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Dépenses</span>
                            <span className="font-medium text-foreground">
                {formatMontant(donnees.totalDepenses)}
              </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Salaires</span>
                            <span className="font-medium text-foreground">
                {formatMontant(donnees.totalSalaires)}
              </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Fournisseurs</span>
                            <span className="font-medium text-foreground">
                {formatMontant(donnees.totalFournisseurs)}
              </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 font-bold text-foreground">
                            <span>Total sorties</span>
                            <span className="text-destructive">{formatMontant(donnees.totalSorties)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Détail dépenses */}
            {donnees.depenses.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-foreground">
                        Détail des dépenses du mois
                    </h2>
                    <div className="space-y-2">
                        {donnees.depenses.slice(0, 8).map((d, i) => (
                            <div key={i} className="flex justify-between text-xs">
                                <div>
                                    <span className="font-medium text-foreground">{d.libelle}</span>
                                    {d.expense_categories && (
                                        <span className="text-muted-foreground ml-2">
                      · {d.expense_categories.nom}
                    </span>
                                    )}
                                </div>
                                <span className="text-destructive font-medium">
                  {formatMontant(d.montant)}
                </span>
                            </div>
                        ))}
                        {donnees.depenses.length > 8 && (
                            <p className="text-xs text-muted-foreground">
                                + {donnees.depenses.length - 8} autre(s)...
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}