// app/api/v1/pdf/rapport-fournisseurs/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportFournisseursPDF } from '@/lib/pdf/rapport-fournisseurs'
import { getDonneesRapportFournisseurs } from '@/actions/rapports'
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

    const { searchParams } = new URL(request.url)
    const debut = searchParams.get('debut') ?? undefined
    const fin   = searchParams.get('fin')   ?? undefined

    const donnees = await getDonneesRapportFournisseurs(user.user_metadata.shop_id, debut, fin)

    const buffer = await renderToBuffer(
        React.createElement(RapportFournisseursPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-fournisseurs.pdf"`,
        },
    })
}