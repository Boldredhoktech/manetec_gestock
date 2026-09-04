// app/api/v1/pdf/rapport-clients/route.ts

import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportClientsPDF } from '@/lib/pdf/rapport-clients'
import { getDonneesRapportClients } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET() {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.CLIENTS_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    return reponsePDF(
        `rapport-clients.pdf`,
        async () => {
            const donnees = await getDonneesRapportClients(garde.shopId)
            return React.createElement(RapportClientsPDF, { donnees })
        },
    )
}
