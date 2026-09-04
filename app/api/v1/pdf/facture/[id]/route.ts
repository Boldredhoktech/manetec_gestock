// app/api/v1/pdf/facture/[id]/route.ts

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { FacturePDF } from '@/lib/pdf/facture-pdf'
import { getDonneesFacturePDF } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const garde = await gardeRouteBoutique({ permissions: [PERMISSIONS.FACTURES_VOIR] })
    if (garde.refus) return garde.refus

    const donnees = await getDonneesFacturePDF(id, garde.shopId)
    if (!donnees) return new NextResponse('Facture introuvable', { status: 404 })

    const buffer = await renderToBuffer(
        React.createElement(FacturePDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="facture-${donnees.facture.public_id}.pdf"`,
        },
    })
}
