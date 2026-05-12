// app/(shop)/admin/utilisateurs/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauUtilisateurs from '@/components/shop/TableauUtilisateurs'
import { ROLES } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Utilisateurs' }

export default async function PageUtilisateurs() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) {
        redirect('/admin/dashboard')
    }

    const shopId = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: utilisateurs } = await adminClient
        .from('shop_users')
        .select(`
      id, public_id, nom_complet, identifiant, role,
      est_actif, est_bloque, tentatives_echecs,
      created_at, desactive_le
    `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Utilisateurs</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {utilisateurs?.length ?? 0} utilisateur(s) dans cette boutique
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/admin/utilisateurs/nouveau">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvel utilisateur
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-6">
                <TableauUtilisateurs utilisateurs={utilisateurs ?? []} />
            </main>
        </div>
    )
}