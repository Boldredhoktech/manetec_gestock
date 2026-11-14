'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { payerFactureFournisseur } from '@/actions/fournisseurs'
import { Loader2, AlertCircle, CheckCircle, CreditCard } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import ChampsReglement from '@/components/shop/compta/ChampsReglement'

interface Props { facture: any; boutique: any }


export default function CarteDetailFactureFournisseur({ facture, boutique }: Props) {
    const router    = useRouter()
    const devise    = boutique?.devise ?? 'FCFA'
    const fournisseur = facture.suppliers as any
    const items     = (facture.facture_fournisseur_items as any[]) ?? []
    // Les paiements vivent désormais dans la table unique
    // supplier_payments, rattachés à la facture par facture_id.
    const paiements = (facture.supplier_payments as any[]) ?? []

    const [montantPaiement, setMontantPaiement] = useState('')
    const [enAttente,       setEnAttente]        = useState(false)
    const [msg,             setMsg]              = useState<{ type: 'succes'|'erreur'; texte: string } | null>(null)

    async function handlePayer(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!montantPaiement || parseFloat(montantPaiement) <= 0) {
            setMsg({ type: 'erreur', texte: 'Entrez un montant valide.' })
            return
        }
        setEnAttente(true); setMsg(null)
        // compteId et reference viennent de ChampsReglement (mig 041).
        const formData = new FormData(e.currentTarget)
        formData.set('factureId', facture.id)
        formData.set('montant',   montantPaiement)
        const res = await payerFactureFournisseur(formData)
        setEnAttente(false)
        if (res?.erreur) { setMsg({ type: 'erreur', texte: res.erreur }); return }
        setMsg({ type: 'succes', texte: 'Paiement enregistré.' })
        setMontantPaiement('')
        router.refresh()
    }

    const inputClass = 'w-full px-3 py-2.5 bg-[var(--surface2)] border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors'

    return (
        <div className="space-y-5">

            {/* En-tête */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">

                {/* Boutique ↔ Fournisseur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">Notre boutique</p>
                        <p className="font-bold text-foreground">{boutique?.nom}</p>
                        {boutique?.adresse    && <p className="text-muted-foreground text-xs">{boutique.adresse}</p>}
                        {boutique?.telephone_1 && <p className="text-muted-foreground text-xs">{boutique.telephone_1}</p>}
                        {boutique?.ifu        && <p className="text-muted-foreground/80 text-xs">IFU : {boutique.ifu}</p>}
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">Fournisseur</p>
                        <p className="font-bold text-foreground">{fournisseur?.nom ?? '—'}</p>
                        {fournisseur?.adresse  && <p className="text-muted-foreground text-xs">{fournisseur.adresse}</p>}
                        {fournisseur?.telephone && <p className="text-muted-foreground text-xs">{fournisseur.telephone}</p>}
                        {fournisseur?.ifu      && <p className="text-muted-foreground/80 text-xs">IFU : {fournisseur.ifu}</p>}
                    </div>
                </div>

                {/* Dates et infos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    {[
                        { label: 'Date facture',       val: formatDate(facture.date_facture)              },
                        { label: 'Date échéance',       val: facture.date_echeance ? formatDate(facture.date_echeance) : '—' },
                        { label: 'Réf. fournisseur',   val: facture.reference_fourn ?? '—'               },
                    ].map(item => (
                        <div key={item.label} className="p-3 bg-[var(--surface2)] rounded-xl">
                            <p className="text-xs text-muted-foreground/80 mb-1">{item.label}</p>
                            <p className="text-sm font-semibold text-foreground">{item.val}</p>
                        </div>
                    ))}
                </div>

                {/* Lignes */}
                <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                        <thead>
                        <tr className="bg-[var(--surface2)] border-b border-border">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Désignation</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qté</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">P.U. HT</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">TVA</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total TTC</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {items.map((item: any) => (
                            <tr key={item.id}>
                                <td className="px-4 py-2.5 text-foreground">{item.designation}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{item.quantite}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{formatMontant(item.prix_unitaire, devise)}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{item.tva_pct > 0 ? `${item.tva_pct}%` : '—'}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-foreground">{formatMontant(item.montant_ttc, devise)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {/* Totaux */}
                <div className="flex justify-end">
                    <div className="w-56 space-y-2 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Montant HT</span>
                            <span>{formatMontant(facture.montant_ht, devise)}</span>
                        </div>
                        {facture.montant_tva > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                                <span>TVA</span>
                                <span>{formatMontant(facture.montant_tva, devise)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
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
                    <div className="border-t border-border pt-4">
                        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider mb-2">
                            Paiements effectués
                        </p>
                        {paiements.map((p: any) => (
                            <div key={p.id} className="flex justify-between text-xs text-muted-foreground py-1">
                                <span>{p.moyen_paiement} · {formatDate(p.created_at)}</span>
                                <span className="font-bold text-green-600">{formatMontant(p.montant, devise)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Formulaire paiement */}
            {['non_payee','partiellement_payee'].includes(facture.statut) && (
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-[var(--primary-strong)]" />
                        <h2 className="text-sm font-bold text-foreground">Enregistrer un paiement</h2>
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

                    <form onSubmit={handlePayer} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">Montant *</label>
                            <input type="number" min="0" step="0.01"
                                   value={montantPaiement}
                                   onChange={e => setMontantPaiement(e.target.value)}
                                   placeholder={`Max : ${facture.montant_restant}`}
                                   className={inputClass} />
                        </div>
                        <ChampsReglement disabled={enAttente} />
                    </div>

                    <button type="submit" disabled={enAttente}
                            className="w-full flex items-center justify-center gap-2.5 py-3 font-bold text-white rounded-xl disabled:opacity-50"
                            style={{ background: 'var(--primary)' }}>
                        {enAttente
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement...</>
                            : <><CreditCard className="w-4 h-4" />Enregistrer le paiement</>
                        }
                    </button>
                    </form>
                </div>
            )}
        </div>
    )
}