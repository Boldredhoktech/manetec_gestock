import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { estAdminComplet } from '@/lib/constants/permissions'
import ParametresBoutique from '@/components/shop/parametres/ParametresBoutique'

export const metadata: Metadata = { title: 'Paramètres boutique' }

export default async function PageParametres() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!estAdminComplet(user.user_metadata?.role)) redirect('/admin/dashboard')

    const adminClient = createAdminClient()
    const { data: boutique } = await adminClient
        .from('shops')
        .select('*')
        .eq('id', user.user_metadata.shop_id)
        .single()

    if (!boutique) redirect('/admin/dashboard')

    return (
        <div className="flex flex-col min-h-screen">

            {/* HEADER BLEU ROI */}
            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Paramètres de la boutique</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {boutique.nom} · Réservé au SuperAdmin
                    </p>
                </div>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl w-full">
                <ParametresBoutique boutique={boutique} />
            </main>
        </div>
    )
}