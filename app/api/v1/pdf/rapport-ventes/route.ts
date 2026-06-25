// app/api/v1/pdf/rapport-ventes/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportVentesPDF } from '@/lib/pdf/rapport-ventes'
import { getDonneesRapportVentes } from '@/actions/rapports'
import { createClient } from '@/lib/supabase/server'
import { getPlanBoutique } from '@/lib/supabase/getPlanBoutique'
import React from 'react'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const { limites } = await getPlanBoutique(user.user_metadata.shop_id)
    if (!limites.rapports) {
        return new NextResponse('Rapports réservés aux plans Pro et Enterprise.', { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const debut = searchParams.get('debut') ?? new Date().toISOString().split('T')[0]
    const fin   = searchParams.get('fin') ?? debut

    const donnees = await getDonneesRapportVentes(
        user.user_metadata.shop_id, debut, fin
    )

    const buffer = await renderToBuffer(
        React.createElement(RapportVentesPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-ventes-${debut}.pdf"`,
        },
    })
}