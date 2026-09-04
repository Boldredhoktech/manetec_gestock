// app/(shop)/admin/ventes/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauVentes from '@/components/shop/ventes/TableauVentes'
import FiltresListe from '@/components/shop/FiltresListe'
import Pagination from '@/components/shop/Pagination'
import { bornesInstant } from '@/lib/dates/periode'

export const metadata: Metadata = { title: 'Ventes' }

const PAR_PAGE = 25

function jourValide(v?: string): string | null {
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

// Une vente conclue disparaissait : le seul appel au détail venait du
// reçu qu'on venait d'imprimer. Retrouver une vente d'hier pour vérifier
// un prix ou répondre à un client était impossible.
export default async function PageVentes({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string; statut?: string; vendeur?: string
        debut?: string; fin?: string; page?: string
    }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.VENTES_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const f     = await searchParams
    const q     = f.q?.trim() ?? ''
    const debut = jourValide(f.debut)
    const fin   = jourValide(f.fin)
    const page  = Math.max(1, Number(f.page) || 1)

    let requete = adminClient
        .from('sales')
        .select(
            `id, public_id, statut, created_at, montant_total,
             credit_accorde, motif_annulation,
             clients(nom), shop_users(nom_complet),
             sale_items(id)`,
            { count: 'exact' },
        )
        .eq('shop_id', shopId)

    if (q) {
        const motif = `%${q.replace(/[%_,().*:"'\\]/g, '')}%`
        requete = requete.ilike('public_id', motif)
    }
    if (f.statut)  requete = requete.eq('statut', f.statut)
    if (f.vendeur) requete = requete.eq('vendeur_id', f.vendeur)

    // `created_at` est un instant : on le compare aux bornes de la
    // journée vécue dans la boutique, pas à celles d'UTC.
    if (debut || fin) {
        const bornes = bornesInstant(debut ?? '2000-01-01', fin ?? '2100-12-31')
        requete = requete.gte('created_at', bornes.de).lt('created_at', bornes.avant)
    }

    const [{ data: ventes, count }, { data: vendeurs }] = await Promise.all([
        requete
            .order('created_at', { ascending: false })
            .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1),
        adminClient.from('shop_users')
            .select('id, nom_complet')
            .eq('shop_id', shopId)
            .order('nom_complet'),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Ventes</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {count ?? 0} vente(s)
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/pos">
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Ouvrir la caisse
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 space-y-4">
                <FiltresListe
                    placeholder="Numéro de vente"
                    filtres={[
                        {
                            cle: 'statut', label: 'Statut',
                            options: [
                                { valeur: 'completee', label: 'Complétées' },
                                { valeur: 'annulee',   label: 'Annulées' },
                            ],
                        },
                        {
                            cle: 'vendeur', label: 'Vendeur',
                            options: (vendeurs ?? []).map(v => ({
                                valeur: v.id, label: v.nom_complet,
                            })),
                        },
                    ]}
                />

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <TableauVentes ventes={(ventes ?? []) as never[]} />
                    <Pagination
                        total={count ?? 0}
                        page={page}
                        parPage={PAR_PAGE}
                        libelle="ventes"
                    />
                </div>
            </main>
        </div>
    )
}
