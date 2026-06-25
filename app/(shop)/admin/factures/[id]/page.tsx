// app/(shop)/admin/factures/[id]/page.tsx

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

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: facture } = await adminClient
        .from('factures')
        .select(`
            *,
            clients(nom, email, telephone, adresse, ifu, rccm, ville, pays),
            facture_items(*, products(nom, unite)),
            facture_payments(*),
            avoirs(*)
        `)
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!facture) notFound()

    const { data: boutique } = await adminClient
        .from('shops')
        .select('nom, adresse, ville, telephone_1, telephone_2, email, devise, ifu, rccm, logo_url, message_pied_facture')
        .eq('id', shopId)
        .single()

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <Link href="/admin/factures"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">{facture.public_id}</h1>
                        <p className="text-sm text-white/70 mt-0.5">
                            {(facture.clients as any)?.nom ?? 'Client non spécifié'}
                        </p>
                    </div>
                    <div className="ml-auto">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                            facture.statut === 'payee'
                                ? 'bg-green-500/20 text-green-300 border-green-400/40'
                                : facture.statut === 'partiellement_payee'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                    : facture.statut === 'en_retard'
                                        ? 'bg-red-500/20 text-red-300 border-red-400/40'
                                        : facture.statut === 'annulee'
                                            ? 'bg-gray-500/20 text-gray-300 border-gray-400/40'
                                            : 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                        }`}>
                            {facture.statut === 'emise'              ? 'Émise'
                                : facture.statut === 'partiellement_payee' ? 'Partiellement payée'
                                    : facture.statut === 'payee'              ? 'Payée'
                                        : facture.statut === 'en_retard'          ? 'En retard'
                                            : facture.statut === 'annulee'            ? 'Annulée'
                                                : facture.statut}
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
                <CarteDetailFacture facture={facture} boutique={boutique} />
                {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
                    <CartePaiementFacture facture={facture} />
                )}
                {facture.statut !== 'annulee' && (
                    <CarteAvoir factureId={facture.id} avoirs={(facture.avoirs as any[]) ?? []} />
                )}
            </main>
        </div>
    )
}