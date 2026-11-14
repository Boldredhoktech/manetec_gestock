// app/api/v1/xlsx/import/route.ts
// Modèles d'import (mig 042) :
//   ?type=produits|clients|fournisseurs        → modèle vierge
//   ?rejets=<id d'import>                      → les lignes rejetées de cet
//                                                import, dans le modèle, avec
//                                                leur motif, prêtes à corriger.

import { NextRequest, NextResponse } from 'next/server'
import { gardeRouteBoutique } from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { genererModeleImport } from '@/lib/excel/modele-import'
import { TYPES_IMPORT, type TypeImport } from '@/lib/import/colonnes'

export async function GET(request: NextRequest) {
    const garde = await gardeRouteBoutique({ permissions: [PERMISSIONS.IMPORTER_DONNEES] })
    if (garde.refus) return garde.refus

    const admin = createAdminClient()
    const [{ data: boutique }, { data: entrepots }] = await Promise.all([
        admin.from('shops').select('nom, public_id').eq('id', garde.shopId).single(),
        admin.from('warehouses').select('nom').eq('shop_id', garde.shopId).eq('est_actif', true)
            .order('est_defaut', { ascending: false }).order('nom'),
    ])
    if (!boutique) return new NextResponse('Boutique introuvable.', { status: 404 })

    const idRejets = request.nextUrl.searchParams.get('rejets')
    let type = request.nextUrl.searchParams.get('type') as TypeImport
    let lignes: { valeurs: Record<string, unknown>; motif?: string }[] | undefined
    let nom: string

    if (idRejets) {
        const { data: imp } = await admin.from('imports_donnees')
            .select('public_id, type, rejets').eq('id', idRejets).eq('shop_id', garde.shopId).maybeSingle()
        if (!imp) return new NextResponse('Import introuvable.', { status: 404 })
        type = imp.type as TypeImport
        lignes = ((imp.rejets ?? []) as { donnees?: Record<string, unknown>; motif: string }[])
            .map(r => ({ valeurs: r.donnees ?? {}, motif: r.motif }))
        nom = `rejets-${imp.public_id}.xlsx`
    } else {
        if (!TYPES_IMPORT.includes(type)) return new NextResponse('Type de modèle inconnu.', { status: 400 })
        nom = `modele-import-${type}-${boutique.public_id}.xlsx`
    }

    const fichier = await genererModeleImport({
        type, boutique: boutique.nom, entrepots: (entrepots ?? []).map(e => e.nom), lignes,
    })

    return new NextResponse(new Uint8Array(fichier), {
        headers: {
            'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${nom}"`,
            'Cache-Control':       'no-store',
        },
    })
}
