// app/(shop)/admin/factures/[id]/modifier/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargerClientChoisi } from '@/lib/clients/client-choisi'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import FormulaireFactureDirecte from '@/components/shop/facturation/FormulaireFactureDirecte'

export const metadata: Metadata = { title: 'Modifier la facture' }

export default async function PageModifierFacture({
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

    const { data: facture } = await adminClient
        .from('factures')
        .select('*, facture_items(*), facture_payments(est_annule), avoirs(id)')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!facture) notFound()

    // Une facture réglée, même en partie, ou portant un avoir ne se
    // réécrit plus. Le serveur le refuse aussi ; on évite ici d'ouvrir
    // un formulaire qui échouerait à l'envoi.
    const regleeOuDeduite =
        ((facture.facture_payments as { est_annule: boolean }[]) ?? []).some(p => !p.est_annule)
        || ((facture.avoirs as unknown[]) ?? []).length > 0
    if (facture.statut === 'annulee' || regleeOuDeduite) redirect(`/admin/factures/${id}`)

    const [clientInitial, { data: produits }] = await Promise.all([
        chargerClientChoisi(adminClient, shopId, facture.client_id),
        adminClient.from('products')
            .select('id, nom, prix_vente, tva_pct, unite')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
    ])

    const lignes = ((facture.facture_items as Record<string, unknown>[]) ?? [])
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
                    <Link href={`/admin/factures/${id}`}
                          className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Modifier la facture</h1>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{facture.public_id}</p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-3xl space-y-4">
                <div className="flex items-start gap-3 bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    La facture garde son numéro. La modification est enregistrée dans son historique
                    (ancien et nouveau montant, auteur, date). Elle ne sera plus modifiable dès le premier règlement.
                </div>
                <FormulaireFactureDirecte
                    factureExistante={{
                        id:            facture.id,
                        public_id:     facture.public_id,
                        objet:         facture.objet,
                        date_echeance: facture.date_echeance,
                        remise_pct:    Number(facture.remise_pct ?? 0),
                        note_client:   facture.note_client,
                        lignes,
                    }}
                    clientInitial={clientInitial}
                    peutCreerClient={aPermission(user, PERMISSIONS.CLIENTS_CREER)}
                    produits={produits ?? []}
                />
            </main>
        </div>
    )
}
