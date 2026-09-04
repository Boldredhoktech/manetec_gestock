// app/api/v1/pdf/rapport-stock/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportStockPDF } from '@/lib/pdf/rapport-stock'
import { getDonneesRapportStock } from '@/actions/rapports'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import React from 'react'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, PERMISSIONS.STOCK_VOIR],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const warehouseId = request.nextUrl.searchParams.get('warehouse') || null

    const donnees = await getDonneesRapportStock(garde.shopId, warehouseId)
    const buffer  = await renderToBuffer(
        React.createElement(RapportStockPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': 'inline; filename="rapport-stock.pdf"',
        },
    })
}
