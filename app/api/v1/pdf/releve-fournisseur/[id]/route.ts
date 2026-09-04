// app/api/v1/pdf/releve-fournisseur/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
import { ReleveFournisseurPDF } from '@/lib/pdf/releve-fournisseur'
import { getDonneesReleveFournisseur } from '@/actions/rapports'
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

    const { searchParams } = new URL(request.url)
    const debut = searchParams.get('debut') ?? undefined
    const fin   = searchParams.get('fin')   ?? undefined

    return reponsePDF(
        `releve-fournisseur.pdf`,
        async () => {
            const donnees = await getDonneesReleveFournisseur(id, user.user_metadata.shop_id, debut, fin)
            return {
                element:    React.createElement(ReleveFournisseurPDF, { donnees }),
                nomFichier: `releve-${donnees.fournisseur.public_id}.pdf`,
            }
        },
    )
}
