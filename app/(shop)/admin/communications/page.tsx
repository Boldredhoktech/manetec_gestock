import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import FormulairePromo from '@/components/shop/FormulairePromo'
import { ROLES } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Communications clients' }

export default async function PageCommunications() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) redirect('/admin/dashboard')

    const adminClient = createAdminClient()
    const { data: boutique } = await adminClient
        .from('shops').select('plan').eq('id', user.user_metadata.shop_id).single()

    if (boutique?.plan !== 'enterprise') {
        return (
            <div className="flex flex-col min-h-screen">
                <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                    <h1 className="text-xl font-bold text-foreground">Communications</h1>
                </header>
                <main className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center space-y-3 max-w-sm">
                        <div className="text-4xl">🔒</div>
                        <h2 className="text-lg font-semibold text-foreground">Fonctionnalité Enterprise</h2>
                        <p className="text-sm text-muted-foreground">
                            L'envoi d'emails promotionnels à vos clients est réservé au plan Enterprise.
                            Contactez Bold Redhok Tech pour passer au plan supérieur.
                        </p>
                    </div>
                </main>
            </div>
        )
    }

    const { data: clients } = await adminClient
        .from('clients')
        .select('id, nom, email')
        .eq('shop_id', user.user_metadata.shop_id)
        .eq('est_actif', true)
        .eq('est_anonyme', false)
        .not('email', 'is', null)
        .order('nom')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Communications clients</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Envoyez des emails promotionnels à vos clients
                </p>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-2xl">
                <FormulairePromo
                    clients={(clients ?? []) as { id: string; nom: string; email: string }[]}
                    nomBoutique={user.user_metadata.shop_nom ?? 'Boutique'}
                />
            </main>
        </div>
    )
}