// app/(shop)/compta/dashboard/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTableauBordComptable } from '@/actions/comptabilite'
import TableauBordComptable from '@/components/shop/compta/TableauBordComptable'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Dashboard Comptable' }

export default async function PageDashboardComptable() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) redirect('/admin/dashboard')

    const maintenant = new Date()
    const mois       = maintenant.getMonth() + 1
    const annee      = maintenant.getFullYear()

    const donnees = await getTableauBordComptable(mois, annee)
    if (!donnees) redirect('/admin/dashboard')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Tableau de bord comptable</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Mois en cours — {new Date(annee, mois - 1).toLocaleDateString('fr-FR', {
                    month: 'long', year: 'numeric'
                })}
                </p>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <TableauBordComptable donnees={donnees} />
            </main>
        </div>
    )
}