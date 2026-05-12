// components/shop/facturation/CarteDetailDevis.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, CheckCircle, XCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, formatMontant } from '@/lib/utils'
import { modifierStatutDevis, convertirDevisEnFacture } from '@/actions/facturation'

interface Props {
    devis:    any
    boutique: any
}

const STATUT_CONFIG: Record<string, { label: string; classe: string }> = {
    brouillon: { label: 'Brouillon', classe: 'bg-gray-100 text-gray-600 border-gray-200'    },
    envoye:    { label: 'Envoyé',    classe: 'bg-blue-100 text-blue-700 border-blue-200'     },
    accepte:   { label: 'Accepté',   classe: 'bg-green-100 text-green-700 border-green-200'  },
    refuse:    { label: 'Refusé',    classe: 'bg-red-100 text-red-700 border-red-200'         },
    expire:    { label: 'Expiré',    classe: 'bg-amber-100 text-amber-700 border-amber-200'  },
}

export default function CarteDetailDevis({ devis, boutique }: Props) {
    const router             = useRouter()
    const [telecharge, setTelecharge]     = useState(false)
    const [enAttente, setEnAttente]       = useState(false)
    const config             = STATUT_CONFIG[devis.statut] ?? STATUT_CONFIG.brouillon

    const clientData = Array.isArray(devis.clients)
        ? (devis.clients as any[])[0]
        : devis.clients

    async function handleTelecharger() {
        setTelecharge(true)
        try {
            const resp = await fetch(`/api/v1/pdf/devis/${devis.id}`)
            if (!resp.ok) throw new Error('Erreur PDF')
            const blob = await resp.blob()
            const link = document.createElement('a')
            link.href     = URL.createObjectURL(blob)
            link.download = `proforma-${devis.public_id}.pdf`
            link.click()
        } catch (e) {
            console.error(e)
        } finally {
            setTelecharge(false)
        }
    }

    async function handleConvertir() {
        setEnAttente(true)
        const res = await convertirDevisEnFacture(devis.id)
        setEnAttente(false)
        if (res?.succes) router.push(`/admin/factures/${res.facture_id}`)
    }

    async function handleStatut(statut: string) {
        await modifierStatutDevis(devis.id, statut)
        router.refresh()
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">

            {/* En-tête */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-2xl font-bold text-gray-900">
                        Proforma {devis.public_id}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Émis le {formatDate(devis.date_devis)}
                        {devis.date_validite && ` · Valide jusqu'au ${formatDate(devis.date_validite)}`}
                    </p>
                    {devis.objet && (
                        <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Objet :</span> {devis.objet}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${config.classe}`}>
                        {config.label}
                    </span>
                    <Button variant="outline" size="sm" onClick={handleTelecharger} disabled={telecharge}>
                        {telecharge
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><Download className="w-3.5 h-3.5 mr-1.5" />Proforma PDF</>
                        }
                    </Button>
                </div>
            </div>

            {/* Boutique ↔ Client */}
            <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">De</p>
                    <p className="font-semibold text-gray-900">{boutique?.nom}</p>
                    {boutique?.adresse   && <p className="text-gray-500">{boutique.adresse}</p>}
                    {boutique?.telephone_1 && <p className="text-gray-500">{boutique.telephone_1}</p>}
                    {boutique?.ifu       && <p className="text-gray-400 text-xs">IFU : {boutique.ifu}</p>}
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">À</p>
                    {clientData ? (
                        <>
                            <p className="font-semibold text-gray-900">{clientData.nom}</p>
                            {clientData.adresse   && <p className="text-gray-500">{clientData.adresse}</p>}
                            {clientData.telephone && <p className="text-gray-500">{clientData.telephone}</p>}
                            {clientData.ifu       && <p className="text-gray-400 text-xs">IFU : {clientData.ifu}</p>}
                        </>
                    ) : (
                        <p className="text-gray-400">Client non spécifié</p>
                    )}
                </div>
            </div>

            {/* Lignes */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Désignation</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">Qté</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">P.U. HT</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">Remise</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">TVA</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">Total TTC</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {devis.devis_items?.map((item: any) => (
                        <tr key={item.id}>
                            <td className="px-4 py-2.5 text-gray-800">{item.designation}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{item.quantite}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">
                                {formatMontant(item.prix_unitaire, boutique?.devise)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-500">
                                {item.remise_pct > 0 ? `${item.remise_pct}%` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-500">
                                {item.tva_pct > 0 ? `${item.tva_pct}%` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                                {formatMontant(item.montant_ttc, boutique?.devise)}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Totaux */}
            <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between text-gray-500">
                        <span>Sous-total HT</span>
                        <span>{formatMontant(devis.montant_ht + devis.remise_val, boutique?.devise)}</span>
                    </div>
                    {devis.remise_val > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Remise ({devis.remise_pct}%)</span>
                            <span>-{formatMontant(devis.remise_val, boutique?.devise)}</span>
                        </div>
                    )}
                    {devis.montant_tva > 0 && (
                        <div className="flex justify-between text-gray-500">
                            <span>TVA</span>
                            <span>{formatMontant(devis.montant_tva, boutique?.devise)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
                        <span>Total TTC</span>
                        <span>{formatMontant(devis.montant_ttc, boutique?.devise)}</span>
                    </div>
                </div>
            </div>

            {/* Actions selon statut */}
            {['brouillon', 'envoye'].includes(devis.statut) && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    {devis.statut === 'brouillon' && (
                        <Button variant="outline" size="sm"
                                onClick={() => handleStatut('envoye')}>
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            Marquer comme envoyé
                        </Button>
                    )}
                    <Button size="sm" onClick={handleConvertir} disabled={enAttente}
                            className="bg-green-600 hover:bg-green-700 text-white">
                        {enAttente
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        }
                        Convertir en facture
                    </Button>
                    <Button variant="outline" size="sm"
                            onClick={() => handleStatut('refuse')}
                            className="text-red-600 border-red-200 hover:bg-red-50">
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Marquer comme refusé
                    </Button>
                </div>
            )}

            {/* Note client */}
            {devis.note_client && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-700 mb-1">Note client</p>
                    <p className="text-sm text-amber-800">{devis.note_client}</p>
                </div>
            )}

        </div>
    )
}