// app/api/v1/pdf/rapport-fournisseurs/route.ts

import { NextRequest } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
import { RapportFournisseursPDF } from '@/lib/pdf/rapport-fournisseurs'
import { getDonneesRapportFournisseurs } from '@/actions/rapports'
import { gardeRouteBoutique, periodeDepuisURL, estRefus } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.FOURNISSEURS_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const periode = periodeDepuisURL(request.nextUrl.searchParams, 'debut-mois')
    if (estRefus(periode)) return periode

    return reponsePDF(
        `rapport-fournisseurs-${periode.debut}.pdf`,
        async () => {
            const donnees = await getDonneesRapportFournisseurs(garde.shopId, periode.debut, periode.fin)
            return React.createElement(RapportFournisseursPDF, { donnees })
        },
    )
}
