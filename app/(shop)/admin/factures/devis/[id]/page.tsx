// app/(shop)/admin/factures/devis/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import CarteDetailDevis from '@/components/shop/facturation/CarteDetailDevis'
import EnTetePage from '@/components/shop/EnTetePage'

export const metadata: Metadata = { title: 'Détail proforma' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailDevis({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FACTURES_VOIR)) redirect('/admin/factures')

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
        brouillon: { label: 'Brouillon', bg: 'bg-gray-500/20',   couleur: 'text-muted-foreground/80'   },
        envoye:    { label: 'Envoyé',    bg: 'bg-blue-500/20',   couleur: 'text-blue-300'   },
        accepte:   { label: 'Accepté',   bg: 'bg-green-500/20',  couleur: 'text-green-300'  },
        refuse:    { label: 'Refusé',    bg: 'bg-red-500/20',    couleur: 'text-red-300'    },
        expire:    { label: 'Expiré',    bg: 'bg-amber-500/20',  couleur: 'text-amber-300'  },
    }

    const statutConfig = STATUT_LABELS[devis.statut] ?? STATUT_LABELS.brouillon

    return (
        <div className="flex flex-col min-h-screen">

            <EnTetePage
                titre={`Proforma ${devis.public_id}`}
                sousTitre={(Array.isArray(devis.clients)
                        ? (devis.clients as any[])[0]?.nom
                        : (devis.clients as any)?.nom
                ) ?? 'Client non spécifié'}
                ariane={[{ label: 'Ventes' }, { label: 'Factures', href: '/admin/factures' }, { label: devis.public_id }]}
                actions={
                    <span className={`self-center px-3 py-1.5 rounded-full text-xs font-bold border border-border ${statutConfig.bg} ${statutConfig.couleur}`}>
                        {statutConfig.label}
                    </span>
                }
            />

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl w-full space-y-5">
                <CarteDetailDevis devis={devis} boutique={boutique} />
            </main>
        </div>
    )
}