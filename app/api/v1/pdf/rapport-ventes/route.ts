// app/api/v1/pdf/rapport-ventes/route.ts

import { NextRequest } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportVentesPDF } from '@/lib/pdf/rapport-ventes'
import { getDonneesRapportVentes } from '@/actions/rapports'
import { gardeRouteBoutique, periodeDepuisURL, estRefus } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.VENTES_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const periode = periodeDepuisURL(request.nextUrl.searchParams)
    if (estRefus(periode)) return periode

    return reponsePDF(
        `rapport-ventes-${periode.debut}.pdf`,
        async () => {
            const donnees = await getDonneesRapportVentes(garde.shopId, periode.debut, periode.fin)
            return React.createElement(RapportVentesPDF, { donnees })
        },
    )
}
