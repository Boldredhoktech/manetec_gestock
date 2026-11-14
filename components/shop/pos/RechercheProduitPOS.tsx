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
    photo_url?: string | null
    stock_levels: { quantite: number; warehouse_id?: string }[]
}

interface Props {
    warehouseId: string
    /** (mig 044) stock de tous les entrepôts : un article absent ici peut sortir d'ailleurs. */
    tousEntrepots?: boolean
    entrepots?:     { id: string; nom: string }[]
    onAjouter:   (produit: Produit) => void
    /** Forfait Pro et au-dessus : la photo du produit est affichée. Sinon,
     *  aucune zone image (14/11). */
    afficherImages?: boolean
}

export default function RechercheProduitPOS({ warehouseId, onAjouter, afficherImages = false, tousEntrepots = false, entrepots = [] }: Props) {
    const [terme,       setTerme]       = useState('')
    const [resultats,   setResultats]   = useState<Produit[]>([])
    const [chargement,  setChargement]  = useState(false)
    const [dejaAjoutes, setDejaAjoutes] = useState<Set<string>>(new Set())
    const inputRef = useRef<HTMLInputElement>(null)

    const rechercher = useCallback(async (valeur: string) => {
        if (valeur.trim().length < 2) { setResultats([]); return }
        setChargement(true)
        // shopId n'est plus un argument : il vient de la session.
        const data = await rechercherProduitsPOS(valeur, warehouseId, tousEntrepots)
        setResultats(data as Produit[])
        setChargement(false)
    }, [warehouseId, tousEntrepots])

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
            <div className="p-4 bg-card border-b border-border shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--primary-strong)]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={terme}
                        onChange={e => setTerme(e.target.value)}
                        placeholder="Rechercher un produit (nom, SKU, code-barres)..."
                        autoFocus
                        className="w-full pl-11 pr-4 py-3 bg-background border-2 border-primary/20 rounded-xl text-sm font-medium focus:outline-none focus:border-primary/40 focus:bg-white transition-all"
                    />
                    {terme && (
                        <button
                            onClick={() => { setTerme(''); setResultats([]); inputRef.current?.focus() }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-muted-foreground text-lg leading-none"
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
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[var(--primary-strong)] font-medium">Recherche...</span>
                    </div>

                ) : terme.length < 2 ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="w-20 h-20 bg-card rounded-2xl shadow-md flex items-center justify-center">
                            <Search className="w-9 h-9 text-[var(--primary-strong)]/30" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-muted-foreground">Rechercher un produit</p>
                            <p className="text-xs text-muted-foreground/80 mt-1">
                                Tapez le nom, SKU ou scannez un code-barres
                            </p>
                        </div>
                        <div className="flex gap-2 mt-2">
                            {['Nom', 'SKU', 'Code-barres'].map(t => (
                                <span key={t}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-card border border-border rounded-full text-xs text-muted-foreground/80">
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
                        <div className="w-16 h-16 bg-card rounded-2xl shadow-sm flex items-center justify-center">
                            <Package className="w-7 h-7 text-muted-foreground/80" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            Aucun produit pour "<strong>{terme}</strong>"
                        </p>
                        <p className="text-xs text-muted-foreground/80">Vérifiez l'orthographe ou essayez le SKU</p>
                    </div>

                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {resultats.map(p => {
                            const stock    = p.stock_levels.find(l => !l.warehouse_id || l.warehouse_id === warehouseId)?.quantite ?? 0
                            const ailleurs = stock > 0 ? undefined : p.stock_levels
                                .filter(l => l.warehouse_id && l.warehouse_id !== warehouseId && l.quantite > 0)
                                .sort((a, b) => b.quantite - a.quantite)[0]
                            const nomAilleurs = ailleurs ? (entrepots.find(e => e.id === ailleurs.warehouse_id)?.nom ?? 'autre entrepôt') : ''
                            const rupture  = stock <= 0 && !ailleurs
                            const vientAjout = dejaAjoutes.has(p.id)

                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    disabled={rupture}
                                    onClick={() => handleAjouter(p)}
                                    className={`relative text-left rounded-2xl border-2 p-3.5 transition-all duration-200 group ${
                                        rupture
                                            ? 'bg-[var(--surface2)] border-border opacity-60 cursor-not-allowed'
                                            : vientAjout
                                                ? 'bg-green-50 border-green-400 scale-95'
                                                : 'bg-card border-border hover:border-primary hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02]'
                                    }`}
                                >
                                    {/* Badge stock */}
                                    <div title={ailleurs ? `Absent ici : sortira de ${nomAilleurs}` : undefined}
                                         className={`absolute top-2.5 right-2.5 max-w-[70%] truncate px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        rupture
                                            ? 'bg-red-100 text-red-600'
                                            : ailleurs
                                                ? 'bg-blue-100 text-blue-700'
                                                : stock <= 5
                                                    ? 'bg-amber-100 text-amber-600'
                                                    : 'bg-green-100 text-green-600'
                                    }`}>
                                        {rupture ? 'RUPTURE' : ailleurs ? `${ailleurs.quantite} · ${nomAilleurs}` : `${stock}`}
                                    </div>

                                    {/* Badge IMEI */}
                                    {p.necessite_imei && !rupture && (
                                        <div className="absolute top-2.5 left-2.5 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[9px] font-black">
                                            IMEI
                                        </div>
                                    )}

                                    {/* Photo (forfait Pro) */}
                                    {afficherImages && p.photo_url && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.photo_url} alt="" loading="lazy"
                                             className={`w-full h-24 object-cover rounded-xl mb-3 bg-muted ${rupture ? 'grayscale' : ''}`} />
                                    )}

                                    {/* Icône type */}
                                    {!(afficherImages && p.photo_url) && <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                                        rupture
                                            ? 'bg-muted'
                                            : vientAjout
                                                ? 'bg-green-500'
                                                : 'bg-[var(--primary-soft)] group-hover:bg-[var(--primary-soft)]'
                                    }`}>
                                        {vientAjout
                                            ? <Plus className="w-5 h-5 text-white" />
                                            : <Package className={`w-5 h-5 ${rupture ? 'text-muted-foreground/80' : 'text-[var(--primary-strong)]'}`} />
                                        }
                                    </div>}

                                    {/* Nom */}
                                    <p className={`text-sm font-bold leading-tight mb-1 line-clamp-2 ${
                                        rupture ? 'text-muted-foreground/80' : 'text-foreground group-hover:text-primary'
                                    } transition-colors`}>
                                        {p.nom}
                                    </p>

                                    {/* SKU */}
                                    {p.sku && (
                                        <p className="text-xs text-muted-foreground/80 font-mono mb-2">{p.sku}</p>
                                    )}

                                    {/* Prix */}
                                    <div className="flex items-center justify-between mt-auto">
                                        <p className={`text-base font-black ${
                                            rupture ? 'text-muted-foreground/80' : 'text-[var(--primary-strong)]'
                                        }`}>
                                            {formatMontant(p.prix_vente)}
                                        </p>
                                        <span className={`text-xs ${
                                            rupture
                                                ? 'text-muted-foreground/80'
                                                : stock <= 5 && !rupture
                                                    ? 'text-amber-500 font-bold'
                                                    : 'text-muted-foreground/80'
                                        }`}>
                      {!rupture && `/${p.unite}`}
                    </span>
                                    </div>

                                    {/* Alerte stock faible */}
                                    {!rupture && !ailleurs && stock <= 5 && (
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