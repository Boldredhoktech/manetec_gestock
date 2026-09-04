// app/api/v1/pdf/rapport-mouvements/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
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

    const donnees = await getDonneesRapportMouvements(garde.shopId, periode.debut, periode.fin)
    const buffer  = await renderToBuffer(
        React.createElement(RapportMouvementsPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-mouvements-${periode.debut}.pdf"`,
        },
    })
}
