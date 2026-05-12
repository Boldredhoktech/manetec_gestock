import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauFournisseurs from '@/components/shop/fournisseurs/TableauFournisseurs'

export const metadata: Metadata = { title: 'Fournisseurs' }

export default async function PageFournisseurs() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()
    const { data: fournisseurs } = await adminClient
        .from('suppliers')
        .select('id, public_id, nom, telephone, email, solde_du, est_actif, created_at')
        .eq('shop_id', user.user_metadata.shop_id)
        .order('nom')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Fournisseurs</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {fournisseurs?.length ?? 0} fournisseur(s)
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/stock/fournisseurs/nouveau">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouveau fournisseur
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-6">
                <TableauFournisseurs fournisseurs={fournisseurs ?? []} />
            </main>
        </div>
    )
}