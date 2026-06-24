// app/(shop)/stock/factures-fournisseurs/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import CarteDetailFactureFournisseur from '@/components/shop/fournisseurs/CarteDetailFactureFournisseur'

export const metadata: Metadata = { title: 'Détail facture fournisseur' }

interface Props { params: Promise<{ id: string }> }

const STATUT_LABELS: Record<string, { label: string; bg: string; couleur: string }> = {
    non_payee:           { label: 'Non payée',         bg: 'bg-red-500/20',   couleur: 'text-red-300'   },
    partiellement_payee: { label: 'Partiellement payée', bg: 'bg-amber-500/20', couleur: 'text-amber-300' },
    payee:               { label: 'Payée',              bg: 'bg-green-500/20', couleur: 'text-green-300' },
    annulee:             { label: 'Annulée',            bg: 'bg-gray-500/20',  couleur: 'text-gray-300'  },
}

export default async function PageDetailFactureFournisseur({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: facture }, { data: boutique }] = await Promise.all([
        adminClient
            .from('factures_fournisseurs')
            .select(`
                *,
                suppliers(nom, telephone, email, adresse, ville, ifu, rccm),
                warehouses(nom),
                facture_fournisseur_items(*),
                facture_fournisseur_payments(*)
            `)
            .eq('id', id)
            .eq('shop_id', shopId)
            .single(),
        adminClient.from('shops')
            .select('nom, adresse, telephone_1, devise, ifu, rccm')
            .eq('id', shopId)
            .single(),
    ])

    if (!facture) notFound()

    const statutConfig = STATUT_LABELS[facture.statut] ?? STATUT_LABELS.non_payee

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <Link href="/stock/factures-fournisseurs"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">{facture.public_id}</h1>
                        <p className="text-sm text-white/70 mt-0.5">
                            {(facture.suppliers as any)?.nom ?? '—'} · {formatDate(facture.date_facture)}
                        </p>
                    </div>
                    <div className="ml-auto">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border border-white/20 ${statutConfig.bg} ${statutConfig.couleur}`}>
                            {statutConfig.label}
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
                <CarteDetailFactureFournisseur facture={facture} boutique={boutique} />
            </main>
        </div>
    )
}