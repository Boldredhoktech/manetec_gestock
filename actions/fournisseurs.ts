'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Créer un fournisseur ───────────────────────────────────────
export async function creerFournisseur(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const nom        = (formData.get('nom') as string)?.trim()
    const nomContact = (formData.get('nomContact') as string)?.trim() || null
    const telephone  = (formData.get('telephone') as string)?.trim() || null
    const email      = (formData.get('email') as string)?.trim() || null
    const adresse    = (formData.get('adresse') as string)?.trim() || null
    const ville      = (formData.get('ville') as string)?.trim() || null
    const pays       = (formData.get('pays') as string)?.trim() || null
    const ifu        = (formData.get('ifu') as string)?.trim() || null
    const rccm       = (formData.get('rccm') as string)?.trim() || null

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'SUP' })

    const { error } = await adminClient.from('suppliers').insert({
        public_id:   publicId,
        shop_id:     shopId,
        nom,
        nom_contact: nomContact,
        telephone,
        email,
        adresse,
        ville,
        pays,
        ifu,
        rccm,
        est_actif:   true,
        created_by:  user.user_metadata.user_id,
    })

    if (error) return { erreur: 'Erreur lors de la création.' }

    revalidatePath('/stock/fournisseurs')
    redirect('/stock/fournisseurs')
}

// ── Créer un bon de commande ───────────────────────────────────
export async function creerBonCommande(
    supplierId: string,
    warehouseId: string,
    dateLivraison: string | null,
    notes: string,
    lignes: { product_id: string; designation: string; quantite: number; prix_unitaire: number }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    const montantTotal = lignes.reduce((acc, l) => acc + l.quantite * l.prix_unitaire, 0)

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'PO' })

    const { data: po, error } = await adminClient.from('purchase_orders').insert({
        public_id:      publicId,
        shop_id:        shopId,
        supplier_id:    supplierId,
        warehouse_id:   warehouseId,
        statut:         'brouillon',
        date_commande:  new Date().toISOString().split('T')[0],
        date_livraison: dateLivraison || null,
        montant_total:  montantTotal,
        notes:          notes || null,
        created_by:     user.user_metadata.user_id,
    }).select().single()

    if (error || !po) return { erreur: 'Erreur lors de la création du bon de commande.' }

    await adminClient.from('purchase_order_items').insert(
        lignes.map((l, i) => ({
            shop_id:       shopId,
            po_id:         po.id,
            product_id:    l.product_id,
            designation:   l.designation,
            quantite_cmd:  l.quantite,
            prix_unitaire: l.prix_unitaire,
            montant_ligne: l.quantite * l.prix_unitaire,
            ordre:         i,
        }))
    )

    revalidatePath('/stock/fournisseurs')
    return { succes: true, po_id: po.id, public_id: po.public_id }
}

// ── Enregistrer une réception ──────────────────────────────────
export async function enregistrerReception(
    supplierId: string,
    warehouseId: string,
    poId: string | null,
    notes: string,
    lignes: {
        product_id: string
        poi_id: string | null
        designation: string
        quantite: number
        prix_unitaire: number
    }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    const adminClient  = createAdminClient()
    const montantTotal = lignes.reduce((acc, l) => acc + l.quantite * l.prix_unitaire, 0)

    const { data: result } = await adminClient.rpc('enregistrer_reception', {
        p_data: {
            shop_id:       user.user_metadata.shop_id,
            supplier_id:   supplierId,
            warehouse_id:  warehouseId,
            po_id:         poId ?? '',
            user_id:       user.user_metadata.user_id,
            montant_total: montantTotal,
            notes:         notes ?? '',
            items:         lignes.map(l => ({
                product_id:    l.product_id,
                poi_id:        l.poi_id ?? '',
                designation:   l.designation,
                quantite:      l.quantite,
                prix_unitaire: l.prix_unitaire,
                montant_ligne: l.quantite * l.prix_unitaire,
            })),
        }
    })

    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de la réception.' }

    revalidatePath('/stock/fournisseurs')
    return { succes: true, reception_id: result.reception_id, public_id: result.public_id }
}

// ── Payer un fournisseur ───────────────────────────────────────
export async function payerFournisseur(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const adminClient  = createAdminClient()
    const supplierId   = formData.get('supplierId') as string
    const montant      = parseFloat(formData.get('montant') as string)
    const moyen        = formData.get('moyen') as string
    const reference    = (formData.get('reference') as string) || ''
    const note         = (formData.get('note') as string) || ''

    if (!supplierId || isNaN(montant) || montant <= 0) return { erreur: 'Données invalides.' }

    const { data: result } = await adminClient.rpc('payer_fournisseur', {
        p_shop_id:     user.user_metadata.shop_id,
        p_supplier_id: supplierId,
        p_montant:     montant,
        p_moyen:       moyen,
        p_reference:   reference,
        p_note:        note,
        p_user_id:     user.user_metadata.user_id,
    })

    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur.' }

    revalidatePath('/stock/fournisseurs')
    return { succes: true }
}

// ── Transfert inter-entrepôts ──────────────────────────────────
export async function creerTransfert(
    warehouseSourceId: string,
    warehouseDestId: string,
    notes: string,
    lignes: { product_id: string; quantite: number }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }
    if (warehouseSourceId === warehouseDestId) {
        return { erreur: 'Source et destination doivent être différentes.' }
    }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'TRF' })

    const { data: transfert, error } = await adminClient.from('stock_transfers').insert({
        public_id:           publicId,
        shop_id:             shopId,
        warehouse_source_id: warehouseSourceId,
        warehouse_dest_id:   warehouseDestId,
        statut:              'effectue',
        notes:               notes || null,
        created_by:          user.user_metadata.user_id,
    }).select().single()

    if (error || !transfert) return { erreur: 'Erreur lors du transfert.' }

    for (const ligne of lignes) {
        // Vérifier stock source
        const { data: stockSource } = await adminClient
            .from('stock_levels')
            .select('quantite')
            .eq('product_id', ligne.product_id)
            .eq('warehouse_id', warehouseSourceId)
            .single()

        if (!stockSource || stockSource.quantite < ligne.quantite) {
            await adminClient.from('stock_transfers').update({ statut: 'annule' })
                .eq('id', transfert.id)
            return { erreur: `Stock insuffisant pour le transfert.` }
        }

        // Déduire source
        await adminClient.from('stock_levels')
            .update({ quantite: stockSource.quantite - ligne.quantite })
            .eq('product_id', ligne.product_id)
            .eq('warehouse_id', warehouseSourceId)

        // Ajouter destination
        const { data: stockDest } = await adminClient
            .from('stock_levels')
            .select('quantite')
            .eq('product_id', ligne.product_id)
            .eq('warehouse_id', warehouseDestId)
            .single()

        if (stockDest) {
            await adminClient.from('stock_levels')
                .update({ quantite: stockDest.quantite + ligne.quantite })
                .eq('product_id', ligne.product_id)
                .eq('warehouse_id', warehouseDestId)
        } else {
            await adminClient.from('stock_levels').insert({
                shop_id:      shopId,
                product_id:   ligne.product_id,
                warehouse_id: warehouseDestId,
                quantite:     ligne.quantite,
            })
        }

        // Mouvements
        const { data: mvtPid1 } = await adminClient
            .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'MVT' })
        const { data: mvtPid2 } = await adminClient
            .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'MVT' })

        await adminClient.from('stock_movements').insert([
            {
                public_id: mvtPid1, shop_id: shopId,
                product_id: ligne.product_id, warehouse_id: warehouseSourceId,
                type_mouvement: 'transfert_sortie',
                quantite: ligne.quantite,
                quantite_avant: stockSource.quantite,
                quantite_apres: stockSource.quantite - ligne.quantite,
                reference_type: 'transfer', reference_id: transfert.id,
                reference_public_id: transfert.public_id,
                created_by: user.user_metadata.user_id,
            },
            {
                public_id: mvtPid2, shop_id: shopId,
                product_id: ligne.product_id, warehouse_id: warehouseDestId,
                type_mouvement: 'transfert_entree',
                quantite: ligne.quantite,
                quantite_avant: stockDest?.quantite ?? 0,
                quantite_apres: (stockDest?.quantite ?? 0) + ligne.quantite,
                reference_type: 'transfer', reference_id: transfert.id,
                reference_public_id: transfert.public_id,
                created_by: user.user_metadata.user_id,
            }
        ])

        await adminClient.from('stock_transfer_items').insert({
            shop_id: shopId, transfer_id: transfert.id,
            product_id: ligne.product_id, quantite: ligne.quantite,
        })
    }

    revalidatePath('/stock/mouvements')
    return { succes: true, transfer_id: transfert.id, public_id: transfert.public_id }
}

// ── Ajustement de stock ────────────────────────────────────────
export async function creerAjustement(
    warehouseId: string,
    motif: string,
    notes: string,
    lignes: { product_id: string; quantite_apres: number }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    if (!motif) return { erreur: 'Le motif est obligatoire.' }
    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'ADJ' })

    const { data: adj, error } = await adminClient.from('stock_adjustments').insert({
        public_id:    publicId,
        shop_id:      shopId,
        warehouse_id: warehouseId,
        motif,
        notes:        notes || null,
        created_by:   user.user_metadata.user_id,
    }).select().single()

    if (error || !adj) return { erreur: 'Erreur lors de la création de l\'ajustement.' }

    for (const ligne of lignes) {
        const { data: stock } = await adminClient
            .from('stock_levels')
            .select('quantite')
            .eq('product_id', ligne.product_id)
            .eq('warehouse_id', warehouseId)
            .single()

        const qteAvant = stock?.quantite ?? 0
        const diff     = ligne.quantite_apres - qteAvant

        if (diff === 0) continue

        await adminClient.from('stock_levels')
            .upsert({
                shop_id:      shopId,
                product_id:   ligne.product_id,
                warehouse_id: warehouseId,
                quantite:     ligne.quantite_apres,
            }, { onConflict: 'product_id,warehouse_id' })

        const { data: mvtPid } = await adminClient
            .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'MVT' })

        await adminClient.from('stock_movements').insert({
            public_id:      mvtPid,
            shop_id:        shopId,
            product_id:     ligne.product_id,
            warehouse_id:   warehouseId,
            type_mouvement: diff > 0 ? 'ajustement_positif' : 'ajustement_negatif',
            quantite:       Math.abs(diff),
            quantite_avant: qteAvant,
            quantite_apres: ligne.quantite_apres,
            reference_type: 'adjustment',
            reference_id:   adj.id,
            reference_public_id: adj.public_id,
            created_by:     user.user_metadata.user_id,
        })

        await adminClient.from('stock_adjustment_items').insert({
            shop_id:        shopId,
            adjustment_id:  adj.id,
            product_id:     ligne.product_id,
            quantite_avant: qteAvant,
            quantite_apres: ligne.quantite_apres,
            difference:     diff,
        })
    }

    revalidatePath('/stock/mouvements')
    return { succes: true }
}