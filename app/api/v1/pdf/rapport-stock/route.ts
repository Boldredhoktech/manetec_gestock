// app/api/v1/pdf/rapport-stock/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportStockPDF } from '@/lib/pdf/rapport-stock'
import { getDonneesRapportStock } from '@/actions/rapports'
import { createClient } from '@/lib/supabase/server'
import React from 'react'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const warehouseId = searchParams.get('warehouse') || null

    const donnees = await getDonneesRapportStock(
        user.user_metadata.shop_id, warehouseId
    )

    const buffer = await renderToBuffer(
        React.createElement(RapportStockPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-stock.pdf"`,
        },
    })
}