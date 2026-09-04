// app/api/v1/pdf/recu/[id]/route.ts

import { reponsePDF } from '@/lib/pdf/reponse'
import { RecuThermiquePDF } from '@/lib/pdf/recu-thermique'
import { getDonneesRecu } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const garde = await gardeRouteBoutique({ permissions: [PERMISSIONS.VENTES_VOIR] })
    if (garde.refus) return garde.refus

    return reponsePDF(
        `recu.pdf`,
        async () => {
            const donnees = await getDonneesRecu(id, garde.shopId)
            if (!donnees) return null
            return {
                element:    React.createElement(RecuThermiquePDF, { donnees }),
                nomFichier: `recu-${donnees.vente.public_id}.pdf`,
            }
        },
        'Vente introuvable',
    )
}
