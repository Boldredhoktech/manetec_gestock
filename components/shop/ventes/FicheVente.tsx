'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { annulerVente } from '@/actions/ventes'
import { Button } from '@/components/ui/button'
import {
    Loader2, AlertCircle, Ban, Printer, Info, ShoppingCart, CreditCard,
} from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Vente {
    id:               string
    public_id:        string
    statut:           string
    created_at:       string
    montant_brut:     number
    remise_globale_val: number
    montant_net:      number
    montant_tva:      number
    montant_total:    number
    montant_recu:     number
    montant_rendu:    number
    credit_accorde:   number
    credit_utilise:   number
    advance_utilise:  number
    change_utilise:   number
    note:             string | null
    annule_le:        string | null
    motif_annulation: string | null
    clients:     { nom: string; public_id: string; telephone: string | null } | null
    shop_users:  { nom_complet: string } | null
    sale_items:  {
        id: string; quantite: number; prix_unitaire: number; remise_pct: number
        montant_ligne: number; imei: string | null; note: string | null
        products: { nom: string; unite: string; public_id: string } | null
    }[]
    sale_payments: { moyen_paiement: string; montant: number; reference: string | null }[]
}

function quand(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Africa/Porto-Novo',
    })
}

export default function FicheVente({
    vente, aDesRetours, peutAnnuler,
}: {
    vente:       Vente
    aDesRetours: boolean
    peutAnnuler: boolean
}) {
    const router = useRouter()

    const [ouvert, setOuvert]       = useState(false)
    const [motif, setMotif]         = useState('')
    const [erreur, setErreur]       = useState('')
    const [enAttente, setEnAttente] = useState(false)

    const annulee   = vente.statut === 'annulee'
    const encaisse  = vente.sale_payments.reduce((s, p) => s + p.montant, 0)

    async function confirmer() {
        setEnAttente(true)
        setErreur('')

        const res = await annulerVente(vente.id, motif)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setOuvert(false)
        setMotif('')
        router.refresh()
    }

    return (
        <div className="space-y-5">

            {annulee && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
                    <Ban className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium">
                            Vente annulée{vente.annule_le ? ` le ${formatDate(vente.annule_le)}` : ''}
                        </p>
                        {vente.motif_annulation && (
                            <p className="mt-0.5 opacity-90">« {vente.motif_annulation} »</p>
                        )}
                        <p className="mt-1 text-xs opacity-80">
                            Le stock a été rendu et les soldes du client repris. La vente conserve
                            son numéro mais ne compte plus dans les totaux.
                        </p>
                    </div>
                </div>
            )}

            {/* Récapitulatif */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground">Total de la vente</p>
                        <p className={`text-2xl font-bold tabular-nums ${
                            annulee ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}>
                            {formatMontant(vente.montant_total)}
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <a href={`/api/v1/pdf/recu/${vente.id}`} target="_blank" rel="noopener noreferrer">
                            <Printer className="w-4 h-4 mr-2" />
                            Réimprimer le reçu
                        </a>
                    </Button>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-t border-border pt-4">
                    <div>
                        <dt className="text-xs text-muted-foreground">Encaissée le</dt>
                        <dd className="text-foreground">{quand(vente.created_at)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Vendeur</dt>
                        <dd className="text-foreground">{vente.shop_users?.nom_complet ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Client</dt>
                        <dd className="text-foreground">
                            {vente.clients
                                ? `${vente.clients.nom}${vente.clients.telephone ? ` · ${vente.clients.telephone}` : ''}`
                                : 'Client de passage'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Réellement encaissé</dt>
                        <dd className="text-foreground tabular-nums">{formatMontant(encaisse)}</dd>
                    </div>
                    {vente.note && (
                        <div className="col-span-2">
                            <dt className="text-xs text-muted-foreground">Note</dt>
                            <dd className="text-foreground">{vente.note}</dd>
                        </div>
                    )}
                </dl>
            </div>

            {/* Articles */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 px-5 py-4 border-b border-border">
                    <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                    Articles ({vente.sale_items.length})
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Produit</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qté</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Prix</th>
                            <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Total</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {vente.sale_items.map(l => (
                            <tr key={l.id}>
                                <td className="px-5 py-3">
                                    <p className="text-foreground">{l.products?.nom ?? 'Produit supprimé'}</p>
                                    {l.imei && (
                                        <p className="text-xs font-mono text-muted-foreground">IMEI {l.imei}</p>
                                    )}
                                    {l.remise_pct > 0 && (
                                        <p className="text-xs text-amber-600">remise {l.remise_pct} %</p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                    {l.quantite} {l.products?.unite ?? ''}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                    {formatMontant(l.prix_unitaire)}
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums font-medium text-foreground">
                                    {formatMontant(l.montant_ligne)}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Règlement */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    Règlement
                </h2>

                <ul className="space-y-1.5 text-sm">
                    {vente.sale_payments.map((p, i) => (
                        <li key={i} className="flex justify-between">
                            <span className="text-muted-foreground">
                                {MOYENS_PAIEMENT.find(m => m.code === p.moyen_paiement)?.label ?? p.moyen_paiement}
                                {p.reference ? ` · ${p.reference}` : ''}
                            </span>
                            <span className="font-medium text-foreground tabular-nums">
                                {formatMontant(p.montant)}
                            </span>
                        </li>
                    ))}

                    {vente.advance_utilise > 0 && (
                        <li className="flex justify-between">
                            <span className="text-muted-foreground">Avance utilisée</span>
                            <span className="text-green-600 tabular-nums">
                                {formatMontant(vente.advance_utilise)}
                            </span>
                        </li>
                    )}
                    {vente.change_utilise > 0 && (
                        <li className="flex justify-between">
                            <span className="text-muted-foreground">Monnaie utilisée</span>
                            <span className="text-blue-600 tabular-nums">
                                {formatMontant(vente.change_utilise)}
                            </span>
                        </li>
                    )}
                    {vente.credit_utilise > 0 && (
                        <li className="flex justify-between">
                            <span className="text-muted-foreground">Ardoise réglée</span>
                            <span className="text-foreground tabular-nums">
                                {formatMontant(vente.credit_utilise)}
                            </span>
                        </li>
                    )}
                    {vente.credit_accorde > 0 && (
                        <li className="flex justify-between border-t border-border pt-1.5">
                            <span className="text-amber-700 font-medium">Accordé à crédit</span>
                            <span className="text-amber-700 font-medium tabular-nums">
                                {formatMontant(vente.credit_accorde)}
                            </span>
                        </li>
                    )}
                    {vente.montant_rendu > 0 && (
                        <li className="flex justify-between">
                            <span className="text-muted-foreground">Monnaie rendue</span>
                            <span className="text-muted-foreground tabular-nums">
                                {formatMontant(vente.montant_rendu)}
                            </span>
                        </li>
                    )}
                </ul>

                {vente.credit_accorde > 0 && (
                    <p className="text-xs text-muted-foreground flex items-start gap-2 border-t border-border pt-3">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                            Le crédit accordé n&apos;est pas entré en caisse : il s&apos;ajoute
                            à l&apos;ardoise du client.
                        </span>
                    </p>
                )}
            </div>

            {/* Annulation */}
            {peutAnnuler && !annulee && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Ban className="w-4 h-4 text-muted-foreground" />
                        Annuler la vente
                    </h2>

                    {erreur && (
                        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{erreur}</span>
                        </div>
                    )}

                    {aDesRetours ? (
                        <p className="text-xs text-muted-foreground flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                                Cette vente a déjà fait l&apos;objet d&apos;un retour : elle ne peut
                                pas être annulée telle quelle, le stock reviendrait deux fois.
                                Traitez le reste en retour.
                            </span>
                        </p>
                    ) : !ouvert ? (
                        <>
                            <p className="text-xs text-muted-foreground">
                                Le stock sera rendu, les soldes du client repris, et la vente
                                sortira de tous les totaux. Elle garde son numéro et reste
                                consultable.
                            </p>
                            <Button type="button" variant="outline" size="sm"
                                    onClick={() => setOuvert(true)}>
                                Annuler cette vente
                            </Button>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <label htmlFor="motif-vente" className="text-sm font-medium text-foreground block">
                                Pourquoi cette vente est-elle annulée ?
                            </label>
                            <input
                                id="motif-vente"
                                type="text"
                                value={motif}
                                onChange={e => setMotif(e.target.value)}
                                placeholder="Ex : erreur de saisie, client s'est ravisé"
                                disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                            />
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className="flex-1"
                                        disabled={enAttente}
                                        onClick={() => { setOuvert(false); setMotif(''); setErreur('') }}>
                                    Retour
                                </Button>
                                <Button type="button" variant="destructive" className="flex-1"
                                        disabled={enAttente} onClick={confirmer}>
                                    {enAttente
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : 'Confirmer l’annulation'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
