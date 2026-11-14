import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ListeEmployes from '@/components/shop/compta/ListeEmployes'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { ModaleUrl } from '@/components/ui/ModalesPartagees'
import FormulaireEmploye from '@/components/shop/compta/FormulaireEmploye'

export const metadata: Metadata = { title: 'Salaires' }

// La période de paie se choisit : on doit pouvoir régler un arriéré, ou
// mettre le logiciel en service en septembre avec des salaires d'août à
// saisir. Avant, le mois était figé sur l'horloge du serveur.
function periodeDemandee(mois?: string, annee?: string) {
    const maintenant = new Date()
    const m = Number(mois)
    const a = Number(annee)
    return {
        mois:  Number.isInteger(m) && m >= 1 && m <= 12 ? m : maintenant.getMonth() + 1,
        annee: Number.isInteger(a) && a >= 2000 && a <= 2100 ? a : maintenant.getFullYear(),
    }
}

export default async function PageSalaires({
    searchParams,
}: {
    searchParams: Promise<{ mois?: string; annee?: string; nouveau?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.SALAIRES_GERER)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const peutCreer = true
    const { nouveau } = await searchParams
    const { data: comptesEmploye } = nouveau !== undefined
        ? await createAdminClient().from('shop_users').select('id, nom_complet, identifiant').eq('shop_id', shopId).eq('est_actif', true).order('nom_complet')
        : { data: null }
    const adminClient = createAdminClient()

    const params         = await searchParams
    const { mois, annee } = periodeDemandee(params.mois, params.annee)

    const [{ data: employes }, { data: versementsPeriode }, { data: derniersVersements }] =
        await Promise.all([
            // Les employes desactives sont charges eux aussi : l'ecran
            // les range a part et permet de les reintegrer.
            adminClient
                .from('employees')
                .select('id, nom_complet, poste, salaire_base, est_actif')
                .eq('shop_id', shopId)
                .order('nom_complet'),
            // Les versements faits AU TITRE de la période choisie, quelle
            // que soit la date à laquelle l'argent est sorti.
            adminClient
                .from('salary_payments')
                .select('id, public_id, employee_id, montant_net, salaire_base, bonus, deductions, date_paiement, moyen_paiement, compte_id, est_annule, motif_annulation')
                .eq('shop_id', shopId)
                .eq('periode_mois', mois)
                .eq('periode_annee', annee)
                .order('date_paiement'),
            adminClient
                .from('salary_payments')
                .select('employee_id, montant_net, periode_mois, periode_annee, date_paiement')
                .eq('shop_id', shopId)
                .eq('est_annule', false)
                .order('date_paiement', { ascending: false })
                .limit(200),
        ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Salaires</h1>
                    <Button asChild>
                        <Link href="/compta/salaires?nouveau=1" scroll={false}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvel employé
                        </Link>
                    </Button>
                </div>
            </header>
            {peutCreer && nouveau !== undefined && (
                <ModaleUrl param="nouveau" titre="Nouvel employé" description="La fiche de paie peut être reliée à son compte de connexion." taille="lg">
                    <FormulaireEmploye comptes={comptesEmploye ?? []} />
                </ModaleUrl>
            )}
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
                <ListeEmployes
                    employes={employes ?? []}
                    versementsPeriode={versementsPeriode ?? []}
                    derniersVersements={derniersVersements ?? []}
                    mois={mois}
                    annee={annee}
                />
            </main>
        </div>
    )
}
