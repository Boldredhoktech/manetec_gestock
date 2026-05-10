'use client'

import { useState } from 'react'
import { modifierPrixProduit } from '@/actions/produits'
import { formatMontant } from '@/lib/utils'
import { TrendingUp, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props { produit: any; shopId: string }

export default function CartePrixProduit({ produit }: Props) {
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
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-[#1a56db]/10 p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-[#1a56db]" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Grille tarifaire</h2>
                </div>
                {!editable ? (
                    <button onClick={() => setEditable(true)}
                            className="flex items-center gap-1.5 text-xs text-[#1a56db] font-bold hover:underline">
                        <Edit2 className="w-3.5 h-3.5" />
                        Modifier
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setEditable(false)}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
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

            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Prix d\'achat',   val: prixAchat,   set: setPrixAchat   },
                    { label: 'Prix de vente',   val: prixVente,   set: setPrixVente   },
                    { label: 'Prix de gros',    val: prixGros,    set: setPrixGros    },
                    { label: 'Prix minimum',    val: prixMin,     set: setPrixMin     },
                ].map(item => (
                    <div key={item.label} className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                        {editable ? (
                            <input type="number" min="0" step="0.01"
                                   value={item.val}
                                   onChange={e => item.set(parseFloat(e.target.value) || 0)}
                                   className="w-full text-sm font-bold text-gray-800 bg-white border border-[#1a56db]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30" />
                        ) : (
                            <p className="text-sm font-bold text-gray-800">
                                {item.val ? formatMontant(Number(item.val)) : '—'}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* Marge */}
            <div className="flex items-center justify-between p-3 bg-[#1a56db]/5 border border-[#1a56db]/20 rounded-xl">
                <span className="text-xs font-bold text-[#1a56db]">Marge brute estimée</span>
                <span className="text-sm font-black text-[#1a56db]">{marge}%</span>
            </div>
        </div>
    )
}