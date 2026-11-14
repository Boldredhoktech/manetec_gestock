// app/(shop)/admin/ventes/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { redirect, notFound } from 'next/navigation'
import FicheVente from '@/components/shop/ventes/FicheVente'
import EnTetePage from '@/components/shop/EnTetePage'

export const metadata: Metadata = { title: 'Détail vente' }

export default async function PageDetailVente({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.VENTES_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: vente } = await adminClient
        .from('sales')
        .select(`
            *,
            clients(nom, public_id, telephone),
            shop_users!sales_vendeur_id_fkey(nom_complet),
            sale_items(
                id, quantite, prix_unitaire, remise_pct,
                montant_ligne, imei, note,
                products(nom, unite, public_id)
            ),
            sale_payments(moyen_paiement, montant, reference)
        `)
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!vente) notFound()

    // Une vente déjà retournée ne s'annule pas : le stock reviendrait
    // deux fois. Le serveur le refuse ; on le dit à l'écran.
    const { count: nbRetours } = await adminClient
        .from('sale_returns')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('sale_id', id)

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre={vente.public_id}
                sousTitre={(vente.clients as { nom: string } | null)?.nom ?? 'Client de passage'}
                ariane={[{ label: 'Ventes', href: '/admin/ventes' }, { label: vente.public_id }]}
            />
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-3xl">
                <FicheVente
                    vente={vente as never}
                    aDesRetours={(nbRetours ?? 0) > 0}
                    peutAnnuler={aPermission(user, PERMISSIONS.VENTES_RETOUR)}
                />
            </main>
        </div>
    )
}
