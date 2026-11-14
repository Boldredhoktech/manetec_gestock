// app/(shop)/admin/utilisateurs/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauUtilisateurs from '@/components/shop/TableauUtilisateurs'
import { estAdminComplet, ROLES } from '@/lib/constants/permissions'
import { ModaleUrl } from '@/components/ui/ModalesPartagees'
import FormulaireUtilisateur from '@/components/shop/FormulaireUtilisateur'

export const metadata: Metadata = { title: 'Utilisateurs' }

export default async function PageUtilisateurs({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !estAdminComplet(user.user_metadata?.role)) {
        redirect('/admin/dashboard')
    }

    const estProprietaire = user.user_metadata.role === ROLES.SUPER_ADMIN_BOUTIQUE
    const shopId = user.user_metadata.shop_id as string
    const peutCreer = true
    const { nouveau } = await searchParams
    const suffixeBoutique = nouveau !== undefined
        ? (await createAdminClient().from('shops').select('suffixe_identifiant').eq('id', shopId).single()).data?.suffixe_identifiant
        : null
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
            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Utilisateurs</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {utilisateurs?.length ?? 0} utilisateur(s) dans cette boutique
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/admin/utilisateurs?nouveau=1" scroll={false}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvel utilisateur
                        </Link>
                    </Button>
                </div>
            </header>
            {peutCreer && nouveau !== undefined && (
                <ModaleUrl param="nouveau" titre="Nouvel utilisateur" description="Un compte pour un membre de votre équipe." taille="lg">
                    <FormulaireUtilisateur estProprietaire={estProprietaire} suffixe={suffixeBoutique ?? ''} />
                </ModaleUrl>
            )}
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
                <TableauUtilisateurs
                    utilisateurs={utilisateurs ?? []}
                    estProprietaire={estProprietaire}
                    currentUserId={user.user_metadata.user_id}
                />
            </main>
        </div>
    )
}