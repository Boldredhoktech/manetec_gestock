// app/api/v1/pdf/bulletin-paie/[id]/route.ts

import { reponsePDF } from '@/lib/pdf/reponse'
import { BulletinPaiePDF } from '@/lib/pdf/bulletin-paie'
import { getDonneesBulletinPaie } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.SALAIRES_GERER],
    })
    if (garde.refus) return garde.refus

    return reponsePDF(
        `bulletin-de-paie.pdf`,
        async () => {
            const donnees = await getDonneesBulletinPaie(id, garde.shopId)
            if (!donnees) return null
            return {
                element:    React.createElement(BulletinPaiePDF, { donnees }),
                nomFichier: `bulletin-${donnees.versement.public_id}.pdf`,
            }
        },
        'Versement introuvable',
    )
}
