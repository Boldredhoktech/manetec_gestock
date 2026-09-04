// app/api/v1/pdf/rapport-fournisseurs/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
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

    const donnees = await getDonneesRapportFournisseurs(garde.shopId, periode.debut, periode.fin)
    const buffer  = await renderToBuffer(
        React.createElement(RapportFournisseursPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-fournisseurs-${periode.debut}.pdf"`,
        },
    })
}
