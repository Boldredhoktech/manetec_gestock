// app/api/v1/pdf/devis/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { DevisPDF } from '@/lib/pdf/devis-pdf'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: devis }, { data: boutique }] = await Promise.all([
        adminClient.from('devis')
            .select(`
                public_id, statut, date_devis, date_validite, objet,
                note_client, montant_ht, remise_val, remise_pct,
                montant_tva, montant_ttc,
                clients(nom, adresse, telephone, email, ifu, rccm, ville, pays),
                devis_items(
                    designation, quantite, prix_unitaire,
                    remise_pct, tva_pct, montant_ttc
                )
            `)
            .eq('id', id)
            .eq('shop_id', shopId)
            .single(),
        adminClient.from('shops')
            .select('nom, adresse, ville, telephone_1, email, ifu, rccm, message_pied_facture, devise, logo_url')
            .eq('id', shopId)
            .single(),
    ])

    if (!devis || !boutique) {
        return new NextResponse('Devis introuvable', { status: 404 })
    }

    const donnees = {
        boutique: {
            nom:                  boutique.nom,
            adresse:              boutique.adresse,
            ville:                boutique.ville,
            telephone_1:          boutique.telephone_1,
            email:                boutique.email,
            ifu:                  boutique.ifu,
            rccm:                 boutique.rccm,
            message_pied_facture: boutique.message_pied_facture,
            devise:               boutique.devise ?? 'FCFA',
            logo_url:             boutique.logo_url,
        },
        client: devis.clients
            ? (Array.isArray(devis.clients) ? (devis.clients as any[])[0] : devis.clients) as any
            : null,
        devis: {
            public_id:      devis.public_id,
            date_devis:     devis.date_devis,
            date_validite:  devis.date_validite,
            objet:          devis.objet,
            note_client:    devis.note_client,
            montant_ht:     devis.montant_ht,
            remise_val:     devis.remise_val,
            remise_pct:     devis.remise_pct,
            montant_tva:    devis.montant_tva,
            montant_ttc:    devis.montant_ttc,
        },
        lignes: ((devis.devis_items as any[]) ?? []).map((l: any) => ({
            designation:   l.designation,
            quantite:      l.quantite,
            prix_unitaire: l.prix_unitaire,
            remise_pct:    l.remise_pct,
            tva_pct:       l.tva_pct,
            montant_ttc:   l.montant_ttc,
        })),
        genere_le: formatDatePDF(new Date()),
    }

    const buffer = await renderToBuffer(
        React.createElement(DevisPDF, { donnees }) as React.ReactElement<any>
    )

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="proforma-${devis.public_id}.pdf"`,
        },
    })
}