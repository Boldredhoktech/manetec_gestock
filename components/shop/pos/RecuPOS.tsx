'use client'

import { useEffect, useState } from 'react'
import { getDetailVente } from '@/actions/ventes'
import { Button } from '@/components/ui/button'
import { formatMontant, formatDateHeure } from '@/lib/utils'
import { CheckCircle, Printer, ShoppingCart, Loader2 } from 'lucide-react'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Props {
    saleId:         string
    publicId:       string
    boutique:       { nom: string; devise: string }
    onNouvelleVente: () => void
}

export default function RecuPOS({ saleId, publicId, boutique, onNouvelleVente }: Props) {
    const [vente, setVente] = useState<any>(null)
    const [chargement, setChargement] = useState(true)

    useEffect(() => {
        getDetailVente(saleId).then(data => {
            setVente(data)
            setChargement(false)
        })
    }, [saleId])

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

            {/* Reçu */}
            <div
                id="recu-thermique"
                className="bg-card border border-border rounded-xl p-5 w-full max-w-sm space-y-4 print:shadow-none print:border-none"
            >
                <div className="text-center border-b border-border pb-3">
                    <p className="font-bold text-foreground">{boutique.nom}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {vente ? formatDateHeure(vente.created_at) : ''}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground">{publicId}</p>
                </div>

                {/* Lignes */}
                {vente?.sale_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs">
                        <div className="flex-1">
                            <p className="font-medium text-foreground">{item.products?.nom}</p>
                            <p className="text-muted-foreground">
                                {item.quantite} {item.products?.unite} × {formatMontant(item.prix_unitaire, boutique.devise)}
                            </p>
                            {item.remise_pct > 0 && (
                                <p className="text-green-600">Remise {item.remise_pct}%</p>
                            )}
                        </div>
                        <p className="font-medium text-foreground ml-2">
                            {formatMontant(item.montant_ligne, boutique.devise)}
                        </p>
                    </div>
                ))}

                {/* Totaux */}
                <div className="border-t border-border pt-3 space-y-1 text-xs">
                    {vente?.montant_tva > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>TVA</span>
                            <span>{formatMontant(vente.montant_tva, boutique.devise)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-foreground text-sm">
                        <span>TOTAL</span>
                        <span>{formatMontant(vente?.montant_total ?? 0, boutique.devise)}</span>
                    </div>
                </div>

                {/* Paiements */}
                <div className="border-t border-border pt-3 space-y-1 text-xs">
                    {vente?.sale_payments?.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between text-muted-foreground">
                            <span>{MOYENS_PAIEMENT.find(m => m.code === p.moyen_paiement)?.label ?? p.moyen_paiement}</span>
                            <span>{formatMontant(p.montant, boutique.devise)}</span>
                        </div>
                    ))}
                    {vente?.montant_rendu > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Rendu</span>
                            <span>{formatMontant(vente.montant_rendu, boutique.devise)}</span>
                        </div>
                    )}
                </div>

                {vente?.clients && (
                    <p className="text-xs text-center text-muted-foreground border-t border-border pt-2">
                        Client : {vente.clients.nom}
                    </p>
                )}

                <p className="text-xs text-center text-muted-foreground">
                    Merci pour votre achat !
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 w-full max-w-sm">
                <Button variant="outline" onClick={handleImprimer} className="flex-1">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimer
                </Button>
                <Button onClick={onNouvelleVente} className="flex-1">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Nouvelle vente
                </Button>
            </div>

        </div>
    )
}