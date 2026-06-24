//app/(shop)/compta/inventaire/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import GestionInventaire from '@/components/shop/compta/GestionInventaire'

export const metadata: Metadata = { title: 'Inventaire physique' }

export default async function PageInventaire() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

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
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <h1 className="text-xl font-bold text-white">Inventaire physique</h1>
                <p className="text-sm text-white/70 mt-0.5">
                    Comptage physique et ajustement automatique du stock
                </p>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
                <GestionInventaire
                    entrepots={entrepots ?? []}
                    inventaires={inventaires ?? []}
                    devise={boutique?.devise ?? 'FCFA'}
                />
            </main>
        </div>
    )
}