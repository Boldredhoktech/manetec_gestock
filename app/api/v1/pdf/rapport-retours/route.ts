// app/api/v1/pdf/rapport-retours/route.ts

import { NextRequest } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportRetoursPDF } from '@/lib/pdf/rapport-retours'
import { getDonneesRapportRetours } from '@/actions/rapports'
import { gardeRouteBoutique, periodeDepuisURL, estRefus } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.VENTES_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const periode = periodeDepuisURL(request.nextUrl.searchParams, 'debut-mois')
    if (estRefus(periode)) return periode

    return reponsePDF(
        `retours-et-avoirs-${periode.debut}.pdf`,
        async () => {
            const donnees = await getDonneesRapportRetours(garde.shopId, periode.debut, periode.fin)
            return React.createElement(RapportRetoursPDF, { donnees })
        },
    )
}
