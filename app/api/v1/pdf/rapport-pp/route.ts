// app/api/v1/pdf/rapport-pp/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportProfitPertesPDF } from '@/lib/pdf/rapport-profits-pertes'
import { getDonneesRapportPP } from '@/actions/rapports'
import { createClient } from '@/lib/supabase/server'
import React from 'react'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const mois  = parseInt(searchParams.get('mois') ?? String(new Date().getMonth() + 1))
    const annee = parseInt(searchParams.get('annee') ?? String(new Date().getFullYear()))

    const donnees = await getDonneesRapportPP(user.user_metadata.shop_id, mois, annee)
    const buffer  = await renderToBuffer(
        React.createElement(RapportProfitPertesPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-pp-${mois}-${annee}.pdf"`,
        },
    })
}