import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauEntrepots from '@/components/shop/TableauEntrepots'

export const metadata: Metadata = { title: 'Entrepôts' }

export default async function PageEntrepots() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()
    const { data: entrepots } = await adminClient
        .from('warehouses')
        .select('*')
        .eq('shop_id', user.user_metadata.shop_id)
        .order('created_at', { ascending: true })

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Entrepôts</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {entrepots?.length ?? 0} entrepôt(s)
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/stock/entrepots/nouveau">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvel entrepôt
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-6">
                <TableauEntrepots entrepots={entrepots ?? []} />
            </main>
        </div>
    )
}