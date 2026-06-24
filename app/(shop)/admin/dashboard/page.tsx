import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CartesStatsBoutique from '@/components/shop/dashboard/CartesStatsBoutique'
import AccesRapidesBoutique from '@/components/shop/dashboard/AccesRapidesBoutique'
import AlertesStock from '@/components/shop/dashboard/AlertesStock'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function PageDashboardAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const meta        = user.user_metadata
    const shopId      = meta.shop_id as string
    const adminClient = createAdminClient()

    const [
        { data: boutique },
        { count: nbProduits },
        { count: nbClients },
        { count: nbVentesAujourdhui },
        { data: ventesAujourdhui },
        { data: alertesStock },
    ] = await Promise.all([
        adminClient.from('shops')
            .select('nom, plan, plan_expire_le, devise, remise_max_pct')
            .eq('id', shopId).single(),
        adminClient.from('products')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId).eq('est_actif', true),
        adminClient.from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId).eq('est_actif', true).eq('est_anonyme', false),
        adminClient.from('sales')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .eq('statut', 'completee')
            .gte('created_at', new Date().toISOString().split('T')[0]),
        adminClient.from('sales')
            .select('montant_total')
            .eq('shop_id', shopId)
            .eq('statut', 'completee')
            .gte('created_at', new Date().toISOString().split('T')[0]),
        adminClient.from('products')
            .select('id, nom, public_id, seuil_alerte, stock_levels(quantite)')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .limit(50),
    ])

    const caAujourdhui = ventesAujourdhui?.reduce(
        (acc, v) => acc + (v.montant_total ?? 0), 0
    ) ?? 0

    // Produits en alerte
    const produitsEnAlerte = (alertesStock ?? []).filter(p => {
        const stock = (p.stock_levels as { quantite: number }[])
            .reduce((acc, s) => acc + s.quantite, 0)
        return stock <= p.seuil_alerte
    })

    const expireBientot = boutique?.plan_expire_le
        ? new Date(boutique.plan_expire_le) < new Date(Date.now() + 7 * 86400000)
        : false

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">
                    Bonjour, {meta.nom_complet} 👋
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {boutique?.nom} · Tableau de bord
                </p>
            </header>

            <main className="flex-1 p-4 sm:p-6 space-y-6">

                {/* Alerte expiration plan */}
                {expireBientot && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
                        ⚠️ Votre abonnement <strong>{boutique?.plan}</strong> expire le{' '}
                        <strong>
                            {new Date(boutique!.plan_expire_le!).toLocaleDateString('fr-FR')}
                        </strong>.
                        Contactez Bold Redhok Tech pour le renouveler.
                    </div>
                )}

                {/* Stats */}
                <CartesStatsBoutique
                    nbProduits={nbProduits ?? 0}
                    nbClients={nbClients ?? 0}
                    nbVentesAujourdhui={nbVentesAujourdhui ?? 0}
                    caAujourdhui={caAujourdhui}
                    devise={boutique?.devise ?? 'FCFA'}
                    role={meta.role}
                />

                {/* Alertes stock */}
                {produitsEnAlerte.length > 0 && (
                    <AlertesStock produits={produitsEnAlerte} />
                )}

                {/* Accès rapides */}
                <AccesRapidesBoutique role={meta.role} />

            </main>
        </div>
    )
}