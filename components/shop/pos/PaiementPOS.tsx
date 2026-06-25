'use client'

import { useState } from 'react'
import {
    ArrowLeft, Plus, Trash2, Loader2,
    AlertCircle, CreditCard, Banknote,
    CheckCircle, Smartphone,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import type { PaiementVente } from '@/actions/ventes'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Client {
    id: string; nom: string
    advance_balance: number; change_balance: number; credit_balance: number
}

interface Props {
    montantTotal:  number
    devise:        string
    client:        Client | null
    enAttente:     boolean
    erreur?:       string
    onValider:     (
        paiements:      PaiementVente[],
        creditAccorde:  number,
        advanceUtilise: number,
        changeUtilise:  number,
        creditUtilise:  number,
        garderMonnaie:  boolean,
        montantRecu:    number,
        montantRendu:   number,
    ) => void
    onRetour: () => void
}

export default function PaiementPOS({
                                        montantTotal, devise, client,
                                        enAttente, erreur, onValider, onRetour,
                                    }: Props) {
    const [paiements, setPaiements]         = useState<PaiementVente[]>([
        { moyen_paiement: 'cash', montant: montantTotal, reference: '' },
    ])
    const [creditAccorde, setCreditAccorde]   = useState(0)
    const [advanceUtilise, setAdvanceUtilise] = useState(0)
    const [changeUtilise, setChangeUtilise]   = useState(0)
    const [garderMonnaie, setGarderMonnaie]   = useState(false)

    const totalPaiements = paiements.reduce((a, p) => a + p.montant, 0)
    const resteAPayer    = montantTotal - totalPaiements - advanceUtilise - changeUtilise
    const montantRendu   = Math.max(0, totalPaiements - (montantTotal - advanceUtilise - changeUtilise))
    const peutValider    = resteAPayer <= 0.001 || creditAccorde >= resteAPayer

    function ajouterPaiement() {
        setPaiements(prev => [...prev, { moyen_paiement: 'cash', montant: 0, reference: '' }])
    }

    function modifierPaiement(i: number, champ: keyof PaiementVente, val: string | number) {
        setPaiements(prev => prev.map((p, idx) => idx === i ? { ...p, [champ]: val } : p))
    }

    function handleValider() {
        onValider(
            paiements.filter(p => p.montant > 0),
            creditAccorde,
            advanceUtilise,
            changeUtilise,
            0,
            garderMonnaie,
            totalPaiements,
            montantRendu,
        )
    }

    const MOYEN_ICONS: Record<string, React.ReactNode> = {
        cash:          <Banknote className="w-4 h-4" />,
        wave:          <Smartphone className="w-4 h-4" />,
        mtn_momo:      <Smartphone className="w-4 h-4" />,
        bank_card:     <CreditCard className="w-4 h-4" />,
        bank_transfer: <CreditCard className="w-4 h-4" />,
    }

    return (
        <div className="flex-1 flex flex-col bg-[#f0f4ff] overflow-auto">
            <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">

                {/* Retour */}
                <button type="button" onClick={onRetour}
                        className="flex items-center gap-2 text-sm font-medium text-[#15335a] hover:text-[#0f2742] transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Retour au panier
                </button>

                {/* Carte total */}
                <div
                    className="rounded-2xl p-5 text-white shadow-xl"
                    style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                >
                    <p className="text-sm font-medium text-white/75 mb-1">Total à régler</p>
                    <p className="text-4xl font-black tracking-tight">
                        {formatMontant(montantTotal, devise)}
                    </p>
                    {client && (
                        <p className="text-sm text-white/70 mt-2 font-medium">Client : {client.nom}</p>
                    )}
                </div>

                {/* Modes de paiement */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#15335a]" />
                        Modes de paiement
                    </h3>

                    {paiements.map((p, i) => (
                        <div key={i} className="flex gap-2 items-start">
                            <div className="flex-1 space-y-2">
                                <select
                                    value={p.moyen_paiement}
                                    onChange={e => modifierPaiement(i, 'moyen_paiement', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                >
                                    {MOYENS_PAIEMENT.map(m => (
                                        <option key={m.code} value={m.code}>{m.label}</option>
                                    ))}
                                </select>
                                {MOYENS_PAIEMENT.find(m => m.code === p.moyen_paiement)?.reference_requise && (
                                    <input type="text" placeholder="Référence de transaction *"
                                           value={p.reference}
                                           onChange={e => modifierPaiement(i, 'reference', e.target.value)}
                                           className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 font-mono"
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="number" min="0" step="0.01"
                                       value={p.montant}
                                       onChange={e => modifierPaiement(i, 'montant', parseFloat(e.target.value) || 0)}
                                       className="w-28 px-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                />
                                {paiements.length > 1 && (
                                    <button type="button" onClick={() => setPaiements(prev => prev.filter((_, idx) => idx !== i))}
                                            className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    <button type="button" onClick={ajouterPaiement}
                            className="flex items-center gap-2 text-xs font-bold text-[#15335a] hover:text-[#0f2742] transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter un mode de paiement
                    </button>
                </div>

                {/* Soldes client */}
                {client && (client.advance_balance > 0 || client.change_balance > 0 || true) && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
                        <h3 className="text-sm font-bold text-gray-800">
                            Soldes de {client.nom}
                        </h3>

                        {client.advance_balance > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-green-700">Avance disponible</p>
                                    <p className="text-lg font-black text-green-600">
                                        {formatMontant(client.advance_balance, devise)}
                                    </p>
                                </div>
                                <input type="number" min="0"
                                       max={Math.min(client.advance_balance, montantTotal)}
                                       step="0.01" value={advanceUtilise}
                                       onChange={e => setAdvanceUtilise(parseFloat(e.target.value) || 0)}
                                       className="w-28 px-2 py-2 bg-white border border-green-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-green-400"
                                />
                            </div>
                        )}

                        {client.change_balance > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-blue-700">Monnaie en attente</p>
                                    <p className="text-lg font-black text-blue-600">
                                        {formatMontant(client.change_balance, devise)}
                                    </p>
                                </div>
                                <input type="number" min="0"
                                       max={Math.min(client.change_balance, montantTotal)}
                                       step="0.01" value={changeUtilise}
                                       onChange={e => setChangeUtilise(parseFloat(e.target.value) || 0)}
                                       className="w-28 px-2 py-2 bg-white border border-blue-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <div className="flex-1">
                                <p className="text-xs font-bold text-amber-700">Accorder un crédit</p>
                                <p className="text-xs text-amber-500">Montant que le client paiera plus tard</p>
                            </div>
                            <input type="number" min="0" step="0.01"
                                   value={creditAccorde}
                                   onChange={e => setCreditAccorde(parseFloat(e.target.value) || 0)}
                                   className="w-28 px-2 py-2 bg-white border border-amber-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                    </div>
                )}

                {/* Résumé */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-2">
                    <h3 className="text-sm font-bold text-gray-800">Résumé</h3>

                    <div className="space-y-1.5">
                        {[
                            { label: 'Total à payer',    val: formatMontant(montantTotal, devise),   couleur: 'text-gray-700' },
                            { label: 'Espèces/Mobile',   val: formatMontant(totalPaiements, devise), couleur: 'text-gray-600' },
                            advanceUtilise > 0 && { label: 'Avance utilisée', val: formatMontant(advanceUtilise, devise), couleur: 'text-green-600' },
                            changeUtilise > 0  && { label: 'Monnaie utilisée', val: formatMontant(changeUtilise, devise), couleur: 'text-blue-600'  },
                        ].filter(Boolean).map((item: any, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-500">{item.label}</span>
                                <span className={`font-semibold ${item.couleur}`}>{item.val}</span>
                            </div>
                        ))}

                        <div className="border-t border-gray-100 pt-2 mt-2">
                            {resteAPayer > 0.001 && creditAccorde < resteAPayer ? (
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-red-600">Reste à payer</span>
                                    <span className="font-black text-red-600">{formatMontant(resteAPayer, devise)}</span>
                                </div>
                            ) : montantRendu > 0.001 ? (
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-green-600">Monnaie à rendre</span>
                                    <span className="font-black text-green-600">{formatMontant(montantRendu, devise)}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm font-bold">Compte exact</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Garder monnaie */}
                    {montantRendu > 0.001 && client && (
                        <label className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                            <input type="checkbox" checked={garderMonnaie}
                                   onChange={e => setGarderMonnaie(e.target.checked)}
                                   className="rounded accent-[#15335a] w-4 h-4" />
                            <span className="text-xs font-medium text-gray-600">
                Conserver {formatMontant(montantRendu, devise)} en attente pour {client.nom}
              </span>
                        </label>
                    )}
                </div>

                {/* Erreur */}
                {erreur && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        {erreur}
                    </div>
                )}

                {/* Bouton confirmer */}
                <button
                    onClick={handleValider}
                    disabled={!peutValider || enAttente}
                    className="w-full py-4 font-black text-base rounded-2xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        background: peutValider && !enAttente
                            ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                            : '#d1d5db',
                        boxShadow: peutValider && !enAttente
                            ? '0 4px 16px rgba(22,163,74,0.35)'
                            : 'none',
                    }}
                >
                    {enAttente
                        ? <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Enregistrement...
              </span>
                        : '✓ Confirmer la vente'
                    }
                </button>

            </div>
        </div>
    )
}