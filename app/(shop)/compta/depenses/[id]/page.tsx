import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FicheDepense from '@/components/shop/compta/FicheDepense'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { historiqueCorrections } from '@/lib/audit/journaliser'

export const metadata: Metadata = { title: 'Dépense' }

export default async function PageDepense({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: depense }, { data: categories }] = await Promise.all([
        adminClient
            .from('expenses')
            .select(`
                id, public_id, libelle, montant, moyen_paiement, category_id,
                date_depense, note, reference, created_at,
                est_annule, annule_le, motif_annulation, modifie_le
            `)
            .eq('id', id)
            .eq('shop_id', shopId)
            .maybeSingle(),
        adminClient
            .from('expense_categories')
            .select('id, nom, est_actif')
            .eq('shop_id', shopId)
            .order('nom'),
    ])

    if (!depense) notFound()

    const historique = await historiqueCorrections(shopId, id)

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/compta/depenses" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{depense.libelle}</h1>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{depense.public_id}</p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-2xl">
                <FicheDepense
                    depense={depense}
                    // La catégorie retirée d'une dépense passée reste
                    // proposée pour ne pas la perdre à la première
                    // modification.
                    categories={(categories ?? []).filter(
                        c => c.est_actif || c.id === depense.category_id
                    )}
                    historique={historique}
                    peutModifier={aPermission(user, PERMISSIONS.DEPENSES_CREER)}
                />
            </main>
        </div>
    )
}
