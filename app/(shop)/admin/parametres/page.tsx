import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ROLES } from '@/lib/constants/permissions'
import ParametresBoutique from '@/components/shop/parametres/ParametresBoutique'

export const metadata: Metadata = { title: 'Paramètres boutique' }

export default async function PageParametres() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) redirect('/admin/dashboard')

    const adminClient = createAdminClient()
    const { data: boutique } = await adminClient
        .from('shops')
        .select('*')
        .eq('id', user.user_metadata.shop_id)
        .single()

    if (!boutique) redirect('/admin/dashboard')

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            {/* HEADER BLEU ROI */}
            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div>
                    <h1 className="text-xl font-bold text-white">Paramètres de la boutique</h1>
                    <p className="text-sm text-white/70 mt-0.5">
                        {boutique.nom} · Réservé au SuperAdmin
                    </p>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
                <ParametresBoutique boutique={boutique} />
            </main>
        </div>
    )
}