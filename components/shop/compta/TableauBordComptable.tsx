'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
    TrendingUp, TrendingDown, Wallet, Package, Info,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface LigneVentilation {
    moyen:          string
    entreesPeriode: number
    sortiesPeriode: number
    netPeriode:     number
    solde:          number
}

interface Props {
    donnees: {
        periode: { mois: number; annee: number; libelle: string }
        totalVentes: number; totalFactures: number; totalEntrees: number
        totalDepenses: number; totalSalaires: number; totalFournisseurs: number
        totalSorties: number; resultat: number; nbVentes: number
        creditAccorde: number
        variationStock: { pertes: number; gains: number; net: number }
        resultatEconomique: number
        ventilation: LigneVentilation[]
        depenses: { libelle: string; montant: number; expense_categories: { nom: string } | { nom: string }[] | null }[]
    }
}

const MOIS_LABELS = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function nomMoyen(code: string): string {
    return MOYENS_PAIEMENT.find(m => m.code === code)?.label ?? code
}

export default function TableauBordComptable({ donnees }: Props) {
    const router       = useRouter()
    const pathname     = usePathname()
    const searchParams = useSearchParams()

    const positif     = donnees.resultat >= 0
    const anneesChoix = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i)

    function changerPeriode(mois: number, annee: number) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('mois', String(mois))
        params.set('annee', String(annee))
        router.push(`${pathname}?${params.toString()}`)
    }

    const totalSoldes = donnees.ventilation.reduce((t, l) => t + l.solde, 0)

    return (
        <div className="space-y-6">

            {/* Période */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground mr-1">Mois</span>
                <select
                    value={donnees.periode.mois}
                    onChange={e => changerPeriode(Number(e.target.value), donnees.periode.annee)}
                    className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {MOIS_LABELS.slice(1).map((label, i) => (
                        <option key={i + 1} value={i + 1}>{label}</option>
                    ))}
                </select>
                <select
                    value={donnees.periode.annee}
                    onChange={e => changerPeriode(donnees.periode.mois, Number(e.target.value))}
                    className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {anneesChoix.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>

            {/* Résultat net */}
            <div className={`rounded-xl p-6 border ${
                positif ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className={`text-sm font-medium ${positif ? 'text-green-700' : 'text-red-700'}`}>
                            Résultat de trésorerie — {donnees.periode.libelle}
                        </p>
                        <p className={`text-3xl font-bold mt-1 tabular-nums ${positif ? 'text-green-800' : 'text-red-800'}`}>
                            {positif ? '+' : ''}{formatMontant(donnees.resultat)}
                        </p>
                    </div>
                    <div className={`p-3 rounded-full ${positif ? 'bg-green-100' : 'bg-red-100'}`}>
                        {positif
                            ? <TrendingUp className="w-6 h-6 text-green-600" />
                            : <TrendingDown className="w-6 h-6 text-red-600" />
                        }
                    </div>
                </div>
            </div>

            {/* Entrées vs Sorties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        Entrées
                    </h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Ventes POS ({donnees.nbVentes})</span>
                            <span className="font-medium text-foreground tabular-nums">
                                {formatMontant(donnees.totalVentes)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Règlements de facture</span>
                            <span className="font-medium text-foreground tabular-nums">
                                {formatMontant(donnees.totalFactures)}
                            </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 font-bold text-foreground">
                            <span>Total entrées</span>
                            <span className="text-green-600 tabular-nums">{formatMontant(donnees.totalEntrees)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-destructive" />
                        Sorties
                    </h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Dépenses</span>
                            <span className="font-medium text-foreground tabular-nums">
                                {formatMontant(donnees.totalDepenses)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Salaires</span>
                            <span className="font-medium text-foreground tabular-nums">
                                {formatMontant(donnees.totalSalaires)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Fournisseurs</span>
                            <span className="font-medium text-foreground tabular-nums">
                                {formatMontant(donnees.totalFournisseurs)}
                            </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 font-bold text-foreground">
                            <span>Total sorties</span>
                            <span className="text-destructive tabular-nums">{formatMontant(donnees.totalSorties)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ventilation par moyen de paiement */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary" />
                        Où est l&apos;argent
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Entrées et sorties du mois par moyen de paiement, et solde cumulé
                        à la fin de {donnees.periode.libelle}.
                    </p>
                </div>

                {donnees.ventilation.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Aucun mouvement d&apos;argent enregistré.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Moyen</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Entrées</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Sorties</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Net du mois</th>
                                <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Solde</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                            {donnees.ventilation.map(l => (
                                <tr key={l.moyen} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-5 py-3 font-medium text-foreground">{nomMoyen(l.moyen)}</td>
                                    <td className="px-4 py-3 text-right text-green-600 tabular-nums">
                                        {l.entreesPeriode > 0 ? formatMontant(l.entreesPeriode) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-destructive tabular-nums">
                                        {l.sortiesPeriode > 0 ? formatMontant(l.sortiesPeriode) : '—'}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${
                                        l.netPeriode >= 0 ? 'text-foreground' : 'text-destructive'
                                    }`}>
                                        {l.netPeriode >= 0 ? '+' : ''}{formatMontant(l.netPeriode)}
                                    </td>
                                    <td className={`px-5 py-3 text-right font-bold tabular-nums ${
                                        l.solde >= 0 ? 'text-foreground' : 'text-destructive'
                                    }`}>
                                        {formatMontant(l.solde)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                            <tfoot>
                            <tr className="border-t-2 border-border bg-muted/30">
                                <td colSpan={4} className="px-5 py-3 font-semibold text-foreground">
                                    Tous moyens confondus
                                </td>
                                <td className="px-5 py-3 text-right font-bold text-foreground tabular-nums">
                                    {formatMontant(totalSoldes)}
                                </td>
                            </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                <div className="px-5 py-4 border-t border-border bg-muted/20 space-y-2">
                    <p className="text-xs text-muted-foreground flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                            Le solde est <strong className="text-foreground">théorique</strong> : il additionne
                            tout ce qui est entré et sorti par ce moyen. Les dépôts en banque et les
                            retraits d&apos;espèces ne sont enregistrés nulle part — un solde bancaire
                            négatif signifie le plus souvent que de l&apos;argent y a été versé sans être
                            saisi. Le comptage réel du tiroir viendra avec la session de caisse.
                        </span>
                    </p>
                    {donnees.creditAccorde > 0 && (
                        <p className="text-xs text-amber-700 flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                                Dont <strong>{formatMontant(donnees.creditAccorde)}</strong> accordé à crédit
                                ce mois-ci : le point de vente enregistre la vente entière comme encaissée,
                                donc les entrées ci-dessus sont surestimées d&apos;autant.
                            </span>
                        </p>
                    )}
                </div>
            </div>

            {/* Variation de la valeur du stock */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Variation de la valeur du stock
                </h2>
                <p className="text-xs text-muted-foreground">
                    Constatée aux inventaires validés du mois. Ce n&apos;est pas de la trésorerie :
                    aucun argent n&apos;est entré ni sorti, mais la valeur de ce que vous détenez a
                    changé.
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm border-t border-border pt-3">
                    <div>
                        <p className="text-xs text-muted-foreground">Pertes</p>
                        <p className="font-medium text-destructive tabular-nums">
                            {formatMontant(donnees.variationStock.pertes)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Gains</p>
                        <p className="font-medium text-green-600 tabular-nums">
                            {formatMontant(donnees.variationStock.gains)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Net</p>
                        <p className={`font-medium tabular-nums ${
                            donnees.variationStock.net >= 0 ? 'text-green-600' : 'text-destructive'
                        }`}>
                            {donnees.variationStock.net >= 0 ? '+' : ''}
                            {formatMontant(donnees.variationStock.net)}
                        </p>
                    </div>
                </div>
                <div className="flex justify-between items-baseline border-t border-border pt-3">
                    <span className="text-sm font-semibold text-foreground">Résultat économique</span>
                    <span className={`text-lg font-bold tabular-nums ${
                        donnees.resultatEconomique >= 0 ? 'text-green-600' : 'text-destructive'
                    }`}>
                        {donnees.resultatEconomique >= 0 ? '+' : ''}
                        {formatMontant(donnees.resultatEconomique)}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Résultat de trésorerie corrigé de la variation du stock — c&apos;est le chiffre
                    que reprend le rapport Profits &amp; Pertes.
                </p>
            </div>

            {/* Détail dépenses */}
            {donnees.depenses.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground">
                            Détail des dépenses du mois
                        </h2>
                        <Link href="/compta/depenses"
                              className="text-xs text-primary hover:underline">
                            Voir toutes les dépenses
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {donnees.depenses.slice(0, 8).map((d, i) => (
                            <div key={i} className="flex justify-between text-xs gap-3">
                                <div className="min-w-0">
                                    <span className="font-medium text-foreground">{d.libelle}</span>
                                    {d.expense_categories && (
                                        <span className="text-muted-foreground ml-2">
                                            · {(Array.isArray(d.expense_categories)
                                                ? d.expense_categories[0]?.nom
                                                : d.expense_categories?.nom) ?? ''}
                                        </span>
                                    )}
                                </div>
                                <span className="text-destructive font-medium tabular-nums shrink-0">
                                    {formatMontant(d.montant)}
                                </span>
                            </div>
                        ))}
                        {donnees.depenses.length > 8 && (
                            <Link href="/compta/depenses"
                                  className="block text-xs text-primary hover:underline pt-1">
                                + {donnees.depenses.length - 8} autre(s) — voir la liste complète
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
