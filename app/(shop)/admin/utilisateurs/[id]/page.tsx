// app/(shop)/admin/utilisateurs/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { estAdminComplet, ROLES } from '@/lib/constants/permissions'
import GestionPermissionsUser from '@/components/shop/utilisateurs/GestionPermissionsUser'

export const metadata: Metadata = { title: 'Fiche utilisateur' }

interface Props { params: Promise<{ id: string }> }

export default async function PageFicheUtilisateur({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!estAdminComplet(user.user_metadata?.role)) redirect('/admin/dashboard')

    const estProprietaire = user.user_metadata.role === ROLES.SUPER_ADMIN_BOUTIQUE
    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: utilisateur } = await adminClient
        .from('shop_users')
        .select(`
      id, public_id, nom_complet, identifiant, role,
      est_actif, created_at,
      shop_user_permissions!shop_user_permissions_user_id_fkey(permission, accorde_par, accorde_le)
    `)
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!utilisateur) notFound()

    // Un administrateur non-propriétaire ne peut pas ouvrir la fiche d'un
    // autre admin/propriétaire.
    if (estAdminComplet(utilisateur.role) && !estProprietaire
        && utilisateur.id !== user.user_metadata.user_id) {
        redirect('/admin/utilisateurs')
    }

    return (
        <div className="flex flex-col min-h-screen">

            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/utilisateurs"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors">
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{utilisateur.nom_complet}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {utilisateur.public_id} · {utilisateur.identifiant}
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                utilisateur.est_actif
                    ? 'bg-green-500/20 text-green-300 border-green-400/40'
                    : 'bg-red-500/20 text-red-300 border-red-400/40'
            }`}>
              {utilisateur.est_actif ? 'Actif' : 'Désactivé'}
            </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl w-full">
                <GestionPermissionsUser
                    utilisateur={utilisateur as any}
                    shopId={shopId}
                    currentUserId={user.user_metadata.user_id}
                    estProprietaire={estProprietaire}
                />
            </main>
        </div>
    )
}