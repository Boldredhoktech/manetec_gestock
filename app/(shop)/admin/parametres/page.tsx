import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CarteInfosParametres from '@/components/shop/CarteInfosParametres'
import { ROLES } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Paramètres' }

export default async function PageParametres() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) {
        redirect('/admin/dashboard')
    }

    const adminClient = createAdminClient()
    const { data: boutique } = await adminClient
        .from('shops')
        .select('*')
        .eq('id', user.user_metadata.shop_id)
        .single()

    if (!boutique) redirect('/admin/dashboard')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Paramètres</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Informations et configuration de votre boutique
                </p>
            </header>
            <main className="flex-1 p-6 max-w-2xl space-y-6">
                <CarteInfosParametres boutique={boutique} />
            </main>
        </div>
    )
}