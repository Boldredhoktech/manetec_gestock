// app/api/v1/pdf/factures-impayees/route.ts

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportFacturesImpayeesPDF } from '@/lib/pdf/rapport-factures-impayees'
import { getDonneesFacturesImpayees } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET() {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.FACTURES_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const donnees = await getDonneesFacturesImpayees(garde.shopId)
    const buffer  = await renderToBuffer(
        React.createElement(RapportFacturesImpayeesPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': 'inline; filename="factures-impayees.pdf"',
        },
    })
}
