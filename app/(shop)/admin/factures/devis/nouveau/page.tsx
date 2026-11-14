// app/(shop)/admin/factures/devis/nouveau/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargerClientChoisi } from '@/lib/clients/client-choisi'
import { redirect } from 'next/navigation'
import FormulaireDevis from '@/components/shop/facturation/FormulaireDevis'
import EnTetePage from '@/components/shop/EnTetePage'

export const metadata: Metadata = { title: 'Nouvelle proforma' }

interface PageProps {
    searchParams: Promise<{ clientId?: string }>
}

export default async function PageNouveauDevis({ searchParams }: PageProps) {
    const { clientId: clientIdParam } = await searchParams
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FACTURES_CREER)) redirect('/admin/factures')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [clientInitial, { data: produits }] = await Promise.all([
        chargerClientChoisi(adminClient, shopId, clientIdParam),
        adminClient.from('products')
            .select('id, nom, prix_vente, tva_pct, unite')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre="Nouvelle proforma"
                ariane={[{ label: 'Ventes' }, { label: 'Factures', href: '/admin/factures' }, { label: 'Nouvelle proforma' }]}
            />
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-3xl">
                <FormulaireDevis
                    clientInitial={clientInitial}
                    peutCreerClient={aPermission(user, PERMISSIONS.CLIENTS_CREER)}
                    produits={produits ?? []}
                />
            </main>
        </div>
    )
}