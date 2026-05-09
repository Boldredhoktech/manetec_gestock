import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireProduit from '@/components/shop/FormulaireProduit'

export const metadata: Metadata = { title: 'Nouveau produit' }

export default async function PageNouveauProduit() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: categories }, { data: marques }, { data: entrepots }] =
        await Promise.all([
            adminClient.from('categories').select('id, nom, parent_id')
                .eq('shop_id', shopId).eq('est_actif', true).order('nom'),
            adminClient.from('brands').select('id, nom')
                .eq('shop_id', shopId).eq('est_actif', true).order('nom'),
            adminClient.from('warehouses').select('id, nom, est_defaut')
                .eq('shop_id', shopId).eq('est_actif', true).order('nom'),
        ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/stock/produits" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Nouveau produit</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Ajouter un produit au catalogue
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-6 max-w-2xl">
                <FormulaireProduit
                    categories={categories ?? []}
                    marques={marques ?? []}
                    entrepots={entrepots ?? []}
                />
            </main>
        </div>
    )
}