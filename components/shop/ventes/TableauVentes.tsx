import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Vente {
    id:               string
    public_id:        string
    statut:           string
    created_at:       string
    montant_total:    number
    credit_accorde:   number
    motif_annulation: string | null
    clients:     { nom: string } | { nom: string }[] | null
    shop_users:  { nom_complet: string } | { nom_complet: string }[] | null
    sale_items:  { id: string }[] | null
}

function premier<T>(v: T | T[] | null): T | null {
    if (!v) return null
    return Array.isArray(v) ? (v[0] ?? null) : v
}

// L'heure affichée est celle de la boutique (UTC+1), pas celle du
// serveur : une vente de 00 h 30 doit se lire 00 h 30.
function quand(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Africa/Porto-Novo',
    })
}

export default function TableauVentes({ ventes }: { ventes: Vente[] }) {
    if (ventes.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground text-sm">
                Aucune vente ne correspond à cette sélection.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vente</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendeur</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Articles</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                    <th className="px-4 py-3" />
                </tr>
                </thead>
                <tbody className="divide-y divide-border">
                {ventes.map(v => {
                    const annulee = v.statut === 'annulee'
                    return (
                        <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                                <Link href={`/admin/ventes/${v.id}`}
                                      className="font-mono text-xs font-medium text-foreground hover:text-primary hover:underline">
                                    {v.public_id}
                                </Link>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {quand(v.created_at)}
                                </p>
                                {annulee && (
                                    <p className="text-xs text-destructive font-medium mt-0.5">
                                        Annulée
                                        {v.motif_annulation ? ` — « ${v.motif_annulation} »` : ''}
                                    </p>
                                )}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground">
                                {premier(v.clients)?.nom ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {premier(v.shop_users)?.nom_complet ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                                {v.sale_items?.length ?? 0}
                            </td>
                            <td className={`px-4 py-3 text-right font-medium tabular-nums ${
                                annulee ? 'text-muted-foreground line-through' : 'text-foreground'
                            }`}>
                                {formatMontant(v.montant_total)}
                                {v.credit_accorde > 0 && !annulee && (
                                    <p className="text-xs font-normal text-amber-600">
                                        dont {formatMontant(v.credit_accorde)} à crédit
                                    </p>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <Link href={`/admin/ventes/${v.id}`}
                                      aria-label={`Ouvrir la vente ${v.public_id}`}
                                      className="inline-flex text-muted-foreground hover:text-primary">
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            </td>
                        </tr>
                    )
                })}
                </tbody>
            </table>
        </div>
    )
}
