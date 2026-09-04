import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, Plus, ChevronRight } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Bons de commande' }

// Vocabulaire unique, celui de la base.
const STATUT_BC: Record<string, { label: string; bg: string; couleur: string }> = {
    brouillon:    { label: 'Brouillon',       bg: 'bg-gray-100',    couleur: 'text-gray-600'   },
    soumis:       { label: 'Envoyé',          bg: 'bg-blue-100',    couleur: 'text-blue-700'   },
    recu_partiel: { label: 'Reçu en partie',  bg: 'bg-amber-100',   couleur: 'text-amber-700'  },
    recu_total:   { label: 'Reçu',            bg: 'bg-green-100',   couleur: 'text-green-700'  },
    annule:       { label: 'Annulé',          bg: 'bg-red-100',     couleur: 'text-red-700'    },
}

export default async function PageBonsCommande() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FOURNISSEURS_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()
    const peutCreer   = aPermission(user, PERMISSIONS.BONS_COMMANDE_CREER)

    const [{ data: bons }, { data: boutique }] = await Promise.all([
        adminClient.from('purchase_orders')
            .select(`
                id, public_id, statut, date_commande, date_livraison, montant_total,
                suppliers(nom), warehouses(nom),
                purchase_order_items(quantite_cmd, quantite_recue)
            `)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(50),
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
    ])

    const devise = boutique?.devise ?? 'XOF'
    const nom = (rel: unknown) =>
        Array.isArray(rel) ? (rel[0] as { nom?: string })?.nom : (rel as { nom?: string })?.nom

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Bons de commande</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Commander chez un fournisseur, puis réceptionner la marchandise
                        </p>
                    </div>
                    {peutCreer && (
                        <Button asChild>
                            <Link href="/stock/bons-de-commande/nouveau">
                                <Plus className="w-4 h-4 mr-2" />
                                Nouveau bon de commande
                            </Link>
                        </Button>
                    )}
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6">
                <div className="max-w-5xl mx-auto">
                    {(bons ?? []).length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-16 text-center">
                            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-gray-700">Aucun bon de commande</p>
                            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                                Le bon de commande est facultatif : vous pouvez réceptionner de la marchandise
                                et enregistrer une facture sans passer par lui. Il sert à formaliser une commande
                                avant livraison, et à suivre ce qui reste à recevoir.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                            {(bons ?? []).map(b => {
                                const cfg    = STATUT_BC[b.statut] ?? STATUT_BC.brouillon
                                const lignes = (b.purchase_order_items ?? []) as { quantite_cmd: number; quantite_recue: number }[]
                                const cmd    = lignes.reduce((a, l) => a + l.quantite_cmd, 0)
                                const recu   = lignes.reduce((a, l) => a + l.quantite_recue, 0)
                                return (
                                    <Link key={b.id} href={`/stock/bons-de-commande/${b.id}`}
                                          className="flex items-center gap-3 px-5 py-4 hover:bg-[#15335a]/5 transition-colors group">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-gray-900 group-hover:text-[#15335a]">
                                                    {nom(b.suppliers) ?? 'Fournisseur'}
                                                </p>
                                                <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${cfg.bg} ${cfg.couleur}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <p className="text-xs font-mono text-gray-400 mt-0.5">
                                                {b.public_id} · {formatDate(b.date_commande)}
                                                {nom(b.warehouses) ? ` · ${nom(b.warehouses)}` : ''}
                                            </p>
                                            {cmd > 0 && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Reçu {recu} / {cmd} article(s) commandé(s)
                                                </p>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-gray-800 shrink-0">
                                            {formatMontant(b.montant_total, devise)}
                                        </p>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#15335a] shrink-0" />
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
