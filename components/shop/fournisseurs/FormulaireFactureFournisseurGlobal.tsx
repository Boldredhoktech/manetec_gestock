'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { creerFactureFournisseur } from '@/actions/fournisseurs'
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import type { LigneFactureFourn } from '@/actions/fournisseurs'

interface Produit {
    id: string; nom: string; prix_achat: number; unite: string
}

interface Props {
    fournisseurs: { id: string; nom: string; public_id: string }[]
    produits:     Produit[]
    entrepots:    { id: string; nom: string }[]
}

interface LigneForm {
    product_id:    string   // obligatoire
    quantite:      number   // entier uniquement
    prix_unitaire: number
    tva_pct:       number
}

export default function FormulaireFactureFournisseurGlobal({ fournisseurs, produits, entrepots }: Props) {
    const router = useRouter()

    const [supplierId,     setSupplierId]     = useState('')
    const [warehouseId,    setWarehouseId]    = useState(entrepots[0]?.id ?? '')
    const [referenceFourn, setReferenceFourn] = useState('')
    const [dateEcheance,   setDateEcheance]   = useState('')
    const [notes,          setNotes]          = useState('')
    const [lignes, setLignes] = useState<LigneForm[]>([
        { product_id: '', quantite: 1, prix_unitaire: 0, tva_pct: 0 },
    ])
    const [enAttente, setEnAttente] = useState(false)
    const [erreur,    setErreur]    = useState<string>()
    const [succes,    setSucces]    = useState(false)

    // Produits déjà sélectionnés pour éviter les doublons
    const produitsDejaPris = new Set(lignes.map(l => l.product_id).filter(Boolean))

    const montantHT  = lignes.reduce((a, l) => a + l.quantite * l.prix_unitaire, 0)
    const montantTTC = lignes.reduce((a, l) => {
        const ht = l.quantite * l.prix_unitaire
        return a + ht + ht * l.tva_pct / 100
    }, 0)

    function ajouterLigne() {
        setLignes(p => [...p, { product_id: '', quantite: 1, prix_unitaire: 0, tva_pct: 0 }])
    }

    function supprimerLigne(i: number) {
        if (lignes.length === 1) return
        setLignes(p => p.filter((_, idx) => idx !== i))
    }

    function choisirProduit(i: number, productId: string) {
        const prod = produits.find(p => p.id === productId)
        setLignes(prev => prev.map((l, idx) => {
            if (idx !== i) return l
            return {
                ...l,
                product_id:    productId,
                prix_unitaire: prod?.prix_achat ?? 0,
            }
        }))
    }

    function mettreAJour(i: number, champ: 'quantite' | 'prix_unitaire' | 'tva_pct', val: number) {
        setLignes(p => p.map((l, idx) => idx !== i ? l : { ...l, [champ]: val }))
    }

    async function handleSoumettre() {
        if (!supplierId) { setErreur('Sélectionnez un fournisseur.'); return }

        const lignesValides = lignes.filter(l => l.product_id && l.quantite > 0)
        if (!lignesValides.length) {
            setErreur('Chaque ligne doit avoir un produit sélectionné et une quantité > 0.')
            return
        }

        // Vérifier pas de produit en double
        const ids = lignesValides.map(l => l.product_id)
        if (new Set(ids).size !== ids.length) {
            setErreur('Un produit ne peut pas être sélectionné deux fois. Regroupez les quantités.')
            return
        }

        setEnAttente(true); setErreur(undefined)

        // Construire les lignes avec designation depuis le produit
        const lignesFinales: LigneFactureFourn[] = lignesValides.map(l => {
            const prod = produits.find(p => p.id === l.product_id)!
            return {
                product_id:    l.product_id,
                designation:   prod.nom,
                quantite:      l.quantite,
                prix_unitaire: l.prix_unitaire,
                tva_pct:       l.tva_pct,
            }
        })

        const res = await creerFactureFournisseur(
            supplierId, warehouseId || null, referenceFourn,
            dateEcheance || null, notes, lignesFinales
        )
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }
        setSucces(true)
        setTimeout(() => router.push(`/stock/factures-fournisseurs/${(res as any).facture_id}`), 1000)
    }

    const ic = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 transition-colors'

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

            {/* Informations générales */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[#15335a]">Informations générales</h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                        Fournisseur <span className="text-red-500">*</span>
                    </label>
                    <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={ic}>
                        <option value="">— Sélectionnez le fournisseur —</option>
                        {fournisseurs.map(f => (
                            <option key={f.id} value={f.id}>{f.nom} ({f.public_id})</option>
                        ))}
                    </select>
                    {fournisseurs.length === 0 && (
                        <p className="text-xs text-amber-600">
                            Aucun fournisseur actif.{' '}
                            <a href="/stock/fournisseurs" className="font-bold underline">Créer un fournisseur →</a>
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Entrepôt (mise à jour stock)</label>
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

            {/* Lignes — produits obligatoires */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-[#15335a]">Articles commandés</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Seuls les produits existants dans votre catalogue sont acceptés.
                        </p>
                    </div>
                    <button type="button" onClick={ajouterLigne}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#15335a] border border-[#15335a]/30 rounded-lg hover:bg-[#15335a]/5">
                        <Plus className="w-3.5 h-3.5" />Ajouter un article
                    </button>
                </div>

                {lignes.map((l, i) => {
                    const produitChoisi = produits.find(p => p.id === l.product_id)
                    return (
                        <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3">

                            {/* Ligne 1 : Sélection produit */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-600">
                                    Produit <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={l.product_id}
                                    onChange={e => choisirProduit(i, e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                >
                                    <option value="">— Sélectionnez un produit —</option>
                                    {produits.map(p => (
                                        <option
                                            key={p.id}
                                            value={p.id}
                                            disabled={produitsDejaPris.has(p.id) && p.id !== l.product_id}
                                        >
                                            {p.nom} ({p.unite}) — Prix achat : {p.prix_achat} FCFA
                                            {produitsDejaPris.has(p.id) && p.id !== l.product_id ? ' ✓ déjà ajouté' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Ligne 2 : Quantité, Prix, TVA */}
                            {l.product_id && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600">
                                            Quantité *
                                            <span className="text-gray-400 font-normal ml-1">
                                                ({produitChoisi?.unite})
                                            </span>
                                        </label>
                                        {/* ✅ Entier uniquement — step="1" */}
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={l.quantite}
                                            onChange={e => mettreAJour(i, 'quantite', Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                        />
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <label className="text-xs font-semibold text-gray-600">
                                            Prix unitaire HT (FCFA)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={l.prix_unitaire}
                                            onChange={e => mettreAJour(i, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600">TVA %</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={l.tva_pct}
                                            onChange={e => mettreAJour(i, 'tva_pct', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Sous-total ligne + bouton supprimer */}
                            <div className="flex items-center justify-between">
                                {l.product_id && l.quantite > 0 && l.prix_unitaire > 0 ? (
                                    <p className="text-xs font-bold text-[#15335a]">
                                        Sous-total : {(l.quantite * l.prix_unitaire * (1 + l.tva_pct / 100)).toLocaleString('fr-FR')} FCFA TTC
                                    </p>
                                ) : (
                                    <span />
                                )}
                                <button
                                    type="button"
                                    onClick={() => supprimerLigne(i)}
                                    disabled={lignes.length === 1}
                                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Retirer
                                </button>
                            </div>
                        </div>
                    )
                })}

                {/* Totaux */}
                <div className="flex justify-end gap-6 pt-3 border-t border-gray-100">
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Montant HT</p>
                        <p className="text-sm font-bold text-gray-700">{montantHT.toLocaleString('fr-FR')} FCFA</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Total TTC</p>
                        <p className="text-xl font-black text-[#15335a]">{montantTTC.toLocaleString('fr-FR')} FCFA</p>
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={handleSoumettre}
                disabled={enAttente || succes || !supplierId}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 font-bold text-white rounded-xl disabled:opacity-50 transition-all hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, #15335a, #0f2742)' }}
            >
                {enAttente
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Création en cours...</>
                    : 'Enregistrer la facture fournisseur'
                }
            </button>
        </div>
    )
}