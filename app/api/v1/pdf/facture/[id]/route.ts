// app/api/v1/pdf/facture/[id]/route.ts

import { reponsePDF } from '@/lib/pdf/reponse'
import { FacturePDF } from '@/lib/pdf/facture-pdf'
import { getDonneesFacturePDF } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const garde = await gardeRouteBoutique({ permissions: [PERMISSIONS.FACTURES_VOIR] })
    if (garde.refus) return garde.refus

    return reponsePDF(
        `facture.pdf`,
        async () => {
            const donnees = await getDonneesFacturePDF(id, garde.shopId)
            if (!donnees) return null
            return {
                element:    React.createElement(FacturePDF, { donnees }),
                nomFichier: `facture-${donnees.facture.public_id}.pdf`,
            }
        },
        'Facture introuvable',
    )
}
