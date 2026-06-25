// app/(shop)/admin/factures/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TableauFactures from '@/components/shop/facturation/TableauFactures'
import TableauDevis from '@/components/shop/facturation/TableauDevis'

export const metadata: Metadata = { title: 'Facturation' }

export default async function PageFactures() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: factures }, { data: devisList }] = await Promise.all([
        adminClient.from('factures')
            .select(`
                id, public_id, statut, date_facture, date_echeance,
                montant_ttc, montant_paye, montant_restant, objet,
                clients(nom)
            `)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(50),
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
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Facturation</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Factures, proformas et avoirs
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/admin/factures/devis/nouveau">
                                <ClipboardList className="w-4 h-4 mr-2" />
                                Nouvelle proforma
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/admin/factures/nouvelle">
                                <Plus className="w-4 h-4 mr-2" />
                                Nouvelle facture
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 space-y-8">
                <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Factures ({factures?.length ?? 0})
                    </h2>
                    <TableauFactures factures={(factures ?? []) as any[]} />
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