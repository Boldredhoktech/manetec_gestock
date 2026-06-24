// app/(shop)/admin/clients/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauClients from '@/components/shop/TableauClients'

export const metadata: Metadata = { title: 'Clients' }

export default async function PageClients() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()
    const { data: clients } = await adminClient
        .from('clients')
        .select('id, public_id, nom, telephone, email, credit_balance, advance_balance, change_balance, est_actif, est_anonyme, created_at')
        .eq('shop_id', user.user_metadata.shop_id)
        .order('created_at', { ascending: false })

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Clients</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {clients?.filter(c => !c.est_anonyme).length ?? 0} client(s) enregistré(s)
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/admin/clients/nouveau">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouveau client
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <TableauClients clients={clients?.filter(c => !c.est_anonyme) ?? []} />
            </main>
        </div>
    )
}