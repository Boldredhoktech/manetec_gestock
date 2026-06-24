import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireReception from '@/components/shop/fournisseurs/FormulaireReception'

export const metadata: Metadata = { title: 'Nouvelle réception' }

interface Props { params: Promise<{ id: string }> }

export default async function PageNouvelleReception({ params }: Props) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: fournisseur }, { data: produits }, { data: entrepots }, { data: bonsRaw }] =
        await Promise.all([
            adminClient.from('suppliers').select('id, nom').eq('id', id).eq('shop_id', shopId).single(),
            adminClient.from('products').select('id, nom, unite, prix_achat')
                .eq('shop_id', shopId).eq('est_actif', true).order('nom'),
            adminClient.from('warehouses').select('id, nom, est_defaut')
                .eq('shop_id', shopId).eq('est_actif', true),
            adminClient.from('purchase_orders')
                .select('id, public_id, purchase_order_items(id, product_id, designation, quantite_cmd, quantite_recue, prix_unitaire, products(nom, unite))')
                .eq('supplier_id', id).eq('shop_id', shopId)
                .in('statut', ['envoye', 'partiellement_recu']),
        ])

    if (!fournisseur) notFound()

    // Normalisation : products dans purchase_order_items arrive comme tableau via join Supabase
    const bons = (bonsRaw ?? []).map(b => ({
        ...b,
        purchase_order_items: (b.purchase_order_items ?? []).map((item: any) => ({
            ...item,
            products: Array.isArray(item.products) ? (item.products[0] ?? null) : item.products,
        })),
    }))

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href={`/stock/fournisseurs/${id}`} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Nouvelle réception</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{fournisseur.nom}</p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-3xl">
                <FormulaireReception
                    fournisseurId={id}
                    produits={produits ?? []}
                    entrepots={entrepots ?? []}
                    bons={bons}
                />
            </main>
        </div>
    )
}