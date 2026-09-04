// app/api/v1/pdf/rapport-stock/route.ts

import { NextRequest } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
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

    return reponsePDF(
        `rapport-stock.pdf`,
        async () => {
            const donnees = await getDonneesRapportStock(garde.shopId, warehouseId)
            return React.createElement(RapportStockPDF, { donnees })
        },
    )
}
