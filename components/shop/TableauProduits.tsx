'use client'

import { useState } from 'react'
import { toggleActivationProduit } from '@/actions/produits'
import { formatMontant } from '@/lib/utils'
import { Search, AlertTriangle, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Produit {
    id: string
    public_id: string
    nom: string
    type_produit: string
    sku: string | null
    prix_vente: number
    prix_achat: number
    unite: string
    seuil_alerte: number
    est_actif: boolean
    categories: { nom: string } | null
    brands: { nom: string } | null
    stock_levels: { quantite: number }[]
}

interface Props { produits: Produit[] }

const TYPE_LABELS: Record<string, string> = {
    simple:   'Simple',
    ponderal: 'Pondéral',
    kit:      'Kit',
}

export default function TableauProduits({ produits }: Props) {
    const [recherche, setRecherche] = useState('')
    const [filtreType, setFiltreType] = useState('tous')

    const filtres = produits.filter(p => {
        const matchR = p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
            (p.sku ?? '').toLowerCase().includes(recherche.toLowerCase()) ||
            p.public_id.toLowerCase().includes(recherche.toLowerCase())
        const matchT = filtreType === 'tous' || p.type_produit === filtreType
        return matchR && matchT
    })

    const stockTotal = (p: Produit) =>
        p.stock_levels.reduce((acc, s) => acc + s.quantite, 0)

    return (
        <div className="space-y-4">
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, SKU, ID..."
                        value={recherche}
                        onChange={e => setRecherche(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
                <select
                    value={filtreType}
                    onChange={e => setFiltreType(e.target.value)}
                    className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="tous">Tous les types</option>
                    <option value="simple">Simple</option>
                    <option value="ponderal">Pondéral</option>
                    <option value="kit">Kit</option>
                </select>
            </div>

            {filtres.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                    Aucun produit trouvé.
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produit</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Catégorie</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Prix vente</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stock</th>
                                <th className="px-4 py-3" />
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                            {filtres.map(p => {
                                const stock = stockTotal(p)
                                const enAlerte = stock <= p.seuil_alerte
                                return (
                                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <Link href={`/stock/produits/${p.id}`} className="group flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                                                <div className="bg-[#15335a]/10 p-1.5 rounded group-hover:bg-[#15335a]/20 transition-colors">
                                                    <Package className="w-3.5 h-3.5 text-[#15335a]" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 group-hover:text-[#15335a] transition-colors">
                                                        {p.nom}
                                                    </p>
                                                    <p className="text-xs font-mono text-gray-400 mt-0.5">
                                                        {p.public_id}
                                                        {p.sku && ` · ${p.sku}`}
                                                    </p>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {TYPE_LABELS[p.type_produit]}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {p.categories?.nom ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            {formatMontant(p.prix_vente)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`flex items-center gap-1 text-xs font-medium ${
                                                enAlerte ? 'text-destructive' : 'text-green-600'
                                            }`}>
                                                {enAlerte && <AlertTriangle className="w-3.5 h-3.5" />}
                                                {stock} {p.unite}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs h-7"
                                                onClick={() => toggleActivationProduit(p.id, !p.est_actif)}
                                            >
                                                {p.est_actif ? 'Désactiver' : 'Activer'}
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}