import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauProduits from '@/components/shop/TableauProduits'

export const metadata: Metadata = { title: 'Produits' }

export default async function PageProduits() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: produits } = await adminClient
        .from('products')
        .select(`
      id, public_id, nom, type_produit, sku, code_barres,
      prix_achat, prix_vente, prix_gros, prix_minimum,
      unite, seuil_alerte, est_actif,
      categories(nom),
      brands(nom),
      stock_levels(quantite, warehouse_id)
    `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })

    // Normalisation : categories et brands sont des relations *-to-one, Supabase les retourne en tableau
    const produitsNormalises = (produits ?? []).map(p => ({
        ...p,
        categories: Array.isArray(p.categories) ? (p.categories[0] ?? null) : p.categories,
        brands:     Array.isArray(p.brands)      ? (p.brands[0]      ?? null) : p.brands,
    }))

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Produits</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {produits?.length ?? 0} produit(s) au catalogue
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/stock/produits/nouveau">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouveau produit
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-6">
                <TableauProduits produits={produitsNormalises} />
            </main>
        </div>
    )
}