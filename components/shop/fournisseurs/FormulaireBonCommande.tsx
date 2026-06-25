'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { creerBonCommande } from '@/actions/fournisseurs'
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Produit {
    id: string; nom: string; public_id: string
    prix_achat: number; unite: string
}

interface Entrepot { id: string; nom: string }

interface Props {
    supplierId:    string
    fournisseurNom: string
    produits:      Produit[]
    entrepots:     Entrepot[]
}

interface Ligne {
    product_id:    string
    designation:   string
    quantite:      number
    prix_unitaire: number
}

export default function FormulaireBonCommande({
                                                  supplierId, fournisseurNom, produits, entrepots,
                                              }: Props) {
    const router = useRouter()

    const [warehouseId,   setWarehouseId]   = useState(entrepots[0]?.id ?? '')
    const [dateLivraison, setDateLivraison] = useState('')
    const [notes,         setNotes]         = useState('')
    const [lignes,        setLignes]        = useState<Ligne[]>([
        { product_id: '', designation: '', quantite: 1, prix_unitaire: 0 }
    ])
    const [enAttente,  setEnAttente]  = useState(false)
    const [erreur,     setErreur]     = useState<string>()
    const [succes,     setSucces]     = useState(false)

    const montantTotal = lignes.reduce((a, l) => a + l.quantite * l.prix_unitaire, 0)

    function ajouterLigne() {
        setLignes(prev => [...prev, { product_id: '', designation: '', quantite: 1, prix_unitaire: 0 }])
    }

    function supprimerLigne(i: number) {
        setLignes(prev => prev.filter((_, idx) => idx !== i))
    }

    function mettreAJourLigne(i: number, champ: keyof Ligne, valeur: string | number) {
        setLignes(prev => prev.map((l, idx) => {
            if (idx !== i) return l
            const updated = { ...l, [champ]: valeur }
            // Si on sélectionne un produit, pré-remplir les champs
            if (champ === 'product_id' && valeur) {
                const prod = produits.find(p => p.id === valeur)
                if (prod) {
                    updated.designation   = prod.nom
                    updated.prix_unitaire = prod.prix_achat
                }
            }
            return updated
        }))
    }

    async function handleSoumettre() {
        if (!warehouseId) { setErreur('Sélectionnez un entrepôt.'); return }
        if (lignes.length === 0) { setErreur('Ajoutez au moins une ligne.'); return }

        const lignesValides = lignes.filter(l => l.designation.trim() && l.quantite > 0)
        if (lignesValides.length === 0) {
            setErreur('Chaque ligne doit avoir une désignation et une quantité.')
            return
        }

        setEnAttente(true)
        setErreur(undefined)

        console.log('[BON COMMANDE] Soumission avec :', {
            supplierId, warehouseId, dateLivraison, notes,
            nbLignes: lignesValides.length,
            montantTotal,
        })

        const res = await creerBonCommande(
            supplierId,
            warehouseId,
            dateLivraison || null,
            notes,
            lignesValides.map(l => ({
                product_id:    l.product_id || '',
                designation:   l.designation.trim(),
                quantite:      l.quantite,
                prix_unitaire: l.prix_unitaire,
            }))
        )

        setEnAttente(false)

        if (res?.erreur) {
            console.error('[BON COMMANDE] Erreur :', res.erreur)
            setErreur(res.erreur)
            return
        }

        console.log('[BON COMMANDE] Succès :', res)
        setSucces(true)
        setTimeout(() => {
            router.push(`/stock/fournisseurs/${supplierId}/bons-de-commande`)
        }, 1000)
    }

    const inputClass = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 focus:border-[#15335a]/40 transition-colors'

    return (
        <div className="space-y-5 py-4">

            {erreur && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}

            {succes && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Bon de commande créé avec succès. Redirection...
                </div>
            )}

            {/* Informations générales */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[#15335a]">Informations générales</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Entrepôt de destination <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={warehouseId}
                            onChange={e => setWarehouseId(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">— Sélectionner —</option>
                            {entrepots.map(e => (
                                <option key={e.id} value={e.id}>{e.nom}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Date de livraison souhaitée</label>
                        <input
                            type="date"
                            value={dateLivraison}
                            onChange={e => setDateLivraison(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Notes / Conditions</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Conditions de livraison, remarques..."
                        className={inputClass + ' resize-none'}
                    />
                </div>
            </div>

            {/* Lignes de commande */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#15335a]">Articles commandés</h2>
                    <button
                        type="button"
                        onClick={ajouterLigne}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#15335a] border border-[#15335a]/30 rounded-lg hover:bg-[#15335a]/5 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter une ligne
                    </button>
                </div>

                <div className="overflow-x-auto">
                 <div className="space-y-3 min-w-[640px]">
                    {lignes.map((ligne, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-xl">

                            {/* Produit (optionnel) */}
                            <div className="col-span-3">
                                <label className="text-xs text-gray-400 mb-1 block">Produit (optionnel)</label>
                                <select
                                    value={ligne.product_id}
                                    onChange={e => mettreAJourLigne(i, 'product_id', e.target.value)}
                                    className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                >
                                    <option value="">— Libre —</option>
                                    {produits.map(p => (
                                        <option key={p.id} value={p.id}>{p.nom}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Désignation */}
                            <div className="col-span-4">
                                <label className="text-xs text-gray-400 mb-1 block">Désignation *</label>
                                <input
                                    type="text"
                                    value={ligne.designation}
                                    onChange={e => mettreAJourLigne(i, 'designation', e.target.value)}
                                    placeholder="Description de l'article"
                                    className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                />
                            </div>

                            {/* Quantité */}
                            <div className="col-span-2">
                                <label className="text-xs text-gray-400 mb-1 block">Quantité *</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={ligne.quantite}
                                    onChange={e => mettreAJourLigne(i, 'quantite', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                />
                            </div>

                            {/* Prix unitaire */}
                            <div className="col-span-2">
                                <label className="text-xs text-gray-400 mb-1 block">Prix unitaire</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={ligne.prix_unitaire}
                                    onChange={e => mettreAJourLigne(i, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                />
                            </div>

                            {/* Supprimer */}
                            <div className="col-span-1 pt-5 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => supprimerLigne(i)}
                                    disabled={lignes.length === 1}
                                    className="p-1.5 text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                 </div>
                </div>

                {/* Total */}
                <div className="flex justify-end pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">Total estimé</span>
                        <span className="text-xl font-black text-[#15335a]">
                            {montantTotal.toLocaleString('fr-FR')} FCFA
                        </span>
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={handleSoumettre}
                disabled={enAttente || succes}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 font-bold text-white rounded-xl transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #15335a, #0f2742)' }}
            >
                {enAttente
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Création en cours...</>
                    : <><Package className="w-4 h-4" />Créer le bon de commande</>
                }
            </button>
        </div>
    )
}