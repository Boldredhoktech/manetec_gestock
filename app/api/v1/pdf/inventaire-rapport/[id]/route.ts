// app/api/v1/pdf/inventaire-rapport/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { reponsePDF, RefusPDF } from '@/lib/pdf/reponse'
import { RapportInventairePDF } from '@/lib/pdf/inventaire-rapport'
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
        `rapport-inventaire.pdf`,
        async () => {
            const shopId      = user.user_metadata.shop_id as string
            const adminClient = createAdminClient()

            const [{ data: inventaire }, { data: boutique }] = await Promise.all([
                adminClient.from('inventories')
                    .select(`
                        public_id, nom, statut, created_at, valeur_pertes, valeur_gains,
                        warehouses(nom),
                        inventory_items(
                            quantite_theorique, quantite_reelle, ecart,
                            products(nom, unite, prix_achat, categories(nom))
                        )
                    `)
                    .eq('id', id).eq('shop_id', shopId).single(),
                adminClient.from('shops')
                    .select('nom, adresse, ville, telephone_1, ifu, rccm, devise, logo_url')
                    .eq('id', shopId).single(),
            ])

            if (!inventaire || !boutique) {
                throw new RefusPDF('Inventaire introuvable', 404)
            }
            if (inventaire.statut === 'en_cours') {
                throw new RefusPDF('Le rapport n\'est disponible qu\'après validation de l\'inventaire.', 409)
            }

            const lignes = ((inventaire.inventory_items as any[]) ?? []).map(it => {
                const p = Array.isArray(it.products) ? it.products[0] : it.products
                const ecart = it.ecart ?? ((it.quantite_reelle ?? 0) - it.quantite_theorique)
                return {
                    nom:         p?.nom ?? '—',
                    categorie:   (Array.isArray(p?.categories) ? p?.categories[0]?.nom : p?.categories?.nom) ?? '',
                    unite:       p?.unite ?? '',
                    theorique:   it.quantite_theorique,
                    reel:        it.quantite_reelle ?? 0,
                    ecart,
                    valeurEcart: Math.abs(ecart) * (p?.prix_achat ?? 0),
                }
            })

            const donnees = {
                boutique: { ...(boutique as any), devise: boutique.devise ?? 'FCFA' },
                inventaire: {
                    public_id:     inventaire.public_id,
                    nom:           inventaire.nom,
                    warehouse_nom: (Array.isArray(inventaire.warehouses) ? inventaire.warehouses[0]?.nom : (inventaire.warehouses as any)?.nom) ?? '—',
                    date:          inventaire.created_at,
                    valeur_pertes: inventaire.valeur_pertes ?? 0,
                    valeur_gains:  inventaire.valeur_gains ?? 0,
                },
                lignes,
                genere_le: formatDatePDF(new Date()),
            }

            return {
                element:    React.createElement(RapportInventairePDF, { donnees }),
                nomFichier: `rapport-inventaire-${inventaire.public_id}.pdf`,
            }
        },
    )
}
