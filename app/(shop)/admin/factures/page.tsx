// app/(shop)/admin/factures/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, ClipboardList } from 'lucide-react'
import TableauFactures from '@/components/shop/facturation/TableauFactures'
import TableauDevis from '@/components/shop/facturation/TableauDevis'
import FiltresListe from '@/components/shop/FiltresListe'
import Pagination from '@/components/shop/Pagination'
import EnTetePage from '@/components/shop/EnTetePage'
import { classeBouton } from '@/components/ui/classe-bouton'

export const metadata: Metadata = { title: 'Facturation' }

const PAR_PAGE = 25

export default async function PageFactures({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; statut?: string; page?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FACTURES_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const f    = await searchParams
    const q    = f.q?.trim() ?? ''
    const page = Math.max(1, Number(f.page) || 1)

    // Les deux listes s'arrêtaient aux 50 dernières, sans filtre ni
    // pagination et sans le dire.
    let requeteFactures = adminClient
        .from('factures')
        .select(
            `id, public_id, statut, date_facture, date_echeance,
             montant_ttc, montant_paye, montant_restant, objet,
             clients(nom)`,
            { count: 'exact' },
        )
        .eq('shop_id', shopId)

    if (q) {
        const motif = `%${q.replace(/[%_]/g, '')}%`
        requeteFactures = requeteFactures.or(`public_id.ilike.${motif},objet.ilike.${motif}`)
    }

    // `en_retard` n'est pas un statut stocké (décision D1) : il se
    // déduit de l'échéance. Le filtre le traduit donc en « pas encore
    // soldée et échéance dépassée ».
    const aujourdhui = new Date().toISOString().split('T')[0]
    if (f.statut === 'en_retard') {
        requeteFactures = requeteFactures
            .in('statut', ['emise', 'partiellement_payee'])
            .lt('date_echeance', aujourdhui)
    } else if (f.statut) {
        requeteFactures = requeteFactures.eq('statut', f.statut)
    }

    const [{ data: factures, count }, { data: devisList }] = await Promise.all([
        requeteFactures
            .order('created_at', { ascending: false })
            .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1),
        adminClient.from('devis')
            .select(`
                id, public_id, statut, date_devis, date_validite,
                montant_ttc, objet,
                clients(nom)
            `)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(50),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre="Facturation"
                sousTitre="Factures, proformas et avoirs"
                ariane={[{ label: 'Ventes' }, { label: 'Factures' }]}
                actions={
                    <>
                        <Link href="/admin/factures/devis/nouveau" className={classeBouton('secondaire')}>
                            <ClipboardList className="w-4 h-4" aria-hidden="true" />Nouvelle proforma
                        </Link>
                        <Link href="/admin/factures/nouvelle" className={classeBouton('primaire')}>
                            <Plus className="w-4 h-4" aria-hidden="true" />Nouvelle facture
                        </Link>
                    </>
                }
            />

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 space-y-8">
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Factures ({count ?? 0})
                    </h2>

                    <FiltresListe
                        placeholder="Numéro de facture ou objet"
                        filtres={[{
                            cle: 'statut', label: 'Statut',
                            options: [
                                { valeur: 'emise',               label: 'Émises' },
                                { valeur: 'partiellement_payee', label: 'Partiellement payées' },
                                { valeur: 'payee',               label: 'Payées' },
                                { valeur: 'en_retard',           label: 'En retard' },
                                { valeur: 'annulee',             label: 'Annulées' },
                            ],
                        }]}
                    />

                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <TableauFactures factures={(factures ?? []) as any[]} />
                        <Pagination
                            total={count ?? 0}
                            page={page}
                            parPage={PAR_PAGE}
                            libelle="factures"
                        />
                    </div>
                </div>

                <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Proformas ({devisList?.length ?? 0})
                    </h2>
                    <TableauDevis devis={(devisList ?? []) as any[]} />
                </div>
            </main>
        </div>
    )
}
