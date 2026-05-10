import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RapportFacturesImpayeesPDF } from '@/lib/pdf/rapport-factures-impayees'
import { getDonneesFacturesImpayees } from '@/actions/rapports'
import { createClient } from '@/lib/supabase/server'
import React from 'react'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const donnees = await getDonneesFacturesImpayees(user.user_metadata.shop_id)
    const buffer  = await renderToBuffer(
        React.createElement(RapportFacturesImpayeesPDF, { donnees })
    )

    return new NextResponse(buffer, {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="factures-impayees.pdf"`,
        },
    })
}