// app/api/v1/pdf/rapport-caisse/route.ts

import { NextRequest } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportCaissePDF } from '@/lib/pdf/rapport-caisse'
import { getDonneesRapportCaisse } from '@/actions/rapports'
import { gardeRouteBoutique, periodeDepuisURL, estRefus } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.COMPTABILITE_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    // Une caisse se lit sur un mois, pas sur une journée : le
    // récapitulatif n'a de sens qu'avec plusieurs journées à comparer.
    const periode = periodeDepuisURL(request.nextUrl.searchParams, 'debut-mois')
    if (estRefus(periode)) return periode

    return reponsePDF(
        `rapport-caisse-${periode.debut}.pdf`,
        async () => {
            const donnees = await getDonneesRapportCaisse(garde.shopId, periode.debut, periode.fin)
            return React.createElement(RapportCaissePDF, { donnees })
        },
    )
}
