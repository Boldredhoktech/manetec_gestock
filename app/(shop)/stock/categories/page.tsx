// app/(shop)/stock/categories/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import GestionCategories from '@/components/shop/GestionCategories'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Catégories' }

export default async function PageCategories() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.PRODUITS_VOIR)) redirect('/admin/dashboard')

    const adminClient = createAdminClient()
    const { data: categories } = await adminClient
        .from('categories')
        .select('id, public_id, nom, parent_id, est_actif')
        .eq('shop_id', user.user_metadata.shop_id)
        .order('nom')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Catégories</h1>
            </header>
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-2xl">
                <GestionCategories categories={categories ?? []} />
            </main>
        </div>
    )
}