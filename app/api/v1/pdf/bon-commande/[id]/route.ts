// app/api/v1/pdf/bon-commande/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { reponsePDF } from '@/lib/pdf/reponse'
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

    return reponsePDF(
        `bon-de-commande.pdf`,
        async () => {
            const donnees = await getDonneesBonCommande(id, user.user_metadata.shop_id)
            if (!donnees) return null
            return {
                element:    React.createElement(BonCommandePDF, { donnees }),
                nomFichier: `${donnees.bon.public_id}.pdf`,
            }
        },
        'Bon de commande introuvable',
    )
}
