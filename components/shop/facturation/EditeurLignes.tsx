'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LigneFacture } from '@/actions/facturation'
import { formatMontant } from '@/lib/utils'

interface Produit {
    id: string
    nom: string
    prix_vente: number
    tva_pct: number
    unite: string
}

interface Props {
    lignes:     LigneFacture[]
    onChanger:  (lignes: LigneFacture[]) => void
    produits:   Produit[]
}

export default function EditeurLignes({ lignes, onChanger, produits }: Props) {

    function ajouterLigne() {
        onChanger([...lignes, {
            product_id: null, designation: '',
            quantite: 1, prix_unitaire: 0,
            remise_pct: 0, tva_pct: 0,
        }])
    }

    function retirerLigne(index: number) {
        onChanger(lignes.filter((_, i) => i !== index))
    }

    function modifierLigne(index: number, champ: keyof LigneFacture, valeur: any) {
        const nouvelles = lignes.map((l, i) => {
            if (i !== index) return l
            const updated = { ...l, [champ]: valeur }
            if (champ === 'product_id' && valeur) {
                const produit = produits.find(p => p.id === valeur)
                if (produit) {
                    updated.designation  = produit.nom
                    updated.prix_unitaire = produit.prix_vente
                    updated.tva_pct      = produit.tva_pct
                }
            }
            return updated
        })
        onChanger(nouvelles)
    }

    const total = lignes.reduce((acc, l) => {
        const ht  = l.prix_unitaire * l.quantite * (1 - l.remise_pct / 100)
        const tva = ht * l.tva_pct / 100
        return acc + ht + tva
    }, 0)

    return (
        <div className="space-y-3">
            {lignes.map((ligne, i) => (
                <div key={i} className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
                    <div className="flex gap-2">
                        {produits.length > 0 && (
                            <select
                                value={ligne.product_id ?? ''}
                                onChange={e => modifierLigne(i, 'product_id', e.target.value || null)}
                                className="w-40 shrink-0 px-2 py-1.5 bg-background border border-input rounded text-xs focus:outline-none"
                            >
                                <option value="">— Produit —</option>
                                {produits.map(p => (
                                    <option key={p.id} value={p.id}>{p.nom}</option>
                                ))}
                            </select>
                        )}
                        <input
                            type="text"
                            placeholder="Désignation *"
                            value={ligne.designation}
                            onChange={e => modifierLigne(i, 'designation', e.target.value)}
                            className="flex-1 px-2 py-1.5 bg-background border border-input rounded text-xs focus:outline-none"
                        />
                        <button type="button" onClick={() => retirerLigne(i)}
                                className="text-destructive p-1 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <label className="text-xs text-muted-foreground">Qté</label>
                            <input type="number" min="1" step="1"
                                   value={ligne.quantite}
                                   onChange={e => modifierLigne(i, 'quantite', parseFloat(e.target.value) || 1)}
                                   className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Prix HT</label>
                            <input type="number" min="0" step="0.01"
                                   value={ligne.prix_unitaire}
                                   onChange={e => modifierLigne(i, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                                   className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Remise (%)</label>
                            <input type="number" min="0" max="100" step="0.5"
                                   value={ligne.remise_pct}
                                   onChange={e => modifierLigne(i, 'remise_pct', parseFloat(e.target.value) || 0)}
                                   className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">TVA (%)</label>
                            <input type="number" min="0" step="0.5"
                                   value={ligne.tva_pct}
                                   onChange={e => modifierLigne(i, 'tva_pct', parseFloat(e.target.value) || 0)}
                                   className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs mt-0.5" />
                        </div>
                    </div>
                    <div className="text-right text-xs font-medium text-foreground">
                        Ligne : {formatMontant(
                        ligne.prix_unitaire * ligne.quantite * (1 - ligne.remise_pct / 100) *
                        (1 + ligne.tva_pct / 100)
                    )}
                    </div>
                </div>
            ))}

            <Button type="button" variant="outline" size="sm"
                    onClick={ajouterLigne} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-2" />
                Ajouter une ligne
            </Button>

            {lignes.length > 0 && (
                <div className="text-right text-sm font-bold text-foreground pt-2 border-t border-border">
                    Total TTC : {formatMontant(total)}
                </div>
            )}
        </div>
    )
}