'use client'

import { useState } from 'react'
import {
    Trash2, ShoppingCart, AlertCircle,
    ChevronDown, ChevronUp, Users, Tag,
    FileText, CheckCircle,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import type { LigneVente } from '@/actions/ventes'

interface Client {
    id: string; public_id: string; nom: string; telephone: string | null
    credit_balance: number; advance_balance: number; change_balance: number
}

interface Props {
    panier:              LigneVente[]
    clients:             Client[]
    clientSelectionne:   Client | null
    onClientChange:      (c: Client | null) => void
    remiseGlobalePct:    number
    onRemiseChange:      (v: number) => void
    remiseMax:           number
    noteVente:           string
    onNoteChange:        (v: string) => void
    montantBrut:         number
    montantNet:          number
    montantTVA:          number
    montantTotal:        number
    devise:              string
    erreur?:             string
    onModifierLigne:     (id: string, champ: keyof LigneVente, val: number | string) => void
    onRetirerLigne:      (id: string) => void
    onValider:           () => void
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
        <div className="flex flex-col h-full">

            {/* ── EN-TÊTE PANIER ────────────────────────────── */}
            <div
                className="flex items-center justify-between px-4 py-3 shrink-0"
                style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
            >
                <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-white" />
                    <span className="text-sm font-bold text-white">Panier</span>
                </div>
                <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-black rounded-full">
            {panier.length} article(s)
          </span>
                    {panier.length > 0 && (
                        <button
                            onClick={() => panier.forEach(l => onRetirerLigne(l.product_id))}
                            className="px-2.5 py-0.5 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded-full transition-colors"
                        >
                            Vider
                        </button>
                    )}
                </div>
            </div>

            {/* ── SÉLECTION CLIENT ──────────────────────────── */}
            <div className="px-3 py-2.5 bg-[#f0f4ff] border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-[#15335a]" />
                    <span className="text-xs font-bold text-[#15335a]">Client</span>
                </div>
                <select
                    value={clientSelectionne?.id ?? ''}
                    onChange={e => {
                        const c = clients.find(c => c.id === e.target.value)
                        onClientChange(c ?? null)
                    }}
                    className="w-full px-2.5 py-2 bg-white border border-[#15335a]/20 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 text-gray-700"
                >
                    <option value="">Client anonyme</option>
                    {clients.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.nom}{c.telephone ? ` — ${c.telephone}` : ''}
                        </option>
                    ))}
                </select>

                {clientSelectionne && (
                    clientSelectionne.advance_balance > 0 || clientSelectionne.change_balance > 0
                ) && (
                    <div className="flex gap-2 mt-1.5">
                        {clientSelectionne.advance_balance > 0 && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                Avance : {formatMontant(clientSelectionne.advance_balance, devise)}
              </span>
                        )}
                        {clientSelectionne.change_balance > 0 && (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Monnaie : {formatMontant(clientSelectionne.change_balance, devise)}
              </span>
                        )}
                    </div>
                )}
            </div>

            {/* ── LIGNES DU PANIER ──────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {panier.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 space-y-3 text-gray-300">
                        <ShoppingCart className="w-12 h-12" />
                        <p className="text-sm font-medium">Panier vide</p>
                        <p className="text-xs">Cliquez sur un produit pour l'ajouter</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {panier.map(ligne => (
                            <div key={ligne.product_id} className="px-3 py-2.5">

                                {/* Ligne principale */}
                                <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-800 truncate leading-tight">
                                            {ligne.nom}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {formatMontant(ligne.prix_unitaire, devise)} × {ligne.quantite} {ligne.unite}
                                        </p>
                                        {ligne.necessite_imei && !ligne.imei && (
                                            <p className="text-[10px] text-orange-500 font-bold mt-0.5 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                IMEI requis
                                            </p>
                                        )}
                                        {ligne.necessite_imei && ligne.imei && (
                                            <p className="text-[10px] text-green-500 font-bold mt-0.5 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                IMEI : {ligne.imei}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-black text-[#15335a]">
                      {formatMontant(ligne.montant_ligne, devise)}
                    </span>
                                        <button
                                            type="button"
                                            onClick={() => setLigneOuverte(
                                                ligneOuverte === ligne.product_id ? null : ligne.product_id
                                            )}
                                            className="p-1 text-gray-400 hover:text-[#15335a] transition-colors"
                                        >
                                            {ligneOuverte === ligne.product_id
                                                ? <ChevronUp className="w-3.5 h-3.5" />
                                                : <ChevronDown className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onRetirerLigne(ligne.product_id)}
                                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Détails expandables */}
                                {ligneOuverte === ligne.product_id && (
                                    <div className="mt-2 pt-2 border-t border-dashed border-gray-200 space-y-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">
                                                    Qté (max {ligne.stock_disponible})
                                                </label>
                                                <input type="number" min="1" step="1"
                                                       max={ligne.stock_disponible}
                                                       value={ligne.quantite}
                                                       onChange={e => onModifierLigne(ligne.product_id, 'quantite', parseInt(e.target.value) || 1)}
                                                       className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">
                                                    Remise (%)
                                                </label>
                                                <input type="number" min="0" max="100" step="0.5"
                                                       value={ligne.remise_pct}
                                                       onChange={e => onModifierLigne(ligne.product_id, 'remise_pct', parseInt(e.target.value) || 0)}
                                                       className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                                />
                                            </div>
                                        </div>

                                        {ligne.necessite_imei && (
                                            <div>
                                                <label className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    IMEI *
                                                </label>
                                                <input type="text"
                                                       placeholder="Saisir l'IMEI (15 chiffres)"
                                                       value={ligne.imei}
                                                       onChange={e => onModifierLigne(ligne.product_id, 'imei', e.target.value)}
                                                       className="w-full px-2 py-1.5 bg-blue-50 border-2 border-blue-200 rounded-lg text-xs font-bold mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                                                />
                                            </div>
                                        )}

                                        {ligne.necessite_serie && (
                                            <div>
                                                <label className="text-[10px] font-bold text-purple-600 uppercase">
                                                    N° de série *
                                                </label>
                                                <input type="text"
                                                       placeholder="Numéro de série"
                                                       value={ligne.imei}
                                                       onChange={e => onModifierLigne(ligne.product_id, 'imei', e.target.value)}
                                                       className="w-full px-2 py-1.5 bg-purple-50 border-2 border-purple-200 rounded-lg text-xs font-bold mt-0.5 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── REMISE GLOBALE ────────────────────────────── */}
            <div className="px-3 py-2 bg-[#f0f4ff] border-t border-gray-200 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3.5 h-3.5 text-[#15335a]" />
                    <span className="text-xs font-bold text-[#15335a]">Remise globale</span>
                    <span className="text-xs text-gray-400">(max {remiseMax}%)</span>
                    <div className="flex-1 flex items-center gap-2">
                        <input type="range" min="0" max={remiseMax} step="0.5"
                               value={remiseGlobalePct}
                               onChange={e => onRemiseChange(Math.min(parseFloat(e.target.value), remiseMax))}
                               className="flex-1 accent-[#15335a] h-1.5" />
                        <span className="text-xs font-black text-[#15335a] w-8 text-right">
              {remiseGlobalePct}%
            </span>
                    </div>
                </div>
                <div className="relative">
                    <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input type="text" placeholder="Note (optionnelle)"
                           value={noteVente} onChange={e => onNoteChange(e.target.value)}
                           className="w-full pl-7 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#15335a]/20"
                    />
                </div>
            </div>

            {/* ── TOTAUX ────────────────────────────────────── */}
            <div className="px-4 py-3 bg-white border-t border-gray-200 space-y-1.5 shrink-0">
                {montantBrut !== montantNet && (
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>Sous-total</span>
                        <span>{formatMontant(montantBrut, devise)}</span>
                    </div>
                )}
                {montantBrut - montantNet > 0 && (
                    <div className="flex justify-between text-xs text-green-600 font-medium">
                        <span>Remises</span>
                        <span>−{formatMontant(montantBrut - montantNet, devise)}</span>
                    </div>
                )}
                {montantTVA > 0 && (
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>TVA</span>
                        <span>{formatMontant(montantTVA, devise)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                    <span className="text-sm font-bold text-gray-700">TOTAL</span>
                    <span className="text-xl font-black text-[#15335a]">
            {formatMontant(montantTotal, devise)}
          </span>
                </div>
            </div>

            {/* ── ERREUR ────────────────────────────────────── */}
            {erreur && (
                <div className="mx-3 mb-2 flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2.5 text-xs shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}

            {/* ── BOUTON PAIEMENT ───────────────────────────── */}
            <div className="p-3 shrink-0">
                <button
                    onClick={onValider}
                    disabled={panier.length === 0}
                    className="w-full py-4 font-black text-base rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        background: panier.length > 0
                            ? 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)'
                            : '#d1d5db',
                        boxShadow: panier.length > 0
                            ? '0 4px 16px rgba(26,86,219,0.35)'
                            : 'none',
                    }}
                >
                    {panier.length === 0
                        ? 'Panier vide'
                        : `Payer — ${formatMontant(montantTotal, devise)}`
                    }
                </button>
            </div>

        </div>
    )
}