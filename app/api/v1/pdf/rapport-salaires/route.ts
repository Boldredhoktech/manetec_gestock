import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportSalairesPDF } from '@/lib/pdf/rapport-salaires'
import { getDonneesRapportSalaires } from '@/actions/rapports'
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

    const donnees = await getDonneesRapportSalaires(user.user_metadata.shop_id, mois, annee)
    const buffer  = await renderToBuffer(
        React.createElement(RapportSalairesPDF, { donnees })
    )

    return new NextResponse(buffer, {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-salaires-${mois}-${annee}.pdf"`,
        },
    })
}