import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'
import EnTetePage from '@/components/shop/EnTetePage'
import { ModaleUrl } from '@/components/ui/ModalesPartagees'
import { classeBouton } from '@/components/ui/classe-bouton'
import TableauEntrepots from '@/components/shop/TableauEntrepots'
import FormulaireEntrepot from '@/components/shop/FormulaireEntrepot'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getPlanBoutique } from '@/lib/supabase/getPlanBoutique'

export const metadata: Metadata = { title: 'Entrepôts' }

export default async function PageEntrepots() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.STOCK_VOIR)) redirect('/admin/dashboard')
    const peutCreer = aPermission(user, PERMISSIONS.STOCK_AJUSTEMENT)

    const adminClient = createAdminClient()
    const [{ data: entrepots }, { limites }] = await Promise.all([
        adminClient
            .from('warehouses')
            .select('*')
            .eq('shop_id', user.user_metadata.shop_id)
            .order('created_at', { ascending: true }),
        getPlanBoutique(user.user_metadata.shop_id),
    ])
    // Mig 037 : sans multi-entrepôts (Starter après l'essai), seuls les
    // mouvements de l'entrepôt par défaut sont acceptés.
    const entrepotsFiges = !limites.multi_entrepots && (entrepots?.length ?? 0) > 1

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre="Entrepôts"
                sousTitre={`${entrepots?.length ?? 0} entrepôt(s)`}
                ariane={[{ label: 'Stock' }, { label: 'Entrepôts' }]}
                actions={peutCreer ? (
                    <Link href="/stock/entrepots?nouveau=1" scroll={false} className={classeBouton('primaire')}>
                        <Plus className="w-4 h-4" aria-hidden="true" />Nouvel entrepôt
                    </Link>
                ) : undefined}
            />
            {peutCreer && (
                <ModaleUrl param="nouveau" titre="Nouvel entrepôt" description="Sa caisse est créée avec lui." taille="lg">
                    <FormulaireEntrepot />
                </ModaleUrl>
            )}
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 space-y-4">
                {entrepotsFiges && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold">Votre plan {limites.label} ne fait vivre que l&apos;entrepôt par défaut</p>
                            <p className="mt-1 text-amber-700">
                                Les autres entrepôts restent consultables, mais ventes, réceptions et ajustements y sont refusés.
                                Vous pouvez transférer leur stock vers l&apos;entrepôt par défaut, ou{' '}
                                <Link href="/admin/abonnement" className="font-semibold underline">passer au plan Pro</Link>{' '}
                                pour les utiliser à nouveau.
                            </p>
                        </div>
                    </div>
                )}
                <TableauEntrepots entrepots={entrepots ?? []} />
            </main>
        </div>
    )
}