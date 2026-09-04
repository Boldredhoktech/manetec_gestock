// app/(shop)/admin/factures/devis/[id]/modifier/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireDevis from '@/components/shop/facturation/FormulaireDevis'

export const metadata: Metadata = { title: 'Modifier la proforma' }

export default async function PageModifierDevis({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FACTURES_CREER)) redirect('/admin/factures')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: devis } = await adminClient
        .from('devis')
        .select('*, devis_items(*)')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!devis) notFound()

    // Un devis accepté ou converti a engagé le client : il ne se réécrit
    // pas dans son dos. Le serveur le refuse aussi ; on évite ici
    // d'ouvrir un formulaire qui échouerait à l'envoi.
    if (devis.converti_en_facture || !['brouillon', 'envoye'].includes(devis.statut)) {
        redirect(`/admin/factures/devis/${id}`)
    }

    const [{ data: clients }, { data: produits }] = await Promise.all([
        adminClient.from('clients')
            .select('id, nom, telephone')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .eq('est_anonyme', false)
            .order('nom'),
        adminClient.from('products')
            .select('id, nom, prix_vente, tva_pct, unite')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
    ])

    const lignes = ((devis.devis_items as Record<string, unknown>[]) ?? [])
        .sort((a, b) => Number(a.ordre ?? 0) - Number(b.ordre ?? 0))
        .map(l => ({
            product_id:    (l.product_id as string) ?? null,
            designation:   l.designation as string,
            quantite:      Number(l.quantite),
            prix_unitaire: Number(l.prix_unitaire),
            remise_pct:    Number(l.remise_pct ?? 0),
            tva_pct:       Number(l.tva_pct ?? 0),
        }))

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href={`/admin/factures/devis/${id}`}
                          className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Modifier la proforma</h1>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            {devis.public_id}
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-3xl">
                <FormulaireDevis
                    clients={(clients ?? []).map(c => ({
                        id:  c.id,
                        nom: `${c.nom}${c.telephone ? ` (${c.telephone})` : ''}`,
                    }))}
                    produits={produits ?? []}
                    devisExistant={{
                        id:            devis.id,
                        client_id:     devis.client_id,
                        objet:         devis.objet,
                        date_validite: devis.date_validite,
                        remise_pct:    Number(devis.remise_pct ?? 0),
                        note_client:   devis.note_client,
                        note_interne:  devis.note_interne,
                        lignes,
                    }}
                />
            </main>
        </div>
    )
}
