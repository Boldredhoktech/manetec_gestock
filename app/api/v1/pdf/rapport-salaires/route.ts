// app/api/v1/pdf/rapport-salaires/route.ts

import { NextRequest } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportSalairesPDF } from '@/lib/pdf/rapport-salaires'
import { getDonneesRapportSalaires } from '@/actions/rapports'
import { gardeRouteBoutique, moisAnneeDepuisURL, estRefus } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.SALAIRES_GERER],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const periode = moisAnneeDepuisURL(request.nextUrl.searchParams)
    if (estRefus(periode)) return periode

    return reponsePDF(
        `rapport-salaires-${periode.mois}-${periode.annee}.pdf`,
        async () => {
            const donnees = await getDonneesRapportSalaires(garde.shopId, periode.mois, periode.annee)
            return React.createElement(RapportSalairesPDF, { donnees })
        },
    )
}
