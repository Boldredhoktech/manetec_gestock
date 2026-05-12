'use client'

import { useState } from 'react'
import { enregistrerReception } from '@/actions/fournisseurs'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Produit { id: string; nom: string; unite: string; prix_achat: number }
interface Entrepot { id: string; nom: string; est_defaut: boolean }
interface BonItem {
    id: string; product_id: string; designation: string
    quantite_cmd: number; quantite_recue: number; prix_unitaire: number
    products: { nom: string; unite: string } | null
}
interface Bon { id: string; public_id: string; purchase_order_items: BonItem[] }

interface LigneReception {
    product_id: string; poi_id: string | null
    designation: string; quantite: number; prix_unitaire: number
}

interface Props {
    fournisseurId: string
    produits:      Produit[]
    entrepots:     Entrepot[]
    bons:          Bon[]
}

export default function FormulaireReception({ fournisseurId, produits, entrepots, bons }: Props) {
    const router = useRouter()
    const entrepotDefaut = entrepots.find(e => e.est_defaut) ?? entrepots[0]

    const [warehouseId, setWarehouseId]   = useState(entrepotDefaut?.id ?? '')
    const [bonSelId, setBonSelId]         = useState('')
    const [lignes, setLignes]             = useState<LigneReception[]>([])
    const [notes, setNotes]               = useState('')
    const [enAttente, setEnAttente]       = useState(false)
    const [erreur, setErreur]             = useState<string>()
    const [succes, setSucces]             = useState<string>()

    // Charger lignes depuis le bon sélectionné
    function chargerDepuisBon(bonId: string) {
        setBonSelId(bonId)
        if (!bonId) { setLignes([]); return }
        const bon = bons.find(b => b.id === bonId)
        if (!bon) return
        const lignesRestantes = bon.purchase_order_items
            .filter(i => i.quantite_recue < i.quantite_cmd)
            .map(i => ({
                product_id:    i.product_id,
                poi_id:        i.id,
                designation:   i.designation,
                quantite:      i.quantite_cmd - i.quantite_recue,
                prix_unitaire: i.prix_unitaire,
            }))
        setLignes(lignesRestantes)
    }

    function ajouterLigne() {
        setLignes(prev => [...prev, {
            product_id: '', poi_id: null,
            designation: '', quantite: 1, prix_unitaire: 0,
        }])
    }

    function modifierLigne(i: number, champ: keyof LigneReception, valeur: any) {
        setLignes(prev => prev.map((l, idx) => {
            if (idx !== i) return l
            const updated = { ...l, [champ]: valeur }
            if (champ === 'product_id' && valeur) {
                const produit = produits.find(p => p.id === valeur)
                if (produit) {
                    updated.designation   = produit.nom
                    updated.prix_unitaire = produit.prix_achat
                }
            }
            return updated
        }))
    }

    const montantTotal = lignes.reduce((acc, l) => acc + l.quantite * l.prix_unitaire, 0)

    async function handleSoumettre() {
        if (lignes.length === 0) { setErreur('Ajoutez au moins une ligne.'); return }
        if (!warehouseId) { setErreur('Sélectionnez un entrepôt.'); return }

        setEnAttente(true)
        setErreur(undefined)

        const res = await enregistrerReception(
            fournisseurId, warehouseId, bonSelId || null, notes, lignes
        )

        setEnAttente(false)
        if (res?.erreur) { setErreur(res.erreur); return }
        setSucces(res.public_id!)
        setTimeout(() => router.push(`/stock/fournisseurs/${fournisseurId}`), 1500)
    }

    return (
        <div className="space-y-5">

            {erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}
            {succes && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Réception {succes} enregistrée. Redirection...
                </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Configuration</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Entrepôt</label>
                        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                            {entrepots.map(e => (
                                <option key={e.id} value={e.id}>{e.nom}{e.est_defaut ? ' (défaut)' : ''}</option>
                            ))}
                        </select>
                    </div>
                    {bons.length > 0 && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                Bon de commande (optionnel)
                            </label>
                            <select value={bonSelId} onChange={e => chargerDepuisBon(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                <option value="">— Sans bon de commande —</option>
                                {bons.map(b => (
                                    <option key={b.id} value={b.id}>{b.public_id}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Notes</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                           placeholder="Notes optionnelles"
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Articles reçus</h2>

                {lignes.map((ligne, i) => (
                    <div key={i} className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
                        <div className="flex gap-2">
                            <select value={ligne.product_id}
                                    onChange={e => modifierLigne(i, 'product_id', e.target.value)}
                                    className="flex-1 px-2 py-1.5 bg-background border border-input rounded text-xs focus:outline-none">
                                <option value="">— Produit —</option>
                                {produits.map(p => (
                                    <option key={p.id} value={p.id}>{p.nom}</option>
                                ))}
                            </select>
                            <button type="button" onClick={() => setLignes(prev => prev.filter((_, idx) => idx !== i))}
                                    className="text-destructive p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-xs text-muted-foreground">Désignation</label>
                                <input type="text" value={ligne.designation}
                                       onChange={e => modifierLigne(i, 'designation', e.target.value)}
                                       placeholder="Désignation"
                                       className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Quantité</label>
                                <input type="number" min="1" step="1" value={ligne.quantite}
                                       onChange={e => modifierLigne(i, 'quantite', parseFloat(e.target.value) || 1)}
                                       className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Prix unitaire</label>
                                <input type="number" min="0" step="0.01" value={ligne.prix_unitaire}
                                       onChange={e => modifierLigne(i, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                                       className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5" />
                            </div>
                        </div>
                        <div className="text-right text-xs font-medium text-foreground">
                            {formatMontant(ligne.quantite * ligne.prix_unitaire)}
                        </div>
                    </div>
                ))}

                <Button type="button" variant="outline" size="sm"
                        onClick={ajouterLigne} className="w-full">
                    <Plus className="w-3.5 h-3.5 mr-2" />
                    Ajouter un article
                </Button>

                {lignes.length > 0 && (
                    <div className="text-right text-sm font-bold text-foreground border-t border-border pt-3">
                        Total : {formatMontant(montantTotal)}
                    </div>
                )}
            </div>

            <Button onClick={handleSoumettre}
                    disabled={enAttente || lignes.length === 0} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                    : 'Enregistrer la réception'
                }
            </Button>
        </div>
    )
}