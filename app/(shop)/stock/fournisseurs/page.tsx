import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import EnTetePage from '@/components/shop/EnTetePage'
import { ModaleUrl } from '@/components/ui/ModalesPartagees'
import { classeBouton } from '@/components/ui/classe-bouton'
import TableauFournisseurs from '@/components/shop/fournisseurs/TableauFournisseurs'
import FormulaireFournisseur from '@/components/shop/fournisseurs/FormulaireFournisseur'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Fournisseurs' }

export default async function PageFournisseurs() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FOURNISSEURS_VOIR)) redirect('/admin/dashboard')
    const peutCreer = aPermission(user, PERMISSIONS.FOURNISSEURS_CREER)

    const adminClient = createAdminClient()

    // La colonne s'appelle « solde_dû », avec son accent. Ecrite ici
    // « solde_du », elle n'existait pas : PostgREST rendait une erreur,
    // le `?? []` la changeait en liste vide, et la page annoncait
    // « 0 fournisseur(s) » sur une boutique qui en comptait six.
    // L'alias PostgREST rend le nom lisible cote TypeScript.
    const { data: fournisseurs, error } = await adminClient
        .from('suppliers')
        .select('id, public_id, nom, telephone, email, solde_du:"solde_dû", est_actif, created_at')
        .eq('shop_id', user.user_metadata.shop_id)
        .order('nom')

    if (error) {
        throw new Error(`Liste des fournisseurs illisible : ${error.message}`)
    }

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre="Fournisseurs"
                sousTitre={`${fournisseurs?.length ?? 0} fournisseur(s)`}
                ariane={[{ label: 'Achats' }, { label: 'Fournisseurs' }]}
                actions={peutCreer ? (
                    <Link href="/stock/fournisseurs?nouveau=1" scroll={false} className={classeBouton('primaire')}>
                        <Plus className="w-4 h-4" aria-hidden="true" />Nouveau fournisseur
                    </Link>
                ) : undefined}
            />
            {peutCreer && (
                <ModaleUrl param="nouveau" titre="Nouveau fournisseur" description="Seul le nom est obligatoire." taille="lg">
                    <FormulaireFournisseur />
                </ModaleUrl>
            )}
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
                <TableauFournisseurs fournisseurs={fournisseurs ?? []} />
            </main>
        </div>
    )
}