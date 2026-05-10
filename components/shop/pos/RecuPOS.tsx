'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatMontant, formatDateHeure } from '@/lib/utils'
import { CheckCircle, Printer, ShoppingCart, Download, Loader2 } from 'lucide-react'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'
import { getDetailVente } from '@/actions/ventes'

interface Props {
    saleId:          string
    publicId:        string
    boutique:        { nom: string; devise: string }
    onNouvelleVente: () => void
}

export default function RecuPOS({ saleId, publicId, boutique, onNouvelleVente }: Props) {
    const [vente, setVente]         = useState<any>(null)
    const [chargement, setChargement] = useState(true)
    const [telecharge, setTelecharge] = useState(false)

    useEffect(() => {
        getDetailVente(saleId).then(data => {
            setVente(data)
            setChargement(false)
        })
    }, [saleId])

    async function handleTelechargerPDF() {
        setTelecharge(true)
        const url  = `/api/v1/pdf/recu/${saleId}`
        const resp = await fetch(url)
        const blob = await resp.blob()
        const link = document.createElement('a')
        link.href  = URL.createObjectURL(blob)
        link.download = `recu-${publicId}.pdf`
        link.click()
        setTelecharge(false)
    }

    function handleImprimer() {
        window.print()
    }

    if (chargement) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const b = vente?.shops ?? boutique

    return (
        <div className="flex-1 flex flex-col items-center justify-start py-8 px-4">

            {/* Succès */}
            <div className="text-center space-y-2 mb-6">
                <div className="flex justify-center">
                    <div className="bg-green-100 p-3 rounded-full">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                </div>
                <h2 className="text-xl font-bold text-foreground">Vente enregistrée !</h2>
                <p className="text-sm font-mono text-muted-foreground">{publicId}</p>
            </div>

            {/* Aperçu reçu thermique */}
            <div
                id="recu-thermique"
                className="bg-white border border-border rounded-xl p-5 w-full max-w-xs space-y-3 font-mono text-xs print:shadow-none"
            >
                {/* En-tête boutique */}
                <div className="text-center space-y-0.5 border-b border-dashed border-gray-300 pb-3">
                    <p className="font-bold text-sm text-foreground">{boutique.nom}</p>
                    {vente?.shops?.adresse && (
                        <p className="text-muted-foreground">{vente.shops.adresse}</p>
                    )}
                    {vente?.shops?.telephone_1 && (
                        <p className="text-muted-foreground">Tél : {vente.shops.telephone_1}</p>
                    )}
                    {vente?.shops?.email && (
                        <p className="text-muted-foreground">{vente.shops.email}</p>
                    )}
                    {vente?.shops?.ifu && (
                        <p className="text-muted-foreground">IFU : {vente.shops.ifu}</p>
                    )}
                </div>

                {/* Infos vente */}
                <div className="space-y-0.5 border-b border-dashed border-gray-300 pb-3">
                    <div className="flex justify-between">
                        <span className="font-bold">N° :</span>
                        <span>{publicId}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">Date :</span>
                        <span>{vente ? formatDateHeure(vente.created_at) : ''}</span>
                    </div>
                    {vente?.shop_users && (
                        <div className="flex justify-between">
                            <span className="font-bold">Vendeur :</span>
                            <span>{vente.shop_users.nom_complet}</span>
                        </div>
                    )}
                    {vente?.clients && (
                        <div className="flex justify-between">
                            <span className="font-bold">Client :</span>
                            <span>{vente.clients.nom}</span>
                        </div>
                    )}
                </div>

                {/* Articles */}
                <div className="space-y-2 border-b border-dashed border-gray-300 pb-3">
                    {vente?.sale_items?.map((item: any) => (
                        <div key={item.id}>
                            <p className="font-bold text-foreground truncate">
                                {item.products?.nom}
                            </p>
                            <div className="flex justify-between text-muted-foreground">
                <span>
                  {item.quantite} {item.products?.unite} × {formatMontant(item.prix_unitaire, boutique.devise)}
                    {item.remise_pct > 0 && ` (-${item.remise_pct}%)`}
                </span>
                                <span className="font-bold text-foreground">
                  {formatMontant(item.montant_ligne, boutique.devise)}
                </span>
                            </div>
                            {item.imei && (
                                <p className="text-muted-foreground text-xs">IMEI : {item.imei}</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Totaux */}
                <div className="space-y-1 border-b border-dashed border-gray-300 pb-3">
                    {vente?.montant_tva > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>TVA</span>
                            <span>{formatMontant(vente.montant_tva, boutique.devise)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-sm">
                        <span>TOTAL</span>
                        <span>{formatMontant(vente?.montant_total ?? 0, boutique.devise)}</span>
                    </div>
                </div>

                {/* Paiements */}
                <div className="space-y-1 border-b border-dashed border-gray-300 pb-3">
                    {vente?.sale_payments?.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between text-muted-foreground">
              <span>
                {MOYENS_PAIEMENT.find(m => m.code === p.moyen_paiement)?.label ?? p.moyen_paiement}
              </span>
                            <span>{formatMontant(p.montant, boutique.devise)}</span>
                        </div>
                    ))}
                    {vente?.advance_utilise > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Avance client</span>
                            <span>{formatMontant(vente.advance_utilise, boutique.devise)}</span>
                        </div>
                    )}
                    {vente?.credit_accorde > 0 && (
                        <div className="flex justify-between text-destructive font-bold">
                            <span>Crédit accordé</span>
                            <span>{formatMontant(vente.credit_accorde, boutique.devise)}</span>
                        </div>
                    )}
                    {vente?.montant_rendu > 0 && (
                        <div className="flex justify-between text-green-600 font-bold">
                            <span>Monnaie rendue</span>
                            <span>{formatMontant(vente.montant_rendu, boutique.devise)}</span>
                        </div>
                    )}
                </div>

                {/* Pied */}
                <div className="text-center text-muted-foreground space-y-0.5">
                    {vente?.shops?.message_recu_thermique ? (
                        <p>{vente.shops.message_recu_thermique}</p>
                    ) : (
                        <p>Merci pour votre achat !</p>
                    )}
                    <p>*** Conservez ce reçu ***</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 w-full max-w-xs">
                <Button variant="outline" onClick={handleImprimer} className="flex-1">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimer
                </Button>
                <Button variant="outline" onClick={handleTelechargerPDF}
                        disabled={telecharge} className="flex-1">
                    {telecharge
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <Download className="w-4 h-4 mr-2" />
                    }
                    PDF
                </Button>
            </div>
            <Button onClick={onNouvelleVente} className="mt-3 w-full max-w-xs">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Nouvelle vente
            </Button>

        </div>
    )
}