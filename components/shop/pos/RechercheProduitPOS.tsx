'use client'

import { useState, useCallback, useRef } from 'react'
import { rechercherProduitsPOS } from '@/actions/ventes'
import {
    Search, Plus, AlertTriangle, Package,
    Zap, Tag, Barcode,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

interface Produit {
    id: string; nom: string; prix_vente: number
    prix_minimum: number | null; tva_pct: number
    remise_max_pct: number | null; unite: string
    sku: string | null; type_produit: string
    necessite_imei: boolean; necessite_serie: boolean
    stock_levels: { quantite: number }[]
}

interface Props {
    shopId:      string
    warehouseId: string
    onAjouter:   (produit: Produit) => void
}

export default function RechercheProduitPOS({ shopId, warehouseId, onAjouter }: Props) {
    const [terme,       setTerme]       = useState('')
    const [resultats,   setResultats]   = useState<Produit[]>([])
    const [chargement,  setChargement]  = useState(false)
    const [dejaAjoutes, setDejaAjoutes] = useState<Set<string>>(new Set())
    const inputRef = useRef<HTMLInputElement>(null)

    const rechercher = useCallback(async (valeur: string) => {
        if (valeur.trim().length < 2) { setResultats([]); return }
        setChargement(true)
        const data = await rechercherProduitsPOS(valeur, shopId, warehouseId)
        setResultats(data as Produit[])
        setChargement(false)
    }, [shopId, warehouseId])

    useDebounce(terme, 250, rechercher)

    function handleAjouter(p: Produit) {
        onAjouter(p)
        setDejaAjoutes(prev => new Set([...prev, p.id]))
        setTimeout(() => {
            setDejaAjoutes(prev => { const n = new Set(prev); n.delete(p.id); return n })
        }, 800)
        setTerme('')
        setResultats([])
        inputRef.current?.focus()
    }

    return (
        <div className="flex flex-col h-full">

            {/* Barre de recherche */}
            <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1a56db]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={terme}
                        onChange={e => setTerme(e.target.value)}
                        placeholder="Rechercher un produit (nom, SKU, code-barres)..."
                        autoFocus
                        className="w-full pl-11 pr-4 py-3 bg-[#f0f4ff] border-2 border-[#1a56db]/20 rounded-xl text-sm font-medium focus:outline-none focus:border-[#1a56db]/60 focus:bg-white transition-all"
                    />
                    {terme && (
                        <button
                            onClick={() => { setTerme(''); setResultats([]); inputRef.current?.focus() }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* Résultats */}
            <div className="flex-1 overflow-y-auto p-4">

                {chargement ? (
                    <div className="flex items-center justify-center py-16 gap-3">
                        <div className="w-6 h-6 border-2 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[#1a56db] font-medium">Recherche...</span>
                    </div>

                ) : terme.length < 2 ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-md flex items-center justify-center">
                            <Search className="w-9 h-9 text-[#1a56db]/30" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-gray-500">Rechercher un produit</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Tapez le nom, SKU ou scannez un code-barres
                            </p>
                        </div>
                        <div className="flex gap-2 mt-2">
                            {['Nom', 'SKU', 'Code-barres'].map(t => (
                                <span key={t}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-400">
                  {t === 'Code-barres'
                      ? <Barcode className="w-3 h-3" />
                      : t === 'SKU'
                          ? <Tag className="w-3 h-3" />
                          : <Package className="w-3 h-3" />
                  }
                                    {t}
                </span>
                            ))}
                        </div>
                    </div>

                ) : resultats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                            <Package className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-500">
                            Aucun produit pour "<strong>{terme}</strong>"
                        </p>
                        <p className="text-xs text-gray-400">Vérifiez l'orthographe ou essayez le SKU</p>
                    </div>

                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {resultats.map(p => {
                            const stock    = p.stock_levels[0]?.quantite ?? 0
                            const rupture  = stock <= 0
                            const vientAjout = dejaAjoutes.has(p.id)

                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    disabled={rupture}
                                    onClick={() => handleAjouter(p)}
                                    className={`relative text-left rounded-2xl border-2 p-3.5 transition-all duration-200 group ${
                                        rupture
                                            ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                                            : vientAjout
                                                ? 'bg-green-50 border-green-400 scale-95'
                                                : 'bg-white border-gray-200 hover:border-[#1a56db] hover:shadow-lg hover:shadow-[#1a56db]/10 hover:scale-[1.02]'
                                    }`}
                                >
                                    {/* Badge stock */}
                                    <div className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        rupture
                                            ? 'bg-red-100 text-red-600'
                                            : stock <= 5
                                                ? 'bg-amber-100 text-amber-600'
                                                : 'bg-green-100 text-green-600'
                                    }`}>
                                        {rupture ? 'RUPTURE' : `${stock}`}
                                    </div>

                                    {/* Badge IMEI */}
                                    {p.necessite_imei && !rupture && (
                                        <div className="absolute top-2.5 left-2.5 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[9px] font-black">
                                            IMEI
                                        </div>
                                    )}

                                    {/* Icône type */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                                        rupture
                                            ? 'bg-gray-100'
                                            : vientAjout
                                                ? 'bg-green-500'
                                                : 'bg-[#1a56db]/10 group-hover:bg-[#1a56db]/20'
                                    }`}>
                                        {vientAjout
                                            ? <Plus className="w-5 h-5 text-white" />
                                            : <Package className={`w-5 h-5 ${rupture ? 'text-gray-400' : 'text-[#1a56db]'}`} />
                                        }
                                    </div>

                                    {/* Nom */}
                                    <p className={`text-sm font-bold leading-tight mb-1 line-clamp-2 ${
                                        rupture ? 'text-gray-400' : 'text-gray-800 group-hover:text-[#1a56db]'
                                    } transition-colors`}>
                                        {p.nom}
                                    </p>

                                    {/* SKU */}
                                    {p.sku && (
                                        <p className="text-xs text-gray-400 font-mono mb-2">{p.sku}</p>
                                    )}

                                    {/* Prix */}
                                    <div className="flex items-center justify-between mt-auto">
                                        <p className={`text-base font-black ${
                                            rupture ? 'text-gray-400' : 'text-[#1a56db]'
                                        }`}>
                                            {formatMontant(p.prix_vente)}
                                        </p>
                                        <span className={`text-xs ${
                                            rupture
                                                ? 'text-gray-400'
                                                : stock <= 5 && !rupture
                                                    ? 'text-amber-500 font-bold'
                                                    : 'text-gray-400'
                                        }`}>
                      {!rupture && `/${p.unite}`}
                    </span>
                                    </div>

                                    {/* Alerte stock faible */}
                                    {!rupture && stock <= 5 && (
                                        <div className="flex items-center gap-1 mt-2 text-amber-500">
                                            <AlertTriangle className="w-3 h-3" />
                                            <span className="text-[10px] font-bold">Stock faible</span>
                                        </div>
                                    )}

                                    {/* Overlay ajout */}
                                    {vientAjout && (
                                        <div className="absolute inset-0 bg-green-500/10 rounded-2xl flex items-center justify-center">
                                            <div className="bg-green-500 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                                                <Plus className="w-3 h-3" />
                                                Ajouté !
                                            </div>
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