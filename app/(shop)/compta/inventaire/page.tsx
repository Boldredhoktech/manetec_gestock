//app/(shop)/compta/inventaire/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import GestionInventaire from '@/components/shop/compta/GestionInventaire'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Inventaire physique' }

export default async function PageInventaire() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    // Accessible au gestionnaire de stock (inventaire) ou au comptable (vue compta).
    if (!aPermission(user, PERMISSIONS.STOCK_INVENTAIRE_CREER)
        && !aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) {
        redirect('/admin/dashboard')
    }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: entrepots }, { data: inventaires }, { data: boutique }] =
        await Promise.all([
            adminClient.from('warehouses')
                .select('id, nom, est_defaut')
                .eq('shop_id', shopId)
                .eq('est_actif', true),
            adminClient.from('inventories')
                .select(`
          id, public_id, nom, statut, created_at,
          valeur_pertes, valeur_gains,
          nb_ecarts_negatifs, nb_ecarts_positifs,
          warehouses(nom),
          inventory_items(
            id, quantite_theorique, quantite_reelle, ecart,
            products(id, nom, unite, prix_achat, categories(nom))
          )
        `)
                .eq('shop_id', shopId)
                .order('created_at', { ascending: false })
                .limit(10),
            adminClient.from('shops')
                .select('devise')
                .eq('id', shopId)
                .single(),
        ])

    return (
        <div className="flex flex-col min-h-screen">

            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Inventaire physique</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Comptage physique et ajustement automatique du stock
                </p>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl mx-auto w-full">
                <GestionInventaire
                    entrepots={entrepots ?? []}
                    inventaires={inventaires ?? []}
                    devise={boutique?.devise ?? 'FCFA'}
                />
            </main>
        </div>
    )
}