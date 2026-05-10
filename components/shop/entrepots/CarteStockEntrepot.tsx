'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package, Search, AlertTriangle, CheckCircle,
    XCircle, ChevronRight } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface StockLevel {
    quantite: number
    products: {
        id: string; public_id: string; nom: string
        unite: string; sku: string | null
        prix_achat: number; prix_vente: number
        seuil_alerte: number; est_actif: boolean
        type_produit: string
        categories: { nom: string } | null
    } | null
}

interface Props {
    stockLevels: StockLevel[]
    valeurStock: number
}

export default function CarteStockEntrepot({ stockLevels }: Props) {
    const [recherche, setRecherche]   = useState('')
    const [filtre, setFiltre]         = useState<'tous'|'alerte'|'rupture'|'ok'>('tous')

    const filtres = stockLevels
        .filter(s => s.products?.est_actif)
        .filter(s => {
            if (!s.products) return false
            const matchRecherche =
                s.products.nom.toLowerCase().includes(recherche.toLowerCase()) ||
                s.products.public_id.toLowerCase().includes(recherche.toLowerCase()) ||
                (s.products.sku ?? '').toLowerCase().includes(recherche.toLowerCase())

            const enAlerte  = s.quantite <= s.products.seuil_alerte
            const enRupture = s.quantite <= 0

            if (filtre === 'rupture') return matchRecherche && enRupture
            if (filtre === 'alerte')  return matchRecherche && enAlerte && !enRupture
            if (filtre === 'ok')      return matchRecherche && !enAlerte
            return matchRecherche
        })
        .sort((a, b) => a.quantite - b.quantite) // Les plus critiques en premier

    const badges = [
        { key: 'tous',    label: 'Tous',     count: stockLevels.filter(s => s.products?.est_actif).length },
        { key: 'rupture', label: 'Rupture',  count: stockLevels.filter(s => s.products?.est_actif && s.quantite <= 0).length },
        { key: 'alerte',  label: 'Alertes',  count: stockLevels.filter(s => s.products?.est_actif && s.quantite > 0 && s.quantite <= (s.products?.seuil_alerte ?? 0)).length },
        { key: 'ok',      label: 'Stock OK', count: stockLevels.filter(s => s.products?.est_actif && s.quantite > (s.products?.seuil_alerte ?? 0)).length },
    ]

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

            {/* En-tête */}
            <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-[#1a56db]/10 p-2 rounded-lg">
                        <Package className="w-5 h-5 text-[#1a56db]" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">
                        Produits dans cet entrepôt
                    </h2>
                    <span className="ml-auto text-xs text-gray-400">
            {filtres.length} résultat(s)
          </span>
                </div>

                {/* Filtres badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {badges.map(b => (
                        <button
                            key={b.key}
                            onClick={() => setFiltre(b.key as any)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                filtre === b.key
                                    ? 'bg-[#1a56db] text-white shadow-md shadow-[#1a56db]/30'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {b.label}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                filtre === b.key ? 'bg-white/20' : 'bg-gray-200'
                            }`}>
                {b.count}
              </span>
                        </button>
                    ))}
                </div>

                {/* Recherche */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un produit, SKU, ID..."
                        value={recherche}
                        onChange={e => setRecherche(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 focus:border-[#1a56db]/40"
                    />
                </div>
            </div>

            {/* Tableau */}
            {filtres.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun produit dans cette catégorie.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50">
                    {filtres.map((s, i) => {
                        const p         = s.products!
                        const enRupture = s.quantite <= 0
                        const enAlerte  = !enRupture && s.quantite <= p.seuil_alerte
                        const stockOk   = !enRupture && !enAlerte

                        return (
                            <div key={p.id}
                                 className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${
                                     enRupture ? 'bg-red-50/40' : enAlerte ? 'bg-yellow-50/40' : ''
                                 }`}
                            >
                                {/* Icône statut */}
                                <div className={`shrink-0 p-1.5 rounded-lg ${
                                    enRupture ? 'bg-red-100' : enAlerte ? 'bg-yellow-100' : 'bg-green-100'
                                }`}>
                                    {enRupture
                                        ? <XCircle      className="w-4 h-4 text-red-500" />
                                        : enAlerte
                                            ? <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                            : <CheckCircle  className="w-4 h-4 text-green-500" />
                                    }
                                </div>

                                {/* Infos produit */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{p.nom}</p>
                                        <span className="shrink-0 text-xs text-gray-400 font-mono">{p.public_id}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {p.categories && (
                                            <span className="text-xs text-gray-400">{p.categories.nom}</span>
                                        )}
                                        {p.sku && (
                                            <span className="text-xs text-gray-400 font-mono">SKU: {p.sku}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Stock */}
                                <div className="text-right shrink-0">
                                    <p className={`text-sm font-black ${
                                        enRupture ? 'text-red-600'
                                            : enAlerte ? 'text-yellow-600'
                                                : 'text-green-600'
                                    }`}>
                                        {enRupture ? 'RUPTURE' : `${s.quantite} ${p.unite}`}
                                    </p>
                                    {enAlerte && !enRupture && (
                                        <p className="text-xs text-yellow-500">seuil: {p.seuil_alerte}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {formatMontant(s.quantite * p.prix_achat)}
                                    </p>
                                </div>

                                {/* Lien fiche produit */}
                                <Link href={`/stock/produits/${p.id}`}
                                      className="shrink-0 p-1.5 rounded-lg hover:bg-[#1a56db]/10 text-[#1a56db] transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}