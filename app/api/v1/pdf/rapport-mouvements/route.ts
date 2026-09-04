// app/api/v1/pdf/rapport-mouvements/route.ts

import { NextRequest } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportMouvementsPDF } from '@/lib/pdf/rapport-mouvements'
import { getDonneesRapportMouvements } from '@/actions/rapports'
import { gardeRouteBoutique, periodeDepuisURL, estRefus } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.STOCK_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const periode = periodeDepuisURL(request.nextUrl.searchParams)
    if (estRefus(periode)) return periode

    return reponsePDF(
        `rapport-mouvements-${periode.debut}.pdf`,
        async () => {
            const donnees = await getDonneesRapportMouvements(garde.shopId, periode.debut, periode.fin)
            return React.createElement(RapportMouvementsPDF, { donnees })
        },
    )
}
