import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauBoutiques from '@/components/redhok/TableauBoutiques'
import ZoneDangerBoutiques from '@/components/redhok/ZoneDangerBoutiques'

export const metadata: Metadata = { title: 'Boutiques' }

export default async function PageBoutiques() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') {
        redirect('/redhok/login')
    }

    const adminClient = createAdminClient()

    const { data: boutiques } = await adminClient
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false })

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Boutiques</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {boutiques?.length ?? 0} boutique(s) enregistrée(s)
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/redhok/boutiques/nouvelle">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle boutique
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <TableauBoutiques boutiques={boutiques ?? []} />
                {user.user_metadata?.role === 'super_platform_admin' && (
                    <ZoneDangerBoutiques />
                )}
            </main>
        </div>
    )
}