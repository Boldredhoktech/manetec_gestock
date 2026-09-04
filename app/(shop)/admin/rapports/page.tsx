import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanBoutique } from '@/lib/supabase/getPlanBoutique'
import { redirect } from 'next/navigation'
import { BarChart3, Lock } from 'lucide-react'
import CentreRapports from '@/components/shop/rapports/CentreRapports'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Rapports' }

export default async function PageRapports() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.RAPPORTS_GENERER)) redirect('/admin/dashboard')

    const shopId = user.user_metadata.shop_id as string
    const { limites } = await getPlanBoutique(shopId)

    // L'etat du stock accepte un entrepot depuis toujours ; l'ecran ne
    // le proposait pas, faute d'avoir la liste sous la main.
    const { data: entrepots } = await createAdminClient()
        .from('warehouses')
        .select('id, nom')
        .eq('shop_id', shopId)
        .order('nom')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Rapports</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Affichez un rapport pour le vérifier, puis gardez-le en PDF ou en CSV
                </p>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                {limites.rapports ? (
                    <CentreRapports entrepots={entrepots ?? []} />
                ) : (
                    <div className="flex items-center justify-center py-16">
                        <div className="text-center space-y-3 max-w-sm">
                            <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
                            <h2 className="text-lg font-semibold text-foreground">Fonctionnalité Pro</h2>
                            <p className="text-sm text-muted-foreground">
                                Les rapports PDF (ventes, stock, clients, etc.) sont réservés aux plans
                                Pro et Enterprise. Contactez Manetec Inter BJ pour passer au plan supérieur.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}