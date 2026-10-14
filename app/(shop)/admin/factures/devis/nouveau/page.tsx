// app/(shop)/admin/factures/devis/nouveau/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargerClientChoisi } from '@/lib/clients/client-choisi'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireDevis from '@/components/shop/facturation/FormulaireDevis'

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
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/admin/factures"
                          className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-foreground">Nouvelle proforma</h1>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-3xl">
                <FormulaireDevis
                    clientInitial={clientInitial}
                    peutCreerClient={aPermission(user, PERMISSIONS.CLIENTS_CREER)}
                    produits={produits ?? []}
                />
            </main>
        </div>
    )
}