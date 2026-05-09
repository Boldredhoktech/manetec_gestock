'use client'

import { Trash2, ShoppingCart, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMontant } from '@/lib/utils'
import type { LigneVente } from '@/actions/ventes'
import { useState } from 'react'

interface Client {
    id: string; nom: string; telephone: string | null
    advance_balance: number; change_balance: number
}

interface Props {
    panier:               LigneVente[]
    clients:              Client[]
    clientSelectionne:    Client | null
    onClientChange:       (c: Client | null) => void
    remiseGlobalePct:     number
    onRemiseChange:       (v: number) => void
    remiseMax:            number
    noteVente:            string
    onNoteChange:         (v: string) => void
    montantBrut:          number
    montantNet:           number
    montantTVA:           number
    montantTotal:         number
    devise:               string
    erreur?:              string
    onModifierLigne:      (id: string, champ: keyof LigneVente, val: number | string) => void
    onRetirerLigne:       (id: string) => void
    onValider:            () => void
}

export default function PanierPOS({
                                      panier, clients, clientSelectionne, onClientChange,
                                      remiseGlobalePct, onRemiseChange, remiseMax,
                                      noteVente, onNoteChange,
                                      montantBrut, montantNet, montantTVA, montantTotal,
                                      devise, erreur, onModifierLigne, onRetirerLigne, onValider,
                                  }: Props) {
    const [ligneOuverte, setLigneOuverte] = useState<string | null>(null)

    return (
        <div className="flex flex-col h-full bg-card">

            {/* En-tête panier */}
            <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
            Panier ({panier.length})
          </span>
                </div>
            </div>

            {/* Sélection client */}
            <div className="px-3 py-2 border-b border-border">
                <select
                    value={clientSelectionne?.id ?? ''}
                    onChange={e => {
                        const c = clients.find(c => c.id === e.target.value)
                        onClientChange(c ?? null)
                    }}
                    className="w-full px-2 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="">Client anonyme</option>
                    {clients.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.nom}{c.telephone ? ` — ${c.telephone}` : ''}
                        </option>
                    ))}
                </select>
                {clientSelectionne && (clientSelectionne.advance_balance > 0 || clientSelectionne.change_balance > 0) && (
                    <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                        {clientSelectionne.advance_balance > 0 && (
                            <p>Avance : <span className="text-green-600 font-medium">{formatMontant(clientSelectionne.advance_balance, devise)}</span></p>
                        )}
                        {clientSelectionne.change_balance > 0 && (
                            <p>Monnaie : <span className="text-blue-600 font-medium">{formatMontant(clientSelectionne.change_balance, devise)}</span></p>
                        )}
                    </div>
                )}
            </div>

            {/* Lignes panier */}
            <div className="flex-1 overflow-y-auto">
                {panier.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-xs">
                        Panier vide
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {panier.map(ligne => (
                            <div key={ligne.product_id} className="px-3 py-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-foreground truncate">
                                            {ligne.nom}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {formatMontant(ligne.prix_unitaire, devise)} × {ligne.quantite} {ligne.unite}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-foreground">
                      {formatMontant(ligne.montant_ligne, devise)}
                    </span>
                                        <button
                                            type="button"
                                            onClick={() => setLigneOuverte(
                                                ligneOuverte === ligne.product_id ? null : ligne.product_id
                                            )}
                                            className="text-muted-foreground hover:text-foreground p-0.5"
                                        >
                                            {ligneOuverte === ligne.product_id
                                                ? <ChevronUp className="w-3.5 h-3.5" />
                                                : <ChevronDown className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onRetirerLigne(ligne.product_id)}
                                            className="text-destructive hover:text-destructive/80 p-0.5"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Détails ligne expandable */}
                                {ligneOuverte === ligne.product_id && (
                                    <div className="mt-2 space-y-2 pt-2 border-t border-border">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs text-muted-foreground">Qté (max: {ligne.stock_disponible})</label>
                                                <input
                                                    type="number" min="0.001" step="0.001"
                                                    max={ligne.stock_disponible}
                                                    value={ligne.quantite}
                                                    onChange={e => onModifierLigne(ligne.product_id, 'quantite', parseFloat(e.target.value) || 1)}
                                                    className="w-full px-2 py-1 bg-background border border-input rounded text-xs mt-0.5"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">Remise (%)</label>
                                                <input
                                                    type="number" min="0" max="100" step="0.5"
                                                    value={ligne.remise_pct}
                                                    onChange={e => onModifierLigne(ligne.product_id, 'remise_pct', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 bg-background border border-input rounded text-xs mt-0.5"
                                                />
                                            </div>
                                        </div>
                                        {ligne.imei !== undefined && (
                                            <input
                                                type="text"
                                                placeholder="IMEI (optionnel)"
                                                value={ligne.imei}
                                                onChange={e => onModifierLigne(ligne.product_id, 'imei', e.target.value)}
                                                className="w-full px-2 py-1 bg-background border border-input rounded text-xs"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Remise globale */}
            <div className="px-3 py-2 border-t border-border">
                <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">
                        Remise globale (max {remiseMax}%)
                    </label>
                    <input
                        type="number" min="0" max={remiseMax} step="0.5"
                        value={remiseGlobalePct}
                        onChange={e => onRemiseChange(Math.min(parseFloat(e.target.value) || 0, remiseMax))}
                        className="w-16 px-2 py-1 bg-background border border-input rounded text-xs"
                    />
                </div>
                <input
                    type="text"
                    placeholder="Note (optionnelle)"
                    value={noteVente}
                    onChange={e => onNoteChange(e.target.value)}
                    className="w-full mt-2 px-2 py-1.5 bg-background border border-input rounded text-xs"
                />
            </div>

            {/* Totaux */}
            <div className="px-4 py-3 border-t border-border space-y-1.5 bg-muted/20">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sous-total</span>
                    <span>{formatMontant(montantBrut, devise)}</span>
                </div>
                {montantBrut - montantNet > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                        <span>Remises</span>
                        <span>-{formatMontant(montantBrut - montantNet, devise)}</span>
                    </div>
                )}
                {montantTVA > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>TVA</span>
                        <span>{formatMontant(montantTVA, devise)}</span>
                    </div>
                )}
                <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border">
                    <span>TOTAL</span>
                    <span>{formatMontant(montantTotal, devise)}</span>
                </div>
            </div>

            {/* Erreur */}
            {erreur && (
                <div className="mx-3 mb-2 flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}

            {/* Bouton paiement */}
            <div className="p-3 border-t border-border">
                <Button
                    onClick={onValider}
                    disabled={panier.length === 0}
                    className="w-full"
                >
                    Procéder au paiement — {formatMontant(montantTotal, devise)}
                </Button>
            </div>

        </div>
    )
}