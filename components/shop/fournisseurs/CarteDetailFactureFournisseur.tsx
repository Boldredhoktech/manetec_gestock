'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { payerFactureFournisseur } from '@/actions/fournisseurs'
import { Loader2, AlertCircle, CheckCircle, CreditCard } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

interface Props { facture: any; boutique: any }

const MOYENS = [
    { val: 'cash',          label: 'Espèces'      },
    { val: 'wave',          label: 'Wave'         },
    { val: 'mtn_momo',      label: 'MTN MoMo'    },
    { val: 'moov_money',    label: 'Moov Money'  },
    { val: 'bank_transfer', label: 'Virement'     },
    { val: 'bank_card',     label: 'Carte bancaire'},
]

export default function CarteDetailFactureFournisseur({ facture, boutique }: Props) {
    const router    = useRouter()
    const devise    = boutique?.devise ?? 'FCFA'
    const fournisseur = facture.suppliers as any
    const items     = (facture.facture_fournisseur_items as any[]) ?? []
    const paiements = (facture.facture_fournisseur_payments as any[]) ?? []

    const [montantPaiement, setMontantPaiement] = useState('')
    const [moyen,           setMoyen]           = useState('cash')
    const [reference,       setReference]       = useState('')
    const [enAttente,       setEnAttente]        = useState(false)
    const [msg,             setMsg]              = useState<{ type: 'succes'|'erreur'; texte: string } | null>(null)

    async function handlePayer() {
        if (!montantPaiement || parseFloat(montantPaiement) <= 0) {
            setMsg({ type: 'erreur', texte: 'Entrez un montant valide.' })
            return
        }
        setEnAttente(true); setMsg(null)
        const formData = new FormData()
        formData.set('factureId', facture.id)
        formData.set('montant',   montantPaiement)
        formData.set('moyen',     moyen)
        formData.set('reference', reference)
        const res = await payerFactureFournisseur(formData)
        setEnAttente(false)
        if (res?.erreur) { setMsg({ type: 'erreur', texte: res.erreur }); return }
        setMsg({ type: 'succes', texte: 'Paiement enregistré.' })
        setMontantPaiement('')
        router.refresh()
    }

    const inputClass = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 transition-colors'

    return (
        <div className="space-y-5">

            {/* En-tête */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">

                {/* Boutique ↔ Fournisseur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Notre boutique</p>
                        <p className="font-bold text-gray-900">{boutique?.nom}</p>
                        {boutique?.adresse    && <p className="text-gray-500 text-xs">{boutique.adresse}</p>}
                        {boutique?.telephone_1 && <p className="text-gray-500 text-xs">{boutique.telephone_1}</p>}
                        {boutique?.ifu        && <p className="text-gray-400 text-xs">IFU : {boutique.ifu}</p>}
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fournisseur</p>
                        <p className="font-bold text-gray-900">{fournisseur?.nom ?? '—'}</p>
                        {fournisseur?.adresse  && <p className="text-gray-500 text-xs">{fournisseur.adresse}</p>}
                        {fournisseur?.telephone && <p className="text-gray-500 text-xs">{fournisseur.telephone}</p>}
                        {fournisseur?.ifu      && <p className="text-gray-400 text-xs">IFU : {fournisseur.ifu}</p>}
                    </div>
                </div>

                {/* Dates et infos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    {[
                        { label: 'Date facture',       val: formatDate(facture.date_facture)              },
                        { label: 'Date échéance',       val: facture.date_echeance ? formatDate(facture.date_echeance) : '—' },
                        { label: 'Réf. fournisseur',   val: facture.reference_fourn ?? '—'               },
                    ].map(item => (
                        <div key={item.label} className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                            <p className="text-sm font-semibold text-gray-700">{item.val}</p>
                        </div>
                    ))}
                </div>

                {/* Lignes */}
                <div className="border border-gray-200 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                        <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-2.5 font-medium text-gray-500">Désignation</th>
                            <th className="text-right px-4 py-2.5 font-medium text-gray-500">Qté</th>
                            <th className="text-right px-4 py-2.5 font-medium text-gray-500">P.U. HT</th>
                            <th className="text-right px-4 py-2.5 font-medium text-gray-500">TVA</th>
                            <th className="text-right px-4 py-2.5 font-medium text-gray-500">Total TTC</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {items.map((item: any) => (
                            <tr key={item.id}>
                                <td className="px-4 py-2.5 text-gray-800">{item.designation}</td>
                                <td className="px-4 py-2.5 text-right text-gray-500">{item.quantite}</td>
                                <td className="px-4 py-2.5 text-right text-gray-500">{formatMontant(item.prix_unitaire, devise)}</td>
                                <td className="px-4 py-2.5 text-right text-gray-500">{item.tva_pct > 0 ? `${item.tva_pct}%` : '—'}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-gray-900">{formatMontant(item.montant_ttc, devise)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {/* Totaux */}
                <div className="flex justify-end">
                    <div className="w-56 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-500">
                            <span>Montant HT</span>
                            <span>{formatMontant(facture.montant_ht, devise)}</span>
                        </div>
                        {facture.montant_tva > 0 && (
                            <div className="flex justify-between text-gray-500">
                                <span>TVA</span>
                                <span>{formatMontant(facture.montant_tva, devise)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
                            <span>Total TTC</span>
                            <span>{formatMontant(facture.montant_ttc, devise)}</span>
                        </div>
                        {facture.montant_paye > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Payé</span>
                                <span>{formatMontant(facture.montant_paye, devise)}</span>
                            </div>
                        )}
                        {facture.montant_restant > 0 && (
                            <div className="flex justify-between text-red-600 font-bold">
                                <span>Reste à payer</span>
                                <span>{formatMontant(facture.montant_restant, devise)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Historique paiements */}
                {paiements.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Paiements effectués
                        </p>
                        {paiements.map((p: any) => (
                            <div key={p.id} className="flex justify-between text-xs text-gray-500 py-1">
                                <span>{p.moyen_paiement} · {formatDate(p.created_at)}</span>
                                <span className="font-bold text-green-600">{formatMontant(p.montant, devise)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Formulaire paiement */}
            {['non_payee','partiellement_payee'].includes(facture.statut) && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-[#15335a]" />
                        <h2 className="text-sm font-bold text-gray-900">Enregistrer un paiement</h2>
                    </div>

                    {msg && (
                        <div className={`flex items-center gap-2.5 p-3 rounded-xl text-sm ${
                            msg.type === 'succes'
                                ? 'bg-green-50 border border-green-200 text-green-700'
                                : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                            {msg.type === 'succes' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                            {msg.texte}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Montant *</label>
                            <input type="number" min="0" step="0.01"
                                   value={montantPaiement}
                                   onChange={e => setMontantPaiement(e.target.value)}
                                   placeholder={`Max : ${facture.montant_restant}`}
                                   className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Moyen de paiement</label>
                            <select value={moyen} onChange={e => setMoyen(e.target.value)} className={inputClass}>
                                {MOYENS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Référence</label>
                            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                                   placeholder="N° chèque, reçu..." className={inputClass} />
                        </div>
                    </div>

                    <button onClick={handlePayer} disabled={enAttente}
                            className="w-full flex items-center justify-center gap-2.5 py-3 font-bold text-white rounded-xl disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                        {enAttente
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement...</>
                            : <><CreditCard className="w-4 h-4" />Enregistrer le paiement</>
                        }
                    </button>
                </div>
            )}
        </div>
    )
}