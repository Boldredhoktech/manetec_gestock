import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import GestionCategories from '@/components/shop/GestionCategories'

export const metadata: Metadata = { title: 'Catégories' }

export default async function PageCategories() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()
    const { data: categories } = await adminClient
        .from('categories')
        .select('id, public_id, nom, parent_id, est_actif')
        .eq('shop_id', user.user_metadata.shop_id)
        .order('nom')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Catégories</h1>
            </header>
            <main className="flex-1 p-6 max-w-2xl">
                <GestionCategories categories={categories ?? []} />
            </main>
        </div>
    )
}