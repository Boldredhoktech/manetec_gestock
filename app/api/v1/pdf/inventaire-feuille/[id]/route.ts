// app/api/v1/pdf/inventaire-feuille/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { reponsePDF, RefusPDF } from '@/lib/pdf/reponse'
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

    return reponsePDF(
        `feuille-inventaire.pdf`,
        async () => {
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
                throw new RefusPDF('Inventaire introuvable', 404)
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

            return {
                element:    React.createElement(FeuilleComptagePDF, { donnees }),
                nomFichier: `feuille-comptage-${inventaire.public_id}.pdf`,
            }
        },
    )
}
