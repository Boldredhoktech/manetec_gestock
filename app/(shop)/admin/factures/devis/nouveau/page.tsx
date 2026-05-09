import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireDevis from '@/components/shop/facturation/FormulaireDevis'

export const metadata: Metadata = { title: 'Nouveau devis' }

export default async function PageNouveauDevis() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: clients }, { data: produits }] = await Promise.all([
        adminClient.from('business_clients').select('id, nom')
            .eq('shop_id', shopId).eq('est_actif', true).order('nom'),
        adminClient.from('products').select('id, nom, prix_vente, tva_pct, unite')
            .eq('shop_id', shopId).eq('est_actif', true).order('nom'),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/admin/factures" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-foreground">Nouveau devis</h1>
                </div>
            </header>
            <main className="flex-1 p-6 max-w-3xl">
                <FormulaireDevis clients={clients ?? []} produits={produits ?? []} />
            </main>
        </div>
    )
}