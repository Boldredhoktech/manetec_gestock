import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatDate, formatMontant } from '@/lib/utils'
import { ArrowDown, ArrowUp, ArrowLeftRight } from 'lucide-react'

export const metadata: Metadata = { title: 'Mouvements de stock' }

const TYPE_CONFIG: Record<string, { label: string; icone: React.ElementType; couleur: string }> = {
    entree_initiale:    { label: 'Entrée initiale',      icone: ArrowDown,      couleur: 'text-green-600'   },
    vente:              { label: 'Vente',                icone: ArrowUp,        couleur: 'text-destructive' },
    retour_vente:       { label: 'Retour vente',         icone: ArrowDown,      couleur: 'text-blue-600'    },
    reception:          { label: 'Réception',            icone: ArrowDown,      couleur: 'text-green-600'   },
    retour_fournisseur: { label: 'Retour fournisseur',   icone: ArrowUp,        couleur: 'text-amber-600'   },
    transfert_sortie:   { label: 'Transfert sortant',    icone: ArrowLeftRight, couleur: 'text-purple-600'  },
    transfert_entree:   { label: 'Transfert entrant',    icone: ArrowLeftRight, couleur: 'text-purple-600'  },
    ajustement_positif: { label: 'Ajustement +',         icone: ArrowDown,      couleur: 'text-green-600'   },
    ajustement_negatif: { label: 'Ajustement -',         icone: ArrowUp,        couleur: 'text-destructive' },
    inventaire:         { label: 'Inventaire',           icone: ArrowLeftRight, couleur: 'text-muted-foreground' },
}

export default async function PageMouvements() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()
    const { data: mouvements } = await adminClient
        .from('stock_movements')
        .select(`
      id, public_id, type_mouvement, quantite,
      quantite_avant, quantite_apres, note, created_at,
      products(nom, unite),
      warehouses(nom)
    `)
        .eq('shop_id', user.user_metadata.shop_id)
        .order('created_at', { ascending: false })
        .limit(100)

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Mouvements de stock</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    100 derniers mouvements
                </p>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produit</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entrepôt</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Qté</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Avant → Après</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                            {(mouvements ?? []).map(m => {
                                const config = TYPE_CONFIG[m.type_mouvement]
                                const Icone  = config?.icone ?? ArrowLeftRight
                                return (
                                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${config?.couleur}`}>
                          <Icone className="w-3.5 h-3.5" />
                            {config?.label ?? m.type_mouvement}
                        </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-medium text-foreground">
                                                {(m.products as any)?.nom}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {(m.warehouses as any)?.nom}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-semibold text-foreground">
                                            {m.quantite} {(m.products as any)?.unite}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                                            {m.quantite_avant} → {m.quantite_apres}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {formatDate(m.created_at)}
                                        </td>
                                    </tr>
                                )
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    )
}