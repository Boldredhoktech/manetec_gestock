// app/api/v1/pdf/factures-impayees/route.ts

import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportFacturesImpayeesPDF } from '@/lib/pdf/rapport-factures-impayees'
import { getDonneesFacturesImpayees } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET() {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.FACTURES_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    return reponsePDF(
        `factures-impayees.pdf`,
        async () => {
            const donnees = await getDonneesFacturesImpayees(garde.shopId)
            return React.createElement(RapportFacturesImpayeesPDF, { donnees })
        },
    )
}
