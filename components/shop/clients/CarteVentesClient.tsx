import Link from 'next/link'
import { ShoppingCart, ChevronRight, Calendar } from 'lucide-react'
import { formatMontant, formatDateHeure } from '@/lib/utils'

interface Vente {
    id:            string
    public_id:     string
    statut:        string
    montant_total: number
    created_at:    string
    sale_items:    { id: string }[]
    sale_payments: { moyen_paiement: string; montant: number }[]
}

interface Props { ventes: Vente[]; devise: string }

const MOYENS_LABELS: Record<string, string> = {
    cash:          'Espèces',
    wave:          'Wave',
    mtn_momo:      'MTN MoMo',
    celtiis_cash:  'Celtiis',
    moov_money:    'Moov',
    bank_card:     'Carte',
    bank_transfer: 'Virement',
    other_mobile:  'Mobile',
}

export default function CarteVentesClient({ ventes, devise }: Props) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

            {/* En-tête */}
            <div className="flex items-center gap-2 p-5 border-b border-gray-100">
                <div className="bg-green-100 p-2 rounded-lg">
                    <ShoppingCart className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">
                    10 dernières ventes
                </h2>
                <span className="ml-auto text-xs text-gray-400">
          {ventes.length} vente(s)
        </span>
            </div>

            {ventes.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucune vente enregistrée pour ce client.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50">
                    {ventes.map(v => {
                        const moyenPrincipal = v.sale_payments[0]?.moyen_paiement ?? 'cash'
                        return (
                            <div key={v.id}
                                 className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">

                                {/* Icône */}
                                <div className="shrink-0 p-2 bg-green-50 rounded-xl">
                                    <ShoppingCart className="w-4 h-4 text-green-600" />
                                </div>

                                {/* Infos */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-gray-900 font-mono">
                                            {v.public_id}
                                        </p>
                                        <span className="text-xs text-gray-400">
                      · {v.sale_items.length} article(s)
                    </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Calendar className="w-3 h-3 text-gray-400" />
                                        <p className="text-xs text-gray-400">
                                            {formatDateHeure(v.created_at)}
                                        </p>
                                        <span className="text-xs text-gray-300">·</span>
                                        <span className="text-xs text-gray-500">
                      {MOYENS_LABELS[moyenPrincipal] ?? moyenPrincipal}
                    </span>
                                    </div>
                                </div>

                                {/* Montant */}
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black text-green-600">
                                        {formatMontant(v.montant_total, devise)}
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