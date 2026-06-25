// app/api/v1/pdf/inventaire-feuille/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { FeuilleComptagePDF } from '@/lib/pdf/inventaire-feuille'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { formatDatePDF } from '@/lib/pdf/utils-pdf'
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
    if (!aPermission(user, PERMISSIONS.STOCK_INVENTAIRE_CREER)) {
        return new NextResponse('Permission insuffisante', { status: 403 })
    }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: inventaire }, { data: boutique }] = await Promise.all([
        adminClient.from('inventories')
            .select(`
                public_id, nom, created_at,
                warehouses(nom),
                inventory_items(products(nom, unite, categories(nom)))
            `)
            .eq('id', id).eq('shop_id', shopId).single(),
        adminClient.from('shops')
            .select('nom, adresse, ville, telephone_1, ifu, logo_url')
            .eq('id', shopId).single(),
    ])

    if (!inventaire || !boutique) {
        return new NextResponse('Inventaire introuvable', { status: 404 })
    }

    const lignes = ((inventaire.inventory_items as any[]) ?? [])
        .map(it => {
            const p = Array.isArray(it.products) ? it.products[0] : it.products
            return {
                nom:       p?.nom ?? '—',
                categorie: (Array.isArray(p?.categories) ? p?.categories[0]?.nom : p?.categories?.nom) ?? '',
                unite:     p?.unite ?? '',
            }
        })
        .sort((a, b) => a.nom.localeCompare(b.nom))

    const donnees = {
        boutique: boutique as any,
        inventaire: {
            public_id:     inventaire.public_id,
            nom:           inventaire.nom,
            warehouse_nom: (Array.isArray(inventaire.warehouses) ? inventaire.warehouses[0]?.nom : (inventaire.warehouses as any)?.nom) ?? '—',
            date:          inventaire.created_at,
        },
        lignes,
        genere_le: formatDatePDF(new Date()),
    }

    const buffer = await renderToBuffer(
        React.createElement(FeuilleComptagePDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="feuille-comptage-${inventaire.public_id}.pdf"`,
        },
    })
}
