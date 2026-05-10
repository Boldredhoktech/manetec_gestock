import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

interface HistoPrix {
    id: string
    ancien_prix_vente:  number | null
    nouveau_prix_vente: number | null
    ancien_prix_achat:  number | null
    nouveau_prix_achat: number | null
    created_at:         string
}

interface Props { historique: HistoPrix[] }

export default function CarteHistoriquePrix({ historique }: Props) {
    if (historique.length === 0) return null

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2">
                <div className="bg-amber-100 p-2 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Historique des prix</h2>
            </div>

            <div className="space-y-2">
                {historique.map(h => {
                    const hausseVente = (h.nouveau_prix_vente ?? 0) > (h.ancien_prix_vente ?? 0)
                    const diff        = (h.nouveau_prix_vente ?? 0) - (h.ancien_prix_vente ?? 0)
                    return (
                        <div key={h.id} className="p-2.5 bg-gray-50 rounded-lg flex items-center gap-3">
                            <div className={`p-1 rounded-lg ${
                                diff > 0 ? 'bg-green-100' : diff < 0 ? 'bg-red-100' : 'bg-gray-100'
                            }`}>
                                {diff > 0
                                    ? <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                                    : diff < 0
                                        ? <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                        : <Minus className="w-3.5 h-3.5 text-gray-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs">
                                    {h.ancien_prix_vente !== null && (
                                        <span className="text-gray-400 line-through">
                      {formatMontant(h.ancien_prix_vente)}
                    </span>
                                    )}
                                    <span className="text-gray-400">→</span>
                                    {h.nouveau_prix_vente !== null && (
                                        <span className={`font-bold ${
                                            hausseVente ? 'text-green-600' : 'text-red-500'
                                        }`}>
                      {formatMontant(h.nouveau_prix_vente)}
                    </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{formatDate(h.created_at)}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}