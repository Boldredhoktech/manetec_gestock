import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireDepense from '@/components/shop/compta/FormulaireDepense'

export const metadata: Metadata = { title: 'Nouvelle dépense' }

export default async function PageNouvelleDepense() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()
    const { data: categories } = await adminClient
        .from('expense_categories')
        .select('id, nom')
        .eq('shop_id', user.user_metadata.shop_id)
        .eq('est_actif', true)
        .order('nom')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/compta/depenses" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-foreground">Nouvelle dépense</h1>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-lg">
                <FormulaireDepense categories={categories ?? []} />
            </main>
        </div>
    )
}