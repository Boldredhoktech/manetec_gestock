// app/api/v1/pdf/rapport-salaires/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
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

    const donnees = await getDonneesRapportSalaires(garde.shopId, periode.mois, periode.annee)
    const buffer  = await renderToBuffer(
        React.createElement(RapportSalairesPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-salaires-${periode.mois}-${periode.annee}.pdf"`,
        },
    })
}
