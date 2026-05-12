// app/api/v1/pdf/rapport-mouvements/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportMouvementsPDF } from '@/lib/pdf/rapport-mouvements'
import { getDonneesRapportMouvements } from '@/actions/rapports'
import { createClient } from '@/lib/supabase/server'
import React from 'react'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const debut = searchParams.get('debut') ?? new Date().toISOString().split('T')[0]
    const fin   = searchParams.get('fin') ?? debut

    const donnees = await getDonneesRapportMouvements(
        user.user_metadata.shop_id, debut, fin
    )

    const buffer = await renderToBuffer(
        React.createElement(RapportMouvementsPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-mouvements-${debut}.pdf"`,
        },
    })
}