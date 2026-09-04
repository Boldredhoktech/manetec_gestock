// app/api/v1/pdf/bon-commande/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { BonCommandePDF } from '@/lib/pdf/bon-commande'
import { getDonneesBonCommande } from '@/actions/rapports'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
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
    if (!aPermission(user, PERMISSIONS.FOURNISSEURS_VOIR)) {
        return new NextResponse('Permission insuffisante', { status: 403 })
    }

    const donnees = await getDonneesBonCommande(id, user.user_metadata.shop_id)
    if (!donnees) return new NextResponse('Bon de commande introuvable', { status: 404 })

    const buffer = await renderToBuffer(
        React.createElement(BonCommandePDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="${donnees.bon.public_id}.pdf"`,
        },
    })
}
