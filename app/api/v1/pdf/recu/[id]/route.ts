// app/api/v1/pdf/recu/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RecuThermiquePDF } from '@/lib/pdf/recu-thermique'
import { getDonneesRecu } from '@/actions/rapports'
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

    const donnees = await getDonneesRecu(id, user.user_metadata.shop_id)
    if (!donnees) return new NextResponse('Vente introuvable', { status: 404 })

    const buffer = await renderToBuffer(
        React.createElement(RecuThermiquePDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="recu-${donnees.vente.public_id}.pdf"`,
        },
    })
}