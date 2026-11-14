'use client'

import { useState } from 'react'
import { modifierPrixProduit } from '@/actions/produits'
import { formatMontant } from '@/lib/utils'
import { TrendingUp, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'

interface Props { produit: any; shopId: string; peutVoirCout?: boolean }

export default function CartePrixProduit({ produit, peutVoirCout = false }: Props) {
    const [editable, setEditable] = useState(false)
    const [prixAchat,   setPrixAchat]   = useState(produit.prix_achat)
    const [prixVente,   setPrixVente]   = useState(produit.prix_vente)
    const [prixGros,    setPrixGros]    = useState(produit.prix_gros ?? '')
    const [prixMin,     setPrixMin]     = useState(produit.prix_minimum ?? '')
    const [enAttente,   setEnAttente]   = useState(false)
    const [succes,      setSucces]      = useState(false)

    const marge = produit.prix_achat > 0
        ? (((produit.prix_vente - produit.prix_achat) / produit.prix_achat) * 100).toFixed(1)
        : '—'

    async function handleSauvegarder() {
        setEnAttente(true)
        const formData = new FormData()
        formData.set('productId',  produit.id)
        formData.set('prixAchat',  String(prixAchat))
        formData.set('prixVente',  String(prixVente))
        formData.set('prixGros',   String(prixGros))
        formData.set('prixMinimum', String(prixMin))
        await modifierPrixProduit(formData)
        setEnAttente(false)
        setEditable(false)
        setSucces(true)
        setTimeout(() => setSucces(false), 3000)
    }

    return (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-[var(--primary-soft)] p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-[var(--primary-strong)]" />
                    </div>
                    <h2 className="text-sm font-bold text-foreground">Grille tarifaire</h2>
                </div>
                {!editable ? (
                    <button onClick={() => setEditable(true)}
                            className="flex items-center gap-1.5 text-xs text-[var(--primary-strong)] font-bold hover:underline">
                        <Edit2 className="w-3.5 h-3.5" />
                        Modifier
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setEditable(false)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                            Annuler
                        </button>
                        <button onClick={handleSauvegarder} disabled={enAttente}
                                className="flex items-center gap-1 text-xs text-green-600 font-bold hover:text-green-700">
                            <Check className="w-3.5 h-3.5" />
                            {enAttente ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                    </div>
                )}
            </div>

            {succes && (
                <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium">
                    ✓ Prix mis à jour avec succès
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                    // Le prix d'achat n'apparaît que pour les rôles autorisés
                    // à voir les coûts (le vendeur voit la vente, pas la marge).
                    ...(peutVoirCout
                        ? [{ label: 'Prix d\'achat', val: prixAchat, set: setPrixAchat }]
                        : []),
                    { label: 'Prix de vente',   val: prixVente,   set: setPrixVente   },
                    { label: 'Prix de gros',    val: prixGros,    set: setPrixGros    },
                    { label: 'Prix minimum',    val: prixMin,     set: setPrixMin     },
                ].map(item => (
                    <div key={item.label} className="p-3 bg-[var(--surface2)] rounded-xl">
                        <p className="text-xs text-muted-foreground/80 mb-1">{item.label}</p>
                        {editable ? (
                            <ChampNombre value={item.val} onChange={v => item.set(v)} className="w-full text-sm font-bold text-foreground bg-card border border-primary/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                        ) : (
                            <p className="text-sm font-bold text-foreground">
                                {item.val ? formatMontant(Number(item.val)) : '—'}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* Marge */}
            {peutVoirCout && (
                <div className="flex items-center justify-between p-3 bg-[var(--primary-soft)] border border-primary/20 rounded-xl">
                    <span className="text-xs font-bold text-[var(--primary-strong)]">Marge brute estimée</span>
                    <span className="text-sm font-black text-[var(--primary-strong)]">{marge}%</span>
                </div>
            )}
        </div>
    )
}