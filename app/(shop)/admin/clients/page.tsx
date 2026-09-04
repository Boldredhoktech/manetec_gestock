// app/(shop)/admin/clients/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauClients from '@/components/shop/TableauClients'
import FiltresListe from '@/components/shop/FiltresListe'
import Pagination from '@/components/shop/Pagination'

export const metadata: Metadata = { title: 'Clients' }

const PAR_PAGE = 25

export default async function PageClients({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; etat?: string; solde?: string; page?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.CLIENTS_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const f    = await searchParams
    const q    = f.q?.trim() ?? ''
    const page = Math.max(1, Number(f.page) || 1)

    // La liste chargeait TOUS les clients d'un coup, sans recherche ni
    // pagination : au bout d'un an, elle devient illisible et lourde.
    let requete = adminClient
        .from('clients')
        .select(
            'id, public_id, nom, telephone, email, credit_balance, advance_balance, change_balance, est_actif, est_anonyme, created_at',
            { count: 'exact' },
        )
        .eq('shop_id', shopId)
        // Le « client de passage » du POS n'a pas sa place dans un
        // carnet d'adresses.
        .eq('est_anonyme', false)

    if (q) {
        // Le nom OU le téléphone : on cherche un client de tête, avec
        // ce dont on se souvient.
        const motif = `%${q.replace(/[%_]/g, '')}%`
        requete = requete.or(`nom.ilike.${motif},telephone.ilike.${motif},public_id.ilike.${motif}`)
    }
    if (f.etat === 'actif')   requete = requete.eq('est_actif', true)
    if (f.etat === 'inactif') requete = requete.eq('est_actif', false)
    if (f.solde === 'credit') requete = requete.gt('credit_balance', 0)
    if (f.solde === 'avance') requete = requete.gt('advance_balance', 0)

    const { data: clients, count } = await requete
        .order('created_at', { ascending: false })
        .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1)

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Clients</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {count ?? 0} client(s)
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/admin/clients/nouveau">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouveau client
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 space-y-4">
                <FiltresListe
                    placeholder="Nom, téléphone ou identifiant"
                    filtres={[
                        {
                            cle: 'etat', label: 'État',
                            options: [
                                { valeur: 'actif',   label: 'Actifs' },
                                { valeur: 'inactif', label: 'Désactivés' },
                            ],
                        },
                        {
                            cle: 'solde', label: 'Solde',
                            options: [
                                { valeur: 'credit', label: 'Doit du crédit' },
                                { valeur: 'avance', label: 'A une avance' },
                            ],
                        },
                    ]}
                />

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <TableauClients clients={clients ?? []} />
                    <Pagination
                        total={count ?? 0}
                        page={page}
                        parPage={PAR_PAGE}
                        libelle="clients"
                    />
                </div>
            </main>
        </div>
    )
}
