import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CarteStatsRedhok from '@/components/redhok/CarteStatsRedhok'
import AccesRapidesRedhok from '@/components/redhok/AccesRapidesRedhok'
import TableauDerniersBoutiques from '@/components/redhok/TableauDerniersBoutiques'

export const metadata: Metadata = { title: 'Dashboard Plateforme' }

export default async function PageDashboardRedhok() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') {
        redirect('/redhok/login')
    }

    const adminClient = createAdminClient()

    const { data: admin } = await adminClient
        .from('platform_admins')
        .select('id, public_id, nom_complet, email, role')
        .eq('id', user.user_metadata.admin_id)
        .single()

    if (!admin) redirect('/redhok/login')

    const [
        { count: totalBoutiques },
        { count: boutiquesActives },
        { count: boutiquesPro },
        { count: boutiquesEnterprise },
        { count: boutiquesExpirantBientot },
        { data: dernieresBoutiques },
    ] = await Promise.all([
        adminClient.from('shops').select('*', { count: 'exact', head: true }),
        adminClient.from('shops').select('*', { count: 'exact', head: true }).eq('est_active', true),
        adminClient.from('shops').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
        adminClient.from('shops').select('*', { count: 'exact', head: true }).eq('plan', 'enterprise'),
        adminClient.from('shops').select('*', { count: 'exact', head: true })
            .eq('est_active', true)
            .lt('plan_expire_le', new Date(Date.now() + 7 * 86400000).toISOString()),
        adminClient.from('shops')
            .select('id, public_id, nom, plan, est_active, plan_expire_le, created_at, ville, pays')
            .order('created_at', { ascending: false })
            .limit(5),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">
                    Bonjour, {admin.nom_complet} 👋
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Manetec Inter BJ · Vue d'ensemble de la plateforme
                </p>
            </header>

            <main className="flex-1 p-4 sm:p-6 space-y-6">

                {/* Alerte boutiques expirant */}
                {(boutiquesExpirantBientot ?? 0) > 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
                        ⚠️ <strong>{boutiquesExpirantBientot}</strong> boutique(s) ont leur abonnement
                        qui expire dans moins de 7 jours.{' '}
                        <a href="/redhok/boutiques" className="underline font-medium">
                            Voir les boutiques →
                        </a>
                    </div>
                )}

                {/* Stats */}
                <CarteStatsRedhok
                    stats={{
                        totalBoutiques:         totalBoutiques ?? 0,
                        boutiquesActives:       boutiquesActives ?? 0,
                        boutiquesPro:           boutiquesPro ?? 0,
                        boutiquesEnterprise:    boutiquesEnterprise ?? 0,
                        boutiquesExpirantBientot: boutiquesExpirantBientot ?? 0,
                    }}
                />

                {/* Accès rapides */}
                <AccesRapidesRedhok role={admin.role} />

                {/* Dernières boutiques */}
                <TableauDerniersBoutiques boutiques={dernieresBoutiques ?? []} />

            </main>
        </div>
    )
}