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
        super_admin_boutique: 'Propriétaire',
        admin_boutique:       'Administrateur',
        vendeur:              'Vendeur',
        gestionnaire_stock:   'Gestionnaire de stock',
        stock_manager:        'Gestionnaire de stock',
        comptable:            'Comptable',
    }

    return (
        <div className="flex flex-col min-h-screen">

            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center shrink-0">
                        <span className="text-xl font-black text-foreground">
                            {utilisateur?.nom_complet?.charAt(0).toUpperCase() ?? '?'}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                            {utilisateur?.nom_complet}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {utilisateur?.public_id} · {ROLES_LABELS[utilisateur?.role ?? ''] ?? utilisateur?.role}
                        </p>
                    </div>
                    <div className="ml-auto hidden sm:block">
                        <p className="text-xs text-muted-foreground text-right">Boutique</p>
                        <p className="text-sm font-bold text-foreground">{boutique?.nom}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-2xl mx-auto w-full">
                <ProfilUtilisateur
                    utilisateur={utilisateur as any}
                    boutique={boutique as any}
                />
            </main>
        </div>
    )
}