import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import InterfacePOS from '@/components/shop/pos/InterfacePOS'
import { AlertTriangle } from 'lucide-react'

export const metadata: Metadata = { title: 'Caisse — POS' }

export default async function PagePOS() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [
        { data: entrepots },
        { data: boutique },
        { data: clients },
    ] = await Promise.all([
        adminClient.from('warehouses')
            .select('id, nom, est_defaut')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
        adminClient.from('shops')
            .select('nom, devise, remise_max_pct, plan')
            .eq('id', shopId)
            .single(),
        adminClient.from('clients')
            .select('id, public_id, nom, telephone, credit_balance, advance_balance, change_balance')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .eq('est_anonyme', false)
            .order('nom')
            .limit(200),
    ])

    if (!entrepots || entrepots.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 text-sm max-w-md text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 mx-auto" />
                    <p>Aucun entrepôt actif. Créez un entrepôt avant d'utiliser la caisse.</p>
                </div>
            </div>
        )
    }

    const entrepotDefaut = entrepots.find(e => e.est_defaut) ?? entrepots[0]

    return (
        <InterfacePOS
            shopId={shopId}
            vendeurId={user.user_metadata.user_id}
            vendeurNom={user.user_metadata.nom_complet}
            boutique={boutique!}
            entrepots={entrepots}
            entrepotDefautId={entrepotDefaut.id}
            clients={clients ?? []}
        />
    )
}