// app/(shop)/admin/factures/devis/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CarteDetailDevis from '@/components/shop/facturation/CarteDetailDevis'

export const metadata: Metadata = { title: 'Détail devis' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailDevis({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: devis } = await adminClient
        .from('devis')
        .select(`
            *,
            clients(nom, email, telephone, adresse, ifu, rccm, ville, pays),
            devis_items(*, products(nom, unite))
        `)
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!devis) notFound()

    const { data: boutique } = await adminClient
        .from('shops')
        .select('nom, adresse, ville, telephone_1, email, devise, ifu, rccm, message_pied_facture')
        .eq('id', shopId)
        .single()

    const STATUT_LABELS: Record<string, { label: string; bg: string; couleur: string }> = {
        brouillon: { label: 'Brouillon', bg: 'bg-gray-500/20',   couleur: 'text-gray-300'   },
        envoye:    { label: 'Envoyé',    bg: 'bg-blue-500/20',   couleur: 'text-blue-300'   },
        accepte:   { label: 'Accepté',   bg: 'bg-green-500/20',  couleur: 'text-green-300'  },
        refuse:    { label: 'Refusé',    bg: 'bg-red-500/20',    couleur: 'text-red-300'    },
        expire:    { label: 'Expiré',    bg: 'bg-amber-500/20',  couleur: 'text-amber-300'  },
    }

    const statutConfig = STATUT_LABELS[devis.statut] ?? STATUT_LABELS.brouillon

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <Link href="/admin/factures"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">
                            Proforma {devis.public_id}
                        </h1>
                        <p className="text-sm text-white/70 mt-0.5">
                            {(Array.isArray(devis.clients)
                                    ? (devis.clients as any[])[0]?.nom
                                    : (devis.clients as any)?.nom
                            ) ?? 'Client non spécifié'}
                        </p>
                    </div>
                    <div className="ml-auto">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border border-white/20 ${statutConfig.bg} ${statutConfig.couleur}`}>
                            {statutConfig.label}
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-5">
                <CarteDetailDevis devis={devis} boutique={boutique} />
            </main>
        </div>
    )
}