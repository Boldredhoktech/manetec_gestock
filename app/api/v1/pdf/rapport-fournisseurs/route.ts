import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportFournisseursPDF } from '@/lib/pdf/rapport-fournisseurs'
import { getDonneesRapportFournisseurs } from '@/actions/rapports'
import { createClient } from '@/lib/supabase/server'
import React from 'react'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const donnees = await getDonneesRapportFournisseurs(user.user_metadata.shop_id)

    const buffer = await renderToBuffer(
        React.createElement(RapportFournisseursPDF, { donnees })
    )

    return new NextResponse(buffer, {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="rapport-fournisseurs.pdf"`,
        },
    })
}