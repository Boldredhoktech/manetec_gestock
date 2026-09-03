'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Créer un fournisseur ───────────────────────────────────────
export async function creerFournisseur(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }
    if (!aPermission(user, PERMISSIONS.FOURNISSEURS_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const nom          = (formData.get('nom') as string)?.trim()
    const telephone    = (formData.get('telephone') as string)?.trim()  || null
    const email        = (formData.get('email') as string)?.trim()      || null
    const adresse      = (formData.get('adresse') as string)?.trim()    || null
    const ville        = (formData.get('ville') as string)?.trim()      || null
    const pays         = (formData.get('pays') as string)?.trim()       || null
    const ifu          = (formData.get('ifu') as string)?.trim()        || null
    const rccm         = (formData.get('rccm') as string)?.trim()       || null
    const nomContact   = (formData.get('nomContact') as string)?.trim() || null
    const posteContact = (formData.get('posteContact') as string)?.trim() || null
    const notes        = (formData.get('notes') as string)?.trim()      || null

    if (!nom) return { erreur: 'Le nom du fournisseur est obligatoire.' }

    // Générer le public_id
    const { data: publicIdData } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'SUP' })

    const { error } = await adminClient
        .from('suppliers')
        .insert({
            public_id:     publicIdData,
            shop_id:       shopId,
            nom,
            telephone,
            email,
            adresse,
            ville,
            pays,
            ifu,
            rccm,
            nom_contact:   nomContact,
            poste_contact: posteContact,
            notes,
            solde_dû:      0,
        })

    if (error) {
        console.error('Erreur création fournisseur:', error)
        return { erreur: `Erreur lors de la création : ${error.message}` }
    }

    revalidatePath('/stock/fournisseurs')
    redirect('/stock/fournisseurs')
}

// ── Créer un bon de commande ───────────────────────────────────
// REMPLACEZ la fonction creerBonCommande dans actions/fournisseurs.ts par celle-ci :

export async function creerBonCommande(
    supplierId:    string,
    warehouseId:   string,
    dateLivraison: string | null,
    notes:         string,
    lignes: { product_id: string; designation: string; quantite: number; prix_unitaire: number }[]
) {
    console.log('═══════════════════════════════════════════════')
    console.log('[BON COMMANDE] Début création')
    console.log('[BON COMMANDE] Paramètres :', { supplierId, warehouseId, dateLivraison, nbLignes: lignes.length })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.BONS_COMMANDE_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    const montantTotal = lignes.reduce((acc, l) => acc + l.quantite * l.prix_unitaire, 0)
    console.log('[BON COMMANDE] Montant total :', montantTotal)

    // Générer public_id
    const { data: publicId, error: erreurPid } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'PO' })

    if (erreurPid || !publicId) {
        console.error('[BON COMMANDE] ❌ Erreur generate_public_id :', erreurPid)
        return { erreur: `Erreur génération ID : ${erreurPid?.message ?? 'null'}` }
    }
    console.log('[BON COMMANDE] ✓ public_id généré :', publicId)

    // Créer le bon de commande
    const { data: po, error: erreurPO } = await adminClient
        .from('purchase_orders')
        .insert({
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
        })
        .select()
        .single()

    if (erreurPO || !po) {
        console.error('[BON COMMANDE] ❌ Erreur INSERT purchase_orders :', {
            message: erreurPO?.message,
            code:    erreurPO?.code,
            details: erreurPO?.details,
            hint:    erreurPO?.hint,
        })
        return {
            erreur: `Erreur création BC : ${erreurPO?.message ?? 'null'} | code : ${erreurPO?.code ?? '?'} | détails : ${erreurPO?.details ?? '?'}`,
        }
    }
    console.log('[BON COMMANDE] ✓ BC créé — id :', po.id)

    // Créer les lignes
    const lignesPayload = lignes.map((l, i) => ({
        shop_id:           shopId,
        purchase_order_id: po.id,   // ← nom correct selon la migration
        product_id:        l.product_id || null,
        designation:       l.designation,
        quantite_cmd:      l.quantite,
        quantite_recue:    0,
        prix_unitaire:     l.prix_unitaire,
        montant_ligne:     l.quantite * l.prix_unitaire,
    }))

    console.log('[BON COMMANDE] INSERT purchase_order_items avec', lignesPayload.length, 'lignes')
    console.log('[BON COMMANDE] Première ligne sample :', lignesPayload[0])

    const { error: erreurItems } = await adminClient
        .from('purchase_order_items')
        .insert(lignesPayload)

    if (erreurItems) {
        console.error('[BON COMMANDE] ❌ Erreur INSERT purchase_order_items :', {
            message: erreurItems.message,
            code:    erreurItems.code,
            details: erreurItems.details,
            hint:    erreurItems.hint,
        })
        // Rollback le BC
        await adminClient.from('purchase_orders').delete().eq('id', po.id)
        return {
            erreur: `Erreur lignes BC : ${erreurItems.message} | code : ${erreurItems.code} | détails : ${erreurItems.details ?? '?'}`,
        }
    }

    console.log('[BON COMMANDE] ✓ Lignes créées')
    console.log('[BON COMMANDE] ✅ Succès complet')
    console.log('═══════════════════════════════════════════════')

    revalidatePath(`/stock/fournisseurs/${supplierId}/bons-de-commande`)
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
    if (!aPermission(user, PERMISSIONS.RECEPTION_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

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
    if (!aPermission(user, PERMISSIONS.PAIEMENT_FOURNISSEUR)) return { erreur: 'Permission insuffisante pour cette action.' }

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

// Les transferts et ajustements de stock vivent desormais dans
// actions/stock.ts (module Stock), avec leurs ecrans.

// ── À AJOUTER dans actions/fournisseurs.ts ────────────────────

export interface LigneFactureFourn {
    product_id:    string | null
    designation:   string
    quantite:      number
    prix_unitaire: number
    tva_pct:       number
}

// ── Créer une facture fournisseur ──────────────────────────────
export async function creerFactureFournisseur(
    supplierId:      string,
    warehouseId:     string | null,
    referenceFourn:  string,
    dateEcheance:    string | null,
    notes:           string,
    lignes:          LigneFactureFourn[]
) {
    console.log('[FACT FOURN] Début création')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.PAIEMENT_FOURNISSEUR)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    // Calcul des totaux
    let montantHT = 0, montantTVA = 0
    const lignesCalc = lignes.map((l, i) => {
        const ht  = l.quantite * l.prix_unitaire
        const tva = ht * l.tva_pct / 100
        montantHT  += ht
        montantTVA += tva
        return {
            ...l,
            montant_ht:  ht,
            montant_tva: tva,
            montant_ttc: ht + tva,
            ordre:       i,
        }
    })
    const montantTTC = montantHT + montantTVA

    // Générer public_id
    const { data: publicId, error: erreurPid } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'FF' })

    if (erreurPid || !publicId) {
        console.error('[FACT FOURN] ❌ generate_public_id:', erreurPid)
        return { erreur: `Erreur génération ID : ${erreurPid?.message ?? 'null'}` }
    }

    // Créer la facture
    const { data: facture, error: erreurFF } = await adminClient
        .from('factures_fournisseurs')
        .insert({
            public_id:       publicId,
            shop_id:         shopId,
            supplier_id:     supplierId,
            warehouse_id:    warehouseId || null,
            statut:          'non_payee',
            date_facture:    new Date().toISOString().split('T')[0],
            date_echeance:   dateEcheance || null,
            reference_fourn: referenceFourn || null,
            montant_ht:      montantHT,
            montant_tva:     montantTVA,
            montant_ttc:     montantTTC,
            montant_paye:    0,
            montant_restant: montantTTC,
            notes:           notes || null,
            created_by:      user.user_metadata.user_id,
        })
        .select()
        .single()

    if (erreurFF || !facture) {
        console.error('[FACT FOURN] ❌ INSERT:', {
            message: erreurFF?.message,
            code:    erreurFF?.code,
            details: erreurFF?.details,
        })
        return {
            erreur: `Erreur création : ${erreurFF?.message ?? 'null'} | code : ${erreurFF?.code ?? '?'} | détails : ${erreurFF?.details ?? '?'}`,
        }
    }

    // Insérer les lignes
    const { error: erreurItems } = await adminClient
        .from('facture_fournisseur_items')
        .insert(lignesCalc.map(l => ({
            shop_id:       shopId,
            facture_id:    facture.id,
            product_id:    l.product_id || null,
            designation:   l.designation,
            quantite:      l.quantite,
            prix_unitaire: l.prix_unitaire,
            tva_pct:       l.tva_pct,
            montant_ht:    l.montant_ht,
            montant_tva:   l.montant_tva,
            montant_ttc:   l.montant_ttc,
            ordre:         l.ordre,
        })))

    if (erreurItems) {
        console.error('[FACT FOURN] ❌ INSERT items:', erreurItems)
        await adminClient.from('factures_fournisseurs').delete().eq('id', facture.id)
        return { erreur: `Erreur lignes : ${erreurItems.message}` }
    }

    // Mettre à jour le stock si entrepôt fourni
    if (warehouseId) {
        for (const l of lignesCalc) {
            if (!l.product_id) continue

            const { data: stock } = await adminClient
                .from('stock_levels')
                .select('quantite')
                .eq('product_id', l.product_id)
                .eq('warehouse_id', warehouseId)
                .maybeSingle()

            if (stock === null) {
                await adminClient.from('stock_levels').insert({
                    shop_id:      shopId,
                    product_id:   l.product_id,
                    warehouse_id: warehouseId,
                    quantite:     l.quantite,
                })
            } else {
                await adminClient.from('stock_levels')
                    .update({ quantite: (stock?.quantite ?? 0) + l.quantite })
                    .eq('product_id', l.product_id)
                    .eq('warehouse_id', warehouseId)
            }

            // Mettre à jour le prix d'achat
            await adminClient.from('products')
                .update({ prix_achat: l.prix_unitaire })
                .eq('id', l.product_id)
                .eq('shop_id', shopId)
        }
    }

    // Mettre à jour le solde fournisseur.
    // (Ici se trouvait un UPDATE sur suppliers SANS clause WHERE, avec le
    //  client admin : il visait donc toutes les boutiques à la fois, et
    //  écrivait un objet non résolu appelant une fonction SQL inexistante.
    //  Supprimé — le recalcul ci-dessous, lui, est correct et cloisonné.)
    const { data: sup } = await adminClient
        .from('suppliers')
        .select('solde_dû')
        .eq('id', supplierId)
        .eq('shop_id', shopId)
        .single()

    if (!sup) return { erreur: 'Fournisseur introuvable.' }

    await adminClient
        .from('suppliers')
        .update({ solde_dû: ((sup as any)?.['solde_dû'] ?? 0) + montantTTC })
        .eq('id', supplierId)
        .eq('shop_id', shopId)

    console.log('[FACT FOURN] ✅ Facture fournisseur créée :', facture.id)

    revalidatePath(`/stock/fournisseurs/${supplierId}`)
    return { succes: true, facture_id: facture.id, public_id: facture.public_id }
}

// ── Payer une facture fournisseur ──────────────────────────────
export async function payerFactureFournisseur(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.PAIEMENT_FOURNISSEUR)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const factureId = formData.get('factureId') as string
    const montant   = parseFloat(formData.get('montant') as string)
    const moyen     = (formData.get('moyen') as string) || 'cash'
    const reference = (formData.get('reference') as string) || ''

    if (!factureId || isNaN(montant) || montant <= 0) return { erreur: 'Données invalides.' }

    const { data: facture } = await adminClient
        .from('factures_fournisseurs')
        .select('montant_restant, montant_paye, supplier_id')
        .eq('id', factureId)
        .eq('shop_id', shopId)
        .single()

    if (!facture) return { erreur: 'Facture introuvable.' }
    if (montant > facture.montant_restant) {
        return { erreur: `Le montant dépasse le restant dû (${facture.montant_restant}).` }
    }

    const nouveauPaye    = facture.montant_paye + montant
    const nouveauRestant = facture.montant_restant - montant
    const nouveauStatut  = nouveauRestant <= 0 ? 'payee' : 'partiellement_payee'

    // Enregistrer le paiement
    await adminClient.from('facture_fournisseur_payments').insert({
        shop_id:        shopId,
        facture_id:     factureId,
        montant,
        moyen_paiement: moyen,
        reference:      reference || null,
        created_by:     user.user_metadata.user_id,
    })

    // Mettre à jour la facture
    await adminClient.from('factures_fournisseurs').update({
        montant_paye:    nouveauPaye,
        montant_restant: nouveauRestant,
        statut:          nouveauStatut,
    }).eq('id', factureId)

    // Réduire le solde fournisseur
    const { data: sup } = await adminClient
        .from('suppliers')
        .select('solde_dû')
        .eq('id', (facture as any).supplier_id)
        .single()

    await adminClient.from('suppliers').update({
        solde_dû: Math.max(0, ((sup as any)?.['solde_dû'] ?? 0) - montant),
    }).eq('id', (facture as any).supplier_id)

    revalidatePath(`/stock/fournisseurs`)
    return { succes: true, statut: nouveauStatut }
}