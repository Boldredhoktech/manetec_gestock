// app/api/v1/pdf/rapport-pp/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
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

    const donnees = await getDonneesRapportPP(garde.shopId, periode.mois, periode.annee)
    const buffer  = await renderToBuffer(
        React.createElement(RapportProfitPertesPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-pp-${periode.mois}-${periode.annee}.pdf"`,
        },
    })
}
