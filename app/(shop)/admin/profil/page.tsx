// app/(shop)/admin/profil/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ProfilUtilisateur from '@/components/shop/profil/ProfilUtilisateur'

export const metadata: Metadata = { title: 'Mon profil' }

export default async function PageProfil() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()
    const { data: utilisateur } = await adminClient
        .from('shop_users')
        .select('id, public_id, nom_complet, identifiant, role, created_at, est_actif')
        .eq('id', user.user_metadata.user_id)
        .single()

    const { data: boutique } = await adminClient
        .from('shops')
        .select('nom, plan, plan_expire_le, devise')
        .eq('id', user.user_metadata.shop_id)
        .single()

    const ROLES_LABELS: Record<string, string> = {
        super_admin_boutique: 'Super Administrateur',
        vendeur:              'Vendeur',
        gestionnaire_stock:   'Gestionnaire de stock',
        comptable:            'Comptable',
    }

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                        <span className="text-xl font-black text-white">
                            {utilisateur?.nom_complet?.charAt(0).toUpperCase() ?? '?'}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">
                            {utilisateur?.nom_complet}
                        </h1>
                        <p className="text-sm text-white/70 mt-0.5">
                            {utilisateur?.public_id} · {ROLES_LABELS[utilisateur?.role ?? ''] ?? utilisateur?.role}
                        </p>
                    </div>
                    <div className="ml-auto hidden sm:block">
                        <p className="text-xs text-white/60 text-right">Boutique</p>
                        <p className="text-sm font-bold text-white">{boutique?.nom}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full">
                <ProfilUtilisateur
                    utilisateur={utilisateur as any}
                    boutique={boutique as any}
                />
            </main>
        </div>
    )
}