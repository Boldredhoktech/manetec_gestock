import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CarteDetailFacture from '@/components/shop/facturation/CarteDetailFacture'
import CartePaiementFacture from '@/components/shop/facturation/CartePaiementFacture'
import CarteAvoir from '@/components/shop/facturation/CarteAvoir'

export const metadata: Metadata = { title: 'Détail facture' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailFacture({ params }: Props) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()

    const { data: facture } = await adminClient
        .from('factures')
        .select(`
      *,
      business_clients(nom, email, telephone, adresse, ifu, rccm),
      facture_items(*, products(nom, unite)),
      facture_payments(*),
      avoirs(*)
    `)
        .eq('id', id)
        .eq('shop_id', user.user_metadata.shop_id)
        .single()

    if (!facture) notFound()

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, telephone_1, email, devise, ifu, rccm')
        .eq('id', user.user_metadata.shop_id).single()

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/admin/factures" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{facture.public_id}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {facture.business_clients?.nom ?? 'Client non spécifié'}
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-6 max-w-4xl space-y-5">
                <CarteDetailFacture facture={facture} boutique={boutique} />
                {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
                    <CartePaiementFacture facture={facture} />
                )}
                {facture.statut !== 'annulee' && (
                    <CarteAvoir factureId={facture.id} avoirs={facture.avoirs ?? []} />
                )}
            </main>
        </div>
    )
}