import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CarteDetailFournisseur from '@/components/shop/fournisseurs/CarteDetailFournisseur'
import CartePaiementFournisseur from '@/components/shop/fournisseurs/CartePaiementFournisseur'
import TableauBonsCommande from '@/components/shop/fournisseurs/TableauBonsCommande'
import TableauReceptions from '@/components/shop/fournisseurs/TableauReceptions'

export const metadata: Metadata = { title: 'Fiche fournisseur' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailFournisseur({ params }: Props) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()

    const { data: fournisseur } = await adminClient
        .from('suppliers').select('*')
        .eq('id', id).eq('shop_id', user.user_metadata.shop_id).single()

    if (!fournisseur) notFound()

    const [{ data: bons }, { data: receptions }, { data: paiements }] = await Promise.all([
        adminClient.from('purchase_orders')
            .select('id, public_id, statut, date_commande, montant_total')
            .eq('supplier_id', id).eq('shop_id', user.user_metadata.shop_id)
            .order('created_at', { ascending: false }).limit(10),
        adminClient.from('receptions')
            .select('id, public_id, date_reception, montant_total')
            .eq('supplier_id', id).eq('shop_id', user.user_metadata.shop_id)
            .order('created_at', { ascending: false }).limit(10),
        adminClient.from('supplier_payments')
            .select('id, public_id, montant, moyen_paiement, date_paiement')
            .eq('supplier_id', id).eq('shop_id', user.user_metadata.shop_id)
            .order('created_at', { ascending: false }).limit(10),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/stock/fournisseurs" className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">{fournisseur.nom}</h1>
                            <p className="text-sm font-mono text-muted-foreground mt-0.5">{fournisseur.public_id}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={`/stock/fournisseurs/${id}/reception`}>
                                <Plus className="w-4 h-4 mr-2" />
                                Réception
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={`/stock/fournisseurs/${id}/commande`}>
                                <Plus className="w-4 h-4 mr-2" />
                                Bon de commande
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-5xl space-y-5">
                <CarteDetailFournisseur fournisseur={fournisseur} />
                {fournisseur.solde_dû > 0 && (
                    <CartePaiementFournisseur fournisseur={fournisseur} />
                )}
                <TableauBonsCommande bons={bons ?? []} />
                <TableauReceptions receptions={receptions ?? []} paiements={paiements ?? []} />
            </main>
        </div>
    )
}