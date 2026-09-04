// app/api/v1/pdf/recu/[id]/route.ts

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RecuThermiquePDF } from '@/lib/pdf/recu-thermique'
import { getDonneesRecu } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const garde = await gardeRouteBoutique({ permissions: [PERMISSIONS.VENTES_VOIR] })
    if (garde.refus) return garde.refus

    const donnees = await getDonneesRecu(id, garde.shopId)
    if (!donnees) return new NextResponse('Vente introuvable', { status: 404 })

    const buffer = await renderToBuffer(
        React.createElement(RecuThermiquePDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="recu-${donnees.vente.public_id}.pdf"`,
        },
    })
}
