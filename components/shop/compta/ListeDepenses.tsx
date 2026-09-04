'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Depense {
    id: string; public_id: string; libelle: string
    montant: number; moyen_paiement: string; date_depense: string
    est_annule: boolean
    expense_categories: { nom: string } | { nom: string }[] | null
}

interface Props {
    depenses:     Depense[]
    total:        number
    totalMontant: number
    page:         number
    parPage:      number
}

function nomCategorie(c: Depense['expense_categories']): string {
    if (!c) return '—'
    return (Array.isArray(c) ? c[0]?.nom : c.nom) ?? '—'
}

export default function ListeDepenses({
    depenses, total, totalMontant, page, parPage,
}: Props) {
    const pathname     = usePathname()
    const searchParams = useSearchParams()

    const nbPages = Math.max(1, Math.ceil(total / parPage))
    const premier = total === 0 ? 0 : (page - 1) * parPage + 1
    const dernier = Math.min(page * parPage, total)

    function lienPage(p: number) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(p))
        return `${pathname}?${params.toString()}`
    }

    if (depenses.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground text-sm bg-card border border-border rounded-xl">
                {total === 0
                    ? 'Aucune dépense ne correspond à cette sélection.'
                    : 'Cette page est vide — revenez à la première.'}
            </div>
        )
    }

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Libellé</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Catégorie</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Moyen</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Montant</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                    {depenses.map(d => (
                        <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                                <Link href={`/compta/depenses/${d.id}`}
                                      className="font-medium text-foreground hover:text-primary hover:underline">
                                    {d.libelle}
                                </Link>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                    {d.public_id}
                                    {d.est_annule && (
                                        <span className="ml-2 font-sans text-destructive font-medium">
                                            Annulée
                                        </span>
                                    )}
                                </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {nomCategorie(d.expense_categories)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {MOYENS_PAIEMENT.find(m => m.code === d.moyen_paiement)?.label ?? d.moyen_paiement}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {formatDate(d.date_depense)}
                            </td>
                            <td className={`px-4 py-3 text-right font-medium tabular-nums ${
                                d.est_annule ? 'text-muted-foreground line-through' : 'text-destructive'
                            }`}>
                                {formatMontant(d.montant)}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                    <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-foreground">
                            Total de la sélection
                            <span className="font-normal text-muted-foreground"> (hors annulées)</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-destructive tabular-nums">
                            {formatMontant(totalMontant)}
                        </td>
                    </tr>
                    </tfoot>
                </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                    Dépenses {premier} à {dernier} sur {total}
                </p>

                {nbPages > 1 && (
                    <div className="flex items-center gap-2">
                        {page > 1 ? (
                            <Link href={lienPage(page - 1)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-input rounded-lg hover:bg-muted transition-colors">
                                <ChevronLeft className="w-3.5 h-3.5" />
                                Précédent
                            </Link>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-input rounded-lg opacity-40">
                                <ChevronLeft className="w-3.5 h-3.5" />
                                Précédent
                            </span>
                        )}

                        <span className="text-xs text-muted-foreground tabular-nums">
                            Page {page} / {nbPages}
                        </span>

                        {page < nbPages ? (
                            <Link href={lienPage(page + 1)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-input rounded-lg hover:bg-muted transition-colors">
                                Suivant
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-input rounded-lg opacity-40">
                                Suivant
                                <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
