'use client'

import { useState } from 'react'
import {
    Trash2, ShoppingCart, AlertCircle,
    ChevronDown, ChevronUp, Tag,
    FileText, CheckCircle,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import ChampNombre from '@/components/ui/ChampNombre'
import type { LigneVente } from '@/actions/ventes'
import ChoixClient, { type ClientChoisi } from '@/components/shop/ChoixClient'
import {
    exigeIdentifiant, libelleIdentifiant, identifiantsSaisis,
} from '@/lib/ventes/identifiants'


interface Props {
    panier:              LigneVente[]
    clientSelectionne:   ClientChoisi | null
    onClientChange:      (c: ClientChoisi | null) => void
    peutCreerClient:     boolean
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
                                      panier, clientSelectionne, onClientChange, peutCreerClient,
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
                style={{ background: 'var(--nav)' }}
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
            <ChoixClient
                variante="caisse"
                indication="Client anonyme — chercher nom ou téléphone"
                clientSelectionne={clientSelectionne}
                onClientChange={onClientChange}
                peutCreerClient={peutCreerClient}
                devise={devise}
            />

            {/* ── LIGNES DU PANIER ──────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {panier.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 space-y-3 text-muted-foreground/80">
                        <ShoppingCart className="w-12 h-12" />
                        <p className="text-sm font-medium">Panier vide</p>
                        <p className="text-xs">Cliquez sur un produit pour l'ajouter</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {panier.map(ligne => (
                            <div key={ligne.product_id} className="px-3 py-2.5">

                                {/* Ligne principale */}
                                <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-foreground truncate leading-tight">
                                            {ligne.nom}
                                        </p>
                                        <p className="text-xs text-muted-foreground/80 mt-0.5">
                                            {formatMontant(ligne.prix_unitaire, devise)} × {ligne.quantite} {ligne.unite}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-black text-[var(--primary-strong)]">
                      {formatMontant(ligne.montant_ligne, devise)}
                    </span>
                                        <button
                                            type="button"
                                            onClick={() => setLigneOuverte(
                                                ligneOuverte === ligne.product_id ? null : ligne.product_id
                                            )}
                                            className="p-1 text-muted-foreground/80 hover:text-primary transition-colors"
                                        >
                                            {ligneOuverte === ligne.product_id
                                                ? <ChevronUp className="w-3.5 h-3.5" />
                                                : <ChevronDown className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onRetirerLigne(ligne.product_id)}
                                            className="p-1 text-muted-foreground/80 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* IMEI / numéro de série : toujours visible, jamais
                                    caché dans le détail — un par appareil vendu. */}
                                {exigeIdentifiant(ligne) && (() => {
                                    const libelle = libelleIdentifiant(ligne)
                                    const saisis  = identifiantsSaisis(ligne.imei).length
                                    const attendus = Math.ceil(ligne.quantite)
                                    const complet = saisis === attendus
                                    return (
                                        <div className="mt-1.5">
                                            <label className={`text-[10px] font-bold uppercase flex items-center gap-1 ${complet ? 'text-green-600' : 'text-orange-600'}`}>
                                                {complet ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                {libelle} * · {saisis}/{attendus} saisi(s)
                                            </label>
                                            <input type="text"
                                                   placeholder={attendus > 1
                                                       ? `${attendus} numéros, séparés par une virgule`
                                                       : `Saisir le ${libelle}`}
                                                   value={ligne.imei}
                                                   onChange={e => onModifierLigne(ligne.product_id, 'imei', e.target.value)}
                                                   className={`w-full px-2 py-1.5 border-2 rounded-lg text-xs font-bold mt-0.5 focus:outline-none focus:ring-2 font-mono ${complet ? 'bg-green-50 border-green-200 focus:ring-green-400' : 'bg-orange-50 border-orange-200 focus:ring-orange-400'}`}
                                            />
                                        </div>
                                    )
                                })()}

                                {/* Détails expandables */}
                                {ligneOuverte === ligne.product_id && (
                                    <div className="mt-2 pt-2 border-t border-dashed border-border space-y-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground/80 uppercase">
                                                    Qté (max {ligne.stock_disponible})
                                                </label>
                                                <ChampNombre value={ligne.quantite} onChange={v => onModifierLigne(ligne.product_id, 'quantite', v)} entier videVaut={1} className="w-full px-2 py-1.5 bg-[var(--surface2)] border border-border rounded-lg text-xs font-bold mt-0.5 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground/80 uppercase">
                                                    Remise (%)
                                                </label>
                                                <ChampNombre
                                                       value={ligne.remise_pct}
                                                       onChange={v => onModifierLigne(ligne.product_id, 'remise_pct', v)}
                                                       entier
                                                       aria-label="Remise en pourcentage"
                                                       className=""
                                                    />
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── REMISE GLOBALE ────────────────────────────── */}
            <div className="px-3 py-2 bg-background border-t border-border shrink-0">
{/* Le pourcentage se SAISIT. Le curseur demandait de viser
                    7,5 % au pixel pres, sur un ecran tactile de comptoir :
                    on tapait le chiffre dans sa tete et on n'arrivait pas
                    a le poser. Le plafond reste applique, mais il est dit
                    plutot que subi. */}
                <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3.5 h-3.5 text-[var(--primary-strong)] shrink-0" />
                    <label htmlFor="remise-globale" className="text-xs font-bold text-[var(--primary-strong)]">
                        Remise globale
                    </label>
                    <div className="ml-auto flex items-center gap-1.5">
                        <div className="relative">
                            <ChampNombre
                                id="remise-globale"
                                value={remiseGlobalePct}
                                onChange={valeur => onRemiseChange(Math.max(0, Math.min(valeur, remiseMax)))}
                                aria-label={`Remise globale en pourcentage, maximum ${remiseMax}`}
                                className={`w-20 pl-2 pr-6 py-1.5 bg-card border-2 rounded-lg text-sm font-black
                                    text-right tabular-nums focus:outline-none focus:ring-2
                                    ${remiseGlobalePct > 0
                                        ? 'border-primary text-[var(--primary-strong)] focus:ring-ring/30'
                                        : 'border-border text-foreground focus:ring-ring/30'}`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/80 pointer-events-none">
                                %
                            </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/80 whitespace-nowrap">
                            max {remiseMax}%
                        </span>
                    </div>
                </div>
                <div className="relative">
                    <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/80" />
                    <input type="text" placeholder="Note (optionnelle)"
                           value={noteVente} onChange={e => onNoteChange(e.target.value)}
                           className="w-full pl-7 pr-3 py-1.5 bg-card border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                </div>
            </div>

            {/* ── TOTAUX ────────────────────────────────────── */}
            <div className="px-4 py-3 bg-card border-t border-border space-y-1.5 shrink-0">
                {montantBrut !== montantNet && (
                    <div className="flex justify-between text-xs text-muted-foreground/80">
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
                    <div className="flex justify-between text-xs text-muted-foreground/80">
                        <span>TVA</span>
                        <span>{formatMontant(montantTVA, devise)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-border">
                    <span className="text-sm font-bold text-foreground">TOTAL</span>
                    <span className="text-xl font-black text-[var(--primary-strong)]">
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
                            ? 'var(--nav)'
                            : '#d1d5db',
                        boxShadow: panier.length > 0
                            ? '0 4px 16px rgba(29,78,216,0.30)'
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