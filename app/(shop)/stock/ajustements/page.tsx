import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { SlidersHorizontal } from 'lucide-react'
import FormulaireAjustement from '@/components/shop/stock/FormulaireAjustement'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Ajustements de stock' }

export default async function PageAjustements() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.STOCK_AJUSTEMENT)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: entrepots }, { data: produits }, { data: ajustements }] = await Promise.all([
        adminClient.from('warehouses')
            .select('id, nom, est_defaut')
            .eq('shop_id', shopId).eq('est_actif', true)
            .order('est_defaut', { ascending: false }),
        adminClient.from('products')
            .select('id, nom, unite, stock_levels(quantite, warehouse_id)')
            .eq('shop_id', shopId).eq('est_actif', true)
            .order('nom'),
        adminClient.from('stock_adjustments')
            .select(`
                id, public_id, motif, note, created_at,
                warehouses(nom),
                stock_adjustment_items(quantite_avant, quantite_apres, ecart, products(nom))
            `)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(20),
    ])

    const produitsAvecStock = (produits ?? []).map(p => ({
        id:     p.id,
        nom:    p.nom,
        unite:  p.unite,
        stocks: Object.fromEntries(
            (p.stock_levels ?? []).map((s: { warehouse_id: string; quantite: number }) =>
                [s.warehouse_id, s.quantite])
        ) as Record<string, number>,
    }))

    const nom = (rel: unknown) =>
        Array.isArray(rel) ? (rel[0] as { nom?: string })?.nom : (rel as { nom?: string })?.nom

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Ajustements de stock</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Corriger une quantité sur quelques produits, sans lancer un inventaire complet
                </p>
            </header>

            <main className="flex-1 p-4 sm:p-6">
                <div className="max-w-4xl mx-auto space-y-5">

                    <FormulaireAjustement entrepots={entrepots ?? []} produits={produitsAvecStock} />

                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-[#15335a]" />
                            <h2 className="text-sm font-bold text-gray-900">Derniers ajustements</h2>
                        </div>

                        {(ajustements ?? []).length === 0 ? (
                            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                                Aucun ajustement enregistré.
                            </p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {(ajustements ?? []).map(a => (
                                    <li key={a.id} className="px-5 py-4">
                                        <div className="flex items-start justify-between gap-3 flex-wrap">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{a.motif}</p>
                                                <p className="text-xs font-mono text-gray-400 mt-0.5">
                                                    {a.public_id} · {nom(a.warehouses)} · {formatDate(a.created_at)}
                                                </p>
                                                {a.note && <p className="text-xs text-gray-500 mt-1">{a.note}</p>}
                                            </div>
                                            <ul className="text-xs text-gray-600 text-right">
                                                {(a.stock_adjustment_items ?? []).map((i: {
                                                    quantite_avant: number; quantite_apres: number; ecart: number
                                                    products: { nom: string } | { nom: string }[] | null
                                                }, idx: number) => {
                                                    const p = Array.isArray(i.products) ? i.products[0] : i.products
                                                    return (
                                                        <li key={idx}>
                                                            {p?.nom} — {i.quantite_avant} → {i.quantite_apres}{' '}
                                                            <strong className={i.ecart > 0 ? 'text-green-600' : 'text-red-600'}>
                                                                ({i.ecart > 0 ? '+' : ''}{i.ecart})
                                                            </strong>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
