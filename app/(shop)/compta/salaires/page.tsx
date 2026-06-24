import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ListeEmployes from '@/components/shop/compta/ListeEmployes'

export const metadata: Metadata = { title: 'Salaires' }

export default async function PageSalaires() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: employes } = await adminClient
        .from('employees')
        .select(`
      id, nom_complet, poste, salaire_base, est_actif,
      salary_payments(montant_net, periode_mois, periode_annee, date_paiement)
    `)
        .eq('shop_id', shopId)
        .eq('est_actif', true)
        .order('nom_complet')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-foreground">Salaires</h1>
                    <Button asChild>
                        <Link href="/compta/salaires/nouvel-employe">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvel employé
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <ListeEmployes employes={employes ?? []} />
            </main>
        </div>
    )
}