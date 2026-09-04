// app/(shop)/compta/depenses/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ListeDepenses from '@/components/shop/compta/ListeDepenses'
import GestionCategoriesDepense from '@/components/shop/compta/GestionCategoriesDepense'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Dépenses' }

export default async function PageDepenses() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: depenses }, { data: categories }] = await Promise.all([
        adminClient.from('expenses')
            .select('id, public_id, libelle, montant, moyen_paiement, date_depense, est_annule, expense_categories(nom)')
            .eq('shop_id', shopId)
            .order('date_depense', { ascending: false })
            .limit(50),
        // Les catégories retirées sont chargées elles aussi : l'écran
        // doit pouvoir les remettre en service.
        adminClient.from('expense_categories')
            .select('id, nom, est_actif').eq('shop_id', shopId).order('nom'),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-foreground">Dépenses</h1>
                    <Button asChild>
                        <Link href="/compta/depenses/nouvelle">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle dépense
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 space-y-6">
                <GestionCategoriesDepense categories={categories ?? []} />
                <ListeDepenses depenses={depenses ?? []} />
            </main>
        </div>
    )
}