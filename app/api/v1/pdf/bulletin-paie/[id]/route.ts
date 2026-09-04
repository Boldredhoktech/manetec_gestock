// app/api/v1/pdf/bulletin-paie/[id]/route.ts

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { BulletinPaiePDF } from '@/lib/pdf/bulletin-paie'
import { getDonneesBulletinPaie } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.SALAIRES_GERER],
    })
    if (garde.refus) return garde.refus

    const donnees = await getDonneesBulletinPaie(id, garde.shopId)
    if (!donnees) return new NextResponse('Versement introuvable', { status: 404 })

    const buffer = await renderToBuffer(
        React.createElement(BulletinPaiePDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="bulletin-${donnees.versement.public_id}.pdf"`,
        },
    })
}
