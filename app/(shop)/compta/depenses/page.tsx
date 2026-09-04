// app/(shop)/compta/depenses/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ListeDepenses from '@/components/shop/compta/ListeDepenses'
import FiltresDepenses from '@/components/shop/compta/FiltresDepenses'
import GestionCategoriesDepense from '@/components/shop/compta/GestionCategoriesDepense'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Dépenses' }

const PAR_PAGE = 25

type Filtres = {
    debut?:     string
    fin?:       string
    categorie?: string
    moyen?:     string
    annulees?:  string
    page?:      string
}

function jourValide(v?: string): string | null {
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export default async function PageDepenses({
    searchParams,
}: {
    searchParams: Promise<Filtres>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const f         = await searchParams
    const debut     = jourValide(f.debut)
    const fin       = jourValide(f.fin)
    const categorie = f.categorie || null
    const moyen     = f.moyen || null
    // Les dépenses annulées sont masquées par défaut : elles ne comptent
    // dans aucun total, les afficher toujours encombrerait la liste.
    const avecAnnulees = f.annulees === '1'
    const page         = Math.max(1, Number(f.page) || 1)

    // La liste s'arrêtait aux 50 dernières, sans pagination, sans filtre
    // et sans rien dire : au bout d'un an d'exploitation, elle ne montrait
    // plus que les dernières semaines. On pagine, et on annonce le total.
    let requete = adminClient
        .from('expenses')
        .select(
            'id, public_id, libelle, montant, moyen_paiement, date_depense, est_annule, expense_categories(nom)',
            { count: 'exact' },
        )
        .eq('shop_id', shopId)

    if (debut)         requete = requete.gte('date_depense', debut)
    if (fin)           requete = requete.lte('date_depense', fin)
    if (categorie)     requete = requete.eq('category_id', categorie)
    if (moyen)         requete = requete.eq('moyen_paiement', moyen)
    if (!avecAnnulees) requete = requete.eq('est_annule', false)

    // Le total porte sur TOUTE la sélection, pas sur la page affichée —
    // sinon il ne veut rien dire.
    let requeteTotal = adminClient
        .from('expenses')
        .select('montant')
        .eq('shop_id', shopId)
        .eq('est_annule', false)

    if (debut)     requeteTotal = requeteTotal.gte('date_depense', debut)
    if (fin)       requeteTotal = requeteTotal.lte('date_depense', fin)
    if (categorie) requeteTotal = requeteTotal.eq('category_id', categorie)
    if (moyen)     requeteTotal = requeteTotal.eq('moyen_paiement', moyen)

    const [{ data: depenses, count }, { data: categories }, { data: pourTotal }] =
        await Promise.all([
            requete
                .order('date_depense', { ascending: false })
                .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1),
            // Les catégories retirées sont chargées elles aussi : l'écran
            // doit pouvoir les remettre en service.
            adminClient.from('expense_categories')
                .select('id, nom, est_actif').eq('shop_id', shopId).order('nom'),
            requeteTotal,
        ])

    const totalSelection = (pourTotal ?? []).reduce((somme, d) => somme + d.montant, 0)

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-xl font-bold text-foreground">Dépenses</h1>
                    <Button asChild>
                        <Link href="/compta/depenses/nouvelle">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle dépense
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 space-y-6">
                <GestionCategoriesDepense categories={categories ?? []} />
                <FiltresDepenses categories={categories ?? []} />
                <ListeDepenses
                    depenses={depenses ?? []}
                    total={count ?? 0}
                    totalMontant={totalSelection}
                    page={page}
                    parPage={PAR_PAGE}
                />
            </main>
        </div>
    )
}
