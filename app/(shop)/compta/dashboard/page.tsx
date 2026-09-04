// app/(shop)/compta/dashboard/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTableauBordComptable } from '@/actions/comptabilite'
import TableauBordComptable from '@/components/shop/compta/TableauBordComptable'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Dashboard Comptable' }

// Le mois se choisit. Avant, il était calculé sur l'horloge du serveur
// sans aucun sélecteur : le 1er du mois l'écran était vide et le mois
// écoulé devenait inconsultable — précisément quand on veut le lire.
function periodeDemandee(mois?: string, annee?: string) {
    const maintenant = new Date()
    const m = Number(mois)
    const a = Number(annee)
    return {
        mois:  Number.isInteger(m) && m >= 1 && m <= 12 ? m : maintenant.getMonth() + 1,
        annee: Number.isInteger(a) && a >= 2000 && a <= 2100 ? a : maintenant.getFullYear(),
    }
}

export default async function PageDashboardComptable({
    searchParams,
}: {
    searchParams: Promise<{ mois?: string; annee?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) redirect('/admin/dashboard')

    const params          = await searchParams
    const { mois, annee } = periodeDemandee(params.mois, params.annee)

    const donnees = await getTableauBordComptable(mois, annee)
    if (!donnees) redirect('/admin/dashboard')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Tableau de bord comptable</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Entrées, sorties et ventilation de la caisse
                </p>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <TableauBordComptable donnees={donnees} />
            </main>
        </div>
    )
}
