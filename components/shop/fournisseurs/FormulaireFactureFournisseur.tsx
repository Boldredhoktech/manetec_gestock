'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { creerFactureFournisseur } from '@/actions/fournisseurs'
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import type { LigneFactureFourn } from '@/actions/fournisseurs'

interface Props {
    supplierId: string
    produits:   { id: string; nom: string; prix_achat: number; unite: string }[]
    entrepots:  { id: string; nom: string }[]
}

export default function FormulaireFactureFournisseur({ supplierId, produits, entrepots }: Props) {
    const router = useRouter()

    const [warehouseId,    setWarehouseId]    = useState(entrepots[0]?.id ?? '')
    const [referenceFourn, setReferenceFourn] = useState('')
    const [dateEcheance,   setDateEcheance]   = useState('')
    const [notes,          setNotes]          = useState('')
    const [lignes, setLignes] = useState<LigneFactureFourn[]>([
        { product_id: null, designation: '', quantite: 1, prix_unitaire: 0, tva_pct: 0 },
    ])
    const [enAttente, setEnAttente] = useState(false)
    const [erreur,    setErreur]    = useState<string>()
    const [succes,    setSucces]    = useState(false)

    const montantHT  = lignes.reduce((a, l) => a + l.quantite * l.prix_unitaire, 0)
    const montantTTC = lignes.reduce((a, l) => {
        const ht = l.quantite * l.prix_unitaire
        return a + ht + ht * l.tva_pct / 100
    }, 0)

    function ajouterLigne() {
        setLignes(p => [...p, { product_id: null, designation: '', quantite: 1, prix_unitaire: 0, tva_pct: 0 }])
    }

    function supprimerLigne(i: number) {
        setLignes(p => p.filter((_, idx) => idx !== i))
    }

    function mettreAJour(i: number, champ: keyof LigneFactureFourn, val: any) {
        setLignes(p => p.map((l, idx) => {
            if (idx !== i) return l
            const u = { ...l, [champ]: val }
            if (champ === 'product_id' && val) {
                const prod = produits.find(pr => pr.id === val)
                if (prod) { u.designation = prod.nom; u.prix_unitaire = prod.prix_achat }
            }
            return u
        }))
    }

    async function handleSoumettre() {
        const lignesValides = lignes.filter(l => l.designation.trim() && l.quantite > 0)
        if (lignesValides.length === 0) { setErreur('Ajoutez au moins une ligne valide.'); return }

        setEnAttente(true); setErreur(undefined)

        const res = await creerFactureFournisseur(
            supplierId, warehouseId || null, referenceFourn,
            dateEcheance || null, notes, lignesValides
        )
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }
        setSucces(true)
        setTimeout(() => router.push(`/stock/fournisseurs/${supplierId}/factures/${res.facture_id}`), 1000)
    }

    const ic = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 transition-colors'

    return (
        <div className="space-y-5 py-4">
            {erreur && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{erreur}
                </div>
            )}
            {succes && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />Facture créée. Redirection...
                </div>
            )}

            {/* Infos générales */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[#1a56db]">Informations générales</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Entrepôt (pour mise à jour stock)</label>
                        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={ic}>
                            <option value="">— Sans mise à jour stock —</option>
                            {entrepots.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Réf. facture fournisseur</label>
                        <input type="text" value={referenceFourn} onChange={e => setReferenceFourn(e.target.value)}
                               placeholder="N° de la facture reçue" className={ic} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Date d'échéance</label>
                        <input type="date" value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} className={ic} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Notes</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                               placeholder="Remarques..." className={ic} />
                    </div>
                </div>
            </div>

            {/* Lignes */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#1a56db]">Articles / Services</h2>
                    <button type="button" onClick={ajouterLigne}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1a56db] border border-[#1a56db]/30 rounded-lg hover:bg-[#1a56db]/5">
                        <Plus className="w-3.5 h-3.5" />Ajouter une ligne
                    </button>
                </div>

                {lignes.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-xl">
                        <div className="col-span-3">
                            <label className="text-xs text-gray-400 mb-1 block">Produit (optionnel)</label>
                            <select value={l.product_id ?? ''} onChange={e => mettreAJour(i, 'product_id', e.target.value || null)}
                                    className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none">
                                <option value="">— Libre —</option>
                                {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                            </select>
                        </div>
                        <div className="col-span-4">
                            <label className="text-xs text-gray-400 mb-1 block">Désignation *</label>
                            <input type="text" value={l.designation} onChange={e => mettreAJour(i, 'designation', e.target.value)}
                                   placeholder="Description" className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none" />
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs text-gray-400 mb-1 block">Qté</label>
                            <input type="number" min="0.001" step="0.001" value={l.quantite}
                                   onChange={e => mettreAJour(i, 'quantite', parseFloat(e.target.value) || 0)}
                                   className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-400 mb-1 block">Prix HT</label>
                            <input type="number" min="0" step="0.01" value={l.prix_unitaire}
                                   onChange={e => mettreAJour(i, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                                   className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none" />
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs text-gray-400 mb-1 block">TVA%</label>
                            <input type="number" min="0" max="100" step="0.5" value={l.tva_pct}
                                   onChange={e => mettreAJour(i, 'tva_pct', parseFloat(e.target.value) || 0)}
                                   className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none" />
                        </div>
                        <div className="col-span-1 pt-5 flex justify-center">
                            <button type="button" onClick={() => supprimerLigne(i)} disabled={lignes.length === 1}
                                    className="p-1.5 text-red-400 hover:text-red-600 disabled:opacity-30">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                <div className="flex justify-end gap-6 pt-2 border-t border-gray-100 text-sm">
                    <div className="text-right">
                        <p className="text-gray-400 text-xs">Montant HT</p>
                        <p className="font-bold text-gray-700">{montantHT.toLocaleString('fr-FR')} FCFA</p>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-400 text-xs">Total TTC</p>
                        <p className="text-xl font-black text-[#1a56db]">{montantTTC.toLocaleString('fr-FR')} FCFA</p>
                    </div>
                </div>
            </div>

            <button type="button" onClick={handleSoumettre} disabled={enAttente || succes}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 font-bold text-white rounded-xl disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #1a56db, #1648c0)' }}>
                {enAttente
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Création...</>
                    : 'Enregistrer la facture fournisseur'
                }
            </button>
        </div>
    )
}