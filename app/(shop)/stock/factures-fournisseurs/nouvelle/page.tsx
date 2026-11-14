// app/(shop)/stock/factures-fournisseurs/nouvelle/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireFactureFournisseurGlobal from '@/components/shop/fournisseurs/FormulaireFactureFournisseurGlobal'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Nouvelle facture fournisseur' }

export default async function PageNouvelleFactureFournisseurGlobal() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FACTURE_FOURNISSEUR_SAISIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: fournisseurs }, { data: produits }, { data: entrepots }] = await Promise.all([
        adminClient.from('suppliers')
            .select('id, nom, public_id')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
        adminClient.from('products')
            .select('id, nom, prix_achat, unite')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
        adminClient.from('warehouses')
            .select('id, nom')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/stock/factures-fournisseurs"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors">
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Nouvelle facture fournisseur</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Sélectionnez le fournisseur et saisissez les articles
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl w-full">
                <FormulaireFactureFournisseurGlobal
                    fournisseurs={fournisseurs ?? []}
                    produits={produits ?? []}
                    entrepots={entrepots ?? []}
                />
            </main>
        </div>
    )
}