'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { creerBonCommande } from '@/actions/fournisseurs'
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'

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
            setErreur(res.erreur)
            return
        }

        setSucces(true)
        setTimeout(() => {
            router.push(`/stock/bons-de-commande/${res.po_id}`)
        }, 1000)
    }

    const inputClass = 'w-full px-3 py-2.5 bg-[var(--surface2)] border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 transition-colors'

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
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[var(--primary-strong)]">Informations générales</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
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
                        <label className="text-sm font-medium text-foreground">Date de livraison souhaitée</label>
                        <input
                            type="date"
                            value={dateLivraison}
                            onChange={e => setDateLivraison(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Notes / Conditions</label>
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
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[var(--primary-strong)]">Articles commandés</h2>
                    <button
                        type="button"
                        onClick={ajouterLigne}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--primary-strong)] border border-primary/30 rounded-lg hover:bg-[var(--primary-soft)] transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter une ligne
                    </button>
                </div>

                <div className="overflow-x-auto">
                 <div className="space-y-3 min-w-[640px]">
                    {lignes.map((ligne, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 bg-[var(--surface2)] rounded-xl">

                            {/* Produit (optionnel) */}
                            <div className="col-span-3">
                                <label className="text-xs text-muted-foreground/80 mb-1 block">Produit (optionnel)</label>
                                <select
                                    value={ligne.product_id}
                                    onChange={e => mettreAJourLigne(i, 'product_id', e.target.value)}
                                    className="w-full px-2 py-2 bg-card border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                                >
                                    <option value="">— Libre —</option>
                                    {produits.map(p => (
                                        <option key={p.id} value={p.id}>{p.nom}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Désignation */}
                            <div className="col-span-4">
                                <label className="text-xs text-muted-foreground/80 mb-1 block">Désignation *</label>
                                <input
                                    type="text"
                                    value={ligne.designation}
                                    onChange={e => mettreAJourLigne(i, 'designation', e.target.value)}
                                    placeholder="Description de l'article"
                                    className="w-full px-2 py-2 bg-card border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                                />
                            </div>

                            {/* Quantité */}
                            <div className="col-span-2">
                                <label className="text-xs text-muted-foreground/80 mb-1 block">Quantité *</label>
                                <ChampNombre value={ligne.quantite} onChange={v => mettreAJourLigne(i, 'quantite', v)} entier className="w-full px-2 py-2 bg-card border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring/30" />
                            </div>

                            {/* Prix unitaire */}
                            <div className="col-span-2">
                                <label className="text-xs text-muted-foreground/80 mb-1 block">Prix unitaire</label>
                                <ChampNombre value={ligne.prix_unitaire} onChange={v => mettreAJourLigne(i, 'prix_unitaire', v)} className="w-full px-2 py-2 bg-card border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring/30" />
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
                <div className="flex justify-end pt-2 border-t border-border">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">Total estimé</span>
                        <span className="text-xl font-black text-[var(--primary-strong)]">
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
                style={{ background: 'var(--primary)' }}
            >
                {enAttente
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Création en cours...</>
                    : <><Package className="w-4 h-4" />Créer le bon de commande</>
                }
            </button>
        </div>
    )
}