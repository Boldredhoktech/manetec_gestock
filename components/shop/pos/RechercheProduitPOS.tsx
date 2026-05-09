'use client'

import { useState, useCallback, useRef } from 'react'
import { rechercherProduitsPOS } from '@/actions/ventes'
import { Search, Plus, AlertTriangle } from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

interface Produit {
    id: string
    nom: string
    prix_vente: number
    prix_minimum: number | null
    tva_pct: number
    remise_max_pct: number | null
    unite: string
    sku: string | null
    stock_levels: { quantite: number }[]
}

interface Props {
    shopId:      string
    warehouseId: string
    onAjouter:   (produit: Produit) => void
}

export default function RechercheProduitPOS({ shopId, warehouseId, onAjouter }: Props) {
    const [terme, setTerme] = useState('')
    const [resultats, setResultats] = useState<Produit[]>([])
    const [chargement, setChargement] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const rechercher = useCallback(async (valeur: string) => {
        if (valeur.trim().length < 2) {
            setResultats([])
            return
        }
        setChargement(true)
        const data = await rechercherProduitsPOS(valeur, shopId, warehouseId)
        setResultats(data as Produit[])
        setChargement(false)
    }, [shopId, warehouseId])

    useDebounce(terme, 300, rechercher)

    return (
        <div className="flex flex-col h-full">
            {/* Barre de recherche */}
            <div className="p-4 border-b border-border">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={terme}
                        onChange={e => setTerme(e.target.value)}
                        placeholder="Rechercher un produit (nom, SKU, code-barres)..."
                        autoFocus
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
            </div>

            {/* Résultats */}
            <div className="flex-1 overflow-y-auto p-4">
                {chargement ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        Recherche...
                    </div>
                ) : terme.length < 2 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
                        <Search className="w-8 h-8 mx-auto opacity-30" />
                        <p>Tapez pour rechercher un produit</p>
                    </div>
                ) : resultats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        Aucun produit trouvé pour "{terme}"
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {resultats.map(p => {
                            const stock = p.stock_levels[0]?.quantite ?? 0
                            const rupture = stock <= 0
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    disabled={rupture}
                                    onClick={() => {
                                        onAjouter(p)
                                        setTerme('')
                                        setResultats([])
                                        inputRef.current?.focus()
                                    }}
                                    className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed space-y-2"
                                >
                                    <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                                        {p.nom}
                                    </p>
                                    {p.sku && (
                                        <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>
                                    )}
                                    <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">
                      {formatMontant(p.prix_vente)}
                    </span>
                                        <span className={`flex items-center gap-1 text-xs ${
                                            rupture ? 'text-destructive' :
                                                stock <= 5 ? 'text-amber-500' : 'text-green-600'
                                        }`}>
                      {rupture && <AlertTriangle className="w-3 h-3" />}
                                            {rupture ? 'Rupture' : `${stock} ${p.unite}`}
                    </span>
                                    </div>
                                    {!rupture && (
                                        <div className="flex items-center justify-center gap-1 bg-primary/10 text-primary rounded-lg py-1 text-xs font-medium">
                                            <Plus className="w-3.5 h-3.5" />
                                            Ajouter
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}