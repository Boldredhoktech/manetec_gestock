// app/api/v1/pdf/facture/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { FacturePDF } from '@/lib/pdf/facture-pdf'
import { getDonneesFacturePDF } from '@/actions/rapports'
import { createClient } from '@/lib/supabase/server'
import React from 'react'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const donnees = await getDonneesFacturePDF(id, user.user_metadata.shop_id)
    if (!donnees) return new NextResponse('Facture introuvable', { status: 404 })

    const buffer = await renderToBuffer(
        React.createElement(FacturePDF, { donnees })
    )

    return new NextResponse(buffer, {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="facture-${donnees.facture.public_id}.pdf"`,
        },
    })
}