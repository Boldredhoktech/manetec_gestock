// app/api/v1/pdf/rapport-pp/route.ts

import { NextRequest } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportProfitPertesPDF } from '@/lib/pdf/rapport-profits-pertes'
import { getDonneesRapportPP } from '@/actions/rapports'
import { gardeRouteBoutique, moisAnneeDepuisURL, estRefus } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.COMPTABILITE_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const periode = moisAnneeDepuisURL(request.nextUrl.searchParams)
    if (estRefus(periode)) return periode

    return reponsePDF(
        `rapport-pp-${periode.mois}-${periode.annee}.pdf`,
        async () => {
            const donnees = await getDonneesRapportPP(garde.shopId, periode.mois, periode.annee)
            return React.createElement(RapportProfitPertesPDF, { donnees })
        },
    )
}
