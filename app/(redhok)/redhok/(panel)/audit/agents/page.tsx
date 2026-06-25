import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'
import TableauAuditGlobal from '@/components/redhok/TableauAuditGlobal'

export const metadata: Metadata = { title: 'Audit des agents' }

export default async function PageAuditAgents() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') redirect('/redhok/login')
    if (user.user_metadata?.role !== 'super_platform_admin') redirect('/redhok/dashboard')

    const adminClient = createAdminClient()

    const [{ data: logs }, { data: admins }, { data: shops }] = await Promise.all([
        adminClient.from('audit_logs')
            .select('id, event_type, type_acteur, user_id, user_nom, details_json, reference_public_id, created_at, shop_id')
            .eq('type_acteur', 'platform')
            .order('created_at', { ascending: false })
            .limit(1000),
        adminClient.from('platform_admins').select('id, role, email'),
        adminClient.from('shops').select('id, nom'),
    ])

    const adminParId = new Map((admins ?? []).map(a => [a.id, a]))
    const shopParId  = new Map((shops ?? []).map(s => [s.id, s]))
    const enrichis = (logs ?? []).map(l => {
        const a = adminParId.get(l.user_id)
        const s = l.shop_id ? shopParId.get(l.shop_id) : null
        return { ...l, acteur_role: a?.role ?? null, shop_nom: s?.nom ?? null }
    })

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/redhok/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <History className="w-5 h-5" /> Audit des agents
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Toutes les actions des administrateurs et agents plateforme ({enrichis.length})
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <TableauAuditGlobal logs={enrichis as any[]} mode="agents" />
            </main>
        </div>
    )
}
