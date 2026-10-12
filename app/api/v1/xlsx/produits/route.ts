// app/api/v1/xlsx/produits/route.ts
// Export Excel de la liste des produits, avec les filtres de l'écran
// (recherche, type) réappliqués ICI sur les données lues en base : le
// fichier contient ce que l'utilisateur voit, sans croire une liste
// envoyée par le navigateur.

import { NextRequest, NextResponse } from 'next/server'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { filtrerProduits, TYPES_PRODUIT } from '@/lib/produits/filtre-liste'
import { genererListeProduitsExcel } from '@/lib/excel/liste-produits'
import { horodatageBoutique, jourBoutique } from '@/lib/dates/periode'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({ permissions: [PERMISSIONS.PRODUITS_VOIR] })
    if (garde.refus) return garde.refus

    const recherche = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 100)
    const typeBrut  = request.nextUrl.searchParams.get('type') ?? 'tous'
    const type      = typeBrut in TYPES_PRODUIT ? typeBrut : 'tous'

    const admin = createAdminClient()
    const [{ data: boutique }, { data: produits, error }, { data: entrepots }] = await Promise.all([
        admin.from('shops').select('nom, public_id, devise').eq('id', garde.shopId).single(),
        admin.from('products')
            .select('public_id, nom, sku, type_produit, unite, prix_vente, stock_levels(quantite, warehouse_id)')
            .eq('shop_id', garde.shopId)
            .order('created_at', { ascending: false }),   // même ordre qu'à l'écran
        admin.from('warehouses')
            .select('id, nom, est_actif, est_defaut')
            .eq('shop_id', garde.shopId)
            .order('est_defaut', { ascending: false })
            .order('nom'),
    ])

    if (error || !boutique) {
        return new NextResponse('La liste des produits n\'a pas pu être lue.', { status: 500 })
    }

    const liste = filtrerProduits(produits ?? [], { recherche, type })

    // Colonnes d'entrepôt : les entrepôts actifs, plus un entrepôt
    // désactivé qui détient encore du stock (sinon ce stock disparaîtrait
    // du fichier).
    const avecStock = new Set(liste.flatMap(p => (p.stock_levels ?? [])
        .filter(s => Number(s.quantite) !== 0).map(s => s.warehouse_id)))
    const colonnesEntrepots = (entrepots ?? [])
        .filter(e => e.est_actif || avecStock.has(e.id))
        .map(e => ({ id: e.id, nom: e.est_actif ? e.nom : `${e.nom} (désactivé)` }))

    const filtre = [
        recherche.trim() ? `« ${recherche.trim()} »` : null,
        type !== 'tous' ? `type ${TYPES_PRODUIT[type]}` : null,
    ].filter(Boolean).join(', ') || null

    const fichier = await genererListeProduitsExcel({
        boutique:  { nom: boutique.nom, devise: boutique.devise ?? 'FCFA' },
        entrepots: colonnesEntrepots,
        filtre,
        edite_le:  horodatageBoutique(),
        produits:  liste.map(p => ({
            public_id:  p.public_id,
            nom:        p.nom,
            unite:      p.unite ?? '',
            prix_vente: Number(p.prix_vente ?? 0),
            stocks:     Object.fromEntries((p.stock_levels ?? []).map(s => [s.warehouse_id, Number(s.quantite)])),
        })),
    })

    return new NextResponse(new Uint8Array(fichier), {
        headers: {
            'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="produits-${boutique.public_id}-${jourBoutique()}.xlsx"`,
            'Cache-Control':       'no-store',
        },
    })
}
