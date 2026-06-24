// app/(shop)/stock/factures-fournisseurs/nouvelle/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireFactureFournisseurGlobal from '@/components/shop/fournisseurs/FormulaireFactureFournisseurGlobal'

export const metadata: Metadata = { title: 'Nouvelle facture fournisseur' }

export default async function PageNouvelleFactureFournisseurGlobal() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

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
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">
            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <Link href="/stock/factures-fournisseurs"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">Nouvelle facture fournisseur</h1>
                        <p className="text-sm text-white/70 mt-0.5">
                            Sélectionnez le fournisseur et saisissez les articles
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-3xl mx-auto w-full">
                <FormulaireFactureFournisseurGlobal
                    fournisseurs={fournisseurs ?? []}
                    produits={produits ?? []}
                    entrepots={entrepots ?? []}
                />
            </main>
        </div>
    )
}