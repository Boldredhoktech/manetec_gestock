// app/api/v1/pdf/rapport-clients/route.ts

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportClientsPDF } from '@/lib/pdf/rapport-clients'
import { getDonneesRapportClients } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET() {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.CLIENTS_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const donnees = await getDonneesRapportClients(garde.shopId)
    const buffer  = await renderToBuffer(
        React.createElement(RapportClientsPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': 'inline; filename="rapport-clients.pdf"',
        },
    })
}
