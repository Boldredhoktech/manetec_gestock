// app/api/v1/pdf/rapport-clients/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportClientsPDF } from '@/lib/pdf/rapport-clients'
import { getDonneesRapportClients } from '@/actions/rapports'
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

    const donnees = await getDonneesRapportClients(user.user_metadata.shop_id)

    const buffer = await renderToBuffer(
        React.createElement(RapportClientsPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-clients.pdf"`,
        },
    })
}