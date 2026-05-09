import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface Produit {
    id: string
    nom: string
    public_id: string
    seuil_alerte: number
    stock_levels: { quantite: number }[]
}

interface Props { produits: Produit[] }

export default function AlertesStock({ produits }: Props) {
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-800">
                    {produits.length} produit(s) en alerte de stock
                </h2>
            </div>
            <div className="space-y-1.5">
                {produits.slice(0, 5).map(p => {
                    const stock = p.stock_levels.reduce((acc, s) => acc + s.quantite, 0)
                    return (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-amber-800 font-medium">{p.nom}</span>
                            <span className="text-amber-700">
                {stock} restant(s) · seuil : {p.seuil_alerte}
              </span>
                        </div>
                    )
                })}
                {produits.length > 5 && (
                    <p className="text-xs text-amber-700">
                        + {produits.length - 5} autre(s)...
                    </p>
                )}
            </div>
            <Link
                href="/stock/produits"
                className="text-xs text-amber-700 underline underline-offset-2"
            >
                Voir tous les produits →
            </Link>
        </div>
    )
}