import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauAgents from '@/components/redhok/TableauAgents'

export const metadata: Metadata = { title: 'Agents' }

export default async function PageAgents() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') {
        redirect('/redhok/login')
    }

    const estSuperAdmin = user.user_metadata?.role === 'super_platform_admin'
    const adminClient = createAdminClient()

    const { data: agents } = await adminClient
        .from('platform_admins')
        .select('id, public_id, nom_complet, email, role, est_actif, created_at')
        .order('created_at', { ascending: false })

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Équipe Manetec Inter BJ
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {agents?.length ?? 0} membre(s)
                        </p>
                    </div>
                    {estSuperAdmin && (
                        <Button asChild>
                            <Link href="/redhok/agents/nouveau">
                                <Plus className="w-4 h-4 mr-2" />
                                Nouvel agent
                            </Link>
                        </Button>
                    )}
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <TableauAgents
                    agents={agents ?? []}
                    estSuperAdmin={estSuperAdmin}
                />
            </main>
        </div>
    )
}