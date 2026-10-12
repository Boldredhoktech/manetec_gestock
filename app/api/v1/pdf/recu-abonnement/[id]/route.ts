// app/api/v1/pdf/recu-abonnement/[id]/route.ts
// Reçu d'un paiement d'abonnement réussi (ABO-17). Réservé à
// l'administrateur de la boutique ; SANS contrôle de licence : une
// boutique expirée doit pouvoir retrouver ses reçus.

import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { estAdminComplet } from '@/lib/constants/permissions'
import { reponsePDF } from '@/lib/pdf/reponse'
import { RecuAbonnementPDF } from '@/lib/pdf/recu-abonnement'
import { labelPlan, DUREES, estDuree } from '@/lib/abonnement/catalogue'
import { horodatageBoutique } from '@/lib/dates/periode'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }
    if (!estAdminComplet(user.user_metadata?.role)) {
        return new NextResponse('Réservé à l\'administrateur de la boutique.', { status: 403 })
    }

    return reponsePDF(`recu-abonnement-${id}.pdf`, async () => {
        const admin = createAdminClient()
        const { data: p, error } = await admin
            .from('abonnement_paiements')
            .select('public_id, plan, duree, montant, devise, moyen, reference_transaction, periode_debut, periode_fin, confirme_le, shops(nom, public_id, ville, telephone_1)')
            .eq('id', id)
            .eq('shop_id', user.user_metadata.shop_id)
            .eq('statut', 'reussi')
            .maybeSingle()
        if (error) throw error
        if (!p) return null

        const boutique = (Array.isArray(p.shops) ? p.shops[0] : p.shops) as
            { nom: string; public_id: string; ville: string | null; telephone_1: string | null }

        return {
            nomFichier: `recu-${p.public_id}.pdf`,
            element: React.createElement(RecuAbonnementPDF, {
                donnees: {
                    paiement: {
                        public_id:             p.public_id,
                        plan:                  labelPlan(p.plan),
                        duree_label:           estDuree(p.duree) ? DUREES[p.duree].label : p.duree,
                        montant:               Number(p.montant),
                        devise:                p.devise,
                        moyen:                 p.moyen,
                        reference_transaction: p.reference_transaction,
                        periode_debut:         p.periode_debut,
                        periode_fin:           p.periode_fin,
                        confirme_le:           p.confirme_le,
                    },
                    boutique,
                    genere_le: horodatageBoutique(),
                },
            }),
        }
    }, 'Reçu introuvable.')
}
