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
// Le bon de commande est facultatif : réception et facture
// fonctionnent sans lui. Il naît en brouillon, puis se soumet au
// fournisseur. Les statuts de réception sont posés par
// enregistrer_reception(), jamais à la main.
export async function creerBonCommande(
    supplierId:    string,
    warehouseId:   string,
    dateLivraison: string | null,
    notes:         string,
    lignes: { product_id: string; designation: string; quantite: number; prix_unitaire: number }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.BONS_COMMANDE_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    const montantTotal = lignes.reduce((acc, l) => acc + l.quantite * l.prix_unitaire, 0)

    // Générer public_id
    const { data: publicId, error: erreurPid } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'PO' })

    if (erreurPid || !publicId) {
        console.error('ERREUR BON COMMANDE (public_id):', erreurPid)
        return { erreur: 'Erreur lors de la génération du numéro de bon de commande.' }
    }

    // Créer le bon de commande
    const { data: po, error: erreurPO } = await adminClient
        .from('purchase_orders')
        .insert({
            public_id:      publicId,
            shop_id:        shopId,
            supplier_id:    supplierId,
            warehouse_id:   warehouseId || null,
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
        console.error('ERREUR BON COMMANDE (insert):', erreurPO)
        return { erreur: 'Erreur lors de la création du bon de commande.' }
    }

    // Créer les lignes
    const lignesPayload = lignes.map((l, i) => ({
        shop_id:           shopId,
        purchase_order_id: po.id,
        product_id:        l.product_id || null,
        designation:       l.designation,
        quantite_cmd:      l.quantite,
        quantite_recue:    0,
        prix_unitaire:     l.prix_unitaire,
        montant_ligne:     l.quantite * l.prix_unitaire,
    }))

    const { error: erreurItems } = await adminClient
        .from('purchase_order_items')
        .insert(lignesPayload)

    if (erreurItems) {
        console.error('ERREUR BON COMMANDE (lignes):', erreurItems)
        await adminClient.from('purchase_orders').delete().eq('id', po.id).eq('shop_id', shopId)
        return { erreur: 'Erreur lors de l\'enregistrement des lignes du bon de commande.' }
    }

    revalidatePath('/stock/bons-de-commande')
    revalidatePath(`/stock/fournisseurs/${supplierId}`)
    return { succes: true, po_id: po.id as string, public_id: po.public_id as string }
}

// ── Soumettre / annuler un bon de commande ─────────────────────
// Les statuts de reception (recu_partiel, recu_total) sont poses par
// enregistrer_reception() : ils ne passent pas par ici.
export async function changerStatutBonCommande(
    poId:   string,
    statut: 'soumis' | 'annule',
    motif?: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.BONS_COMMANDE_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('changer_statut_bon_commande', {
        p_shop_id: user.user_metadata.shop_id,
        p_po_id:   poId,
        p_statut:  statut,
        p_user_id: user.user_metadata.user_id,
        p_motif:   motif ?? null,
    })

    if (error) {
        console.error('ERREUR STATUT BON COMMANDE:', error)
        return { erreur: 'Erreur lors du changement de statut.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors du changement de statut.' }

    revalidatePath('/stock/bons-de-commande')
    revalidatePath(`/stock/bons-de-commande/${poId}`)
    return { succes: true, statut: result.statut as string }
}

// ── Enregistrer une réception ──────────────────────────────────
// factureId : réception qui accompagne une facture déjà saisie —
// la dette existe déjà, on ne la crée pas une seconde fois.
// Sans facture, la réception en crée une « à compléter » : la dette
// est constatée une fois, et le document est signalé comme incomplet.
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
    }[],
    factureId?: string | null
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
            facture_id:    factureId ?? '',
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
    revalidatePath('/stock/receptions')
    revalidatePath('/stock/mouvements')
    revalidatePath('/stock/factures-fournisseurs')
    return {
        succes:        true,
        reception_id:  result.reception_id as string,
        public_id:     result.public_id as string,
        facture_id:    result.facture_id as string,
        // true = une facture « à compléter » vient d'être créée pour
        // porter la dette de cette réception.
        factureCreee:  Boolean(result.facture_creee),
    }
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
    lignes:          LigneFactureFourn[],
    // Marchandise pas encore entrée en stock : on génère la réception
    // qui accompagne cette facture. C'est la seule voie qui journalise
    // l'entrée, et elle ne recrée pas la dette puisque la facture la
    // porte déjà.
    genererReception = false
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

    // La facture ne touche PLUS au stock.
    // Elle le faisait à la main : lecture puis réécriture de
    // stock_levels en TypeScript, sans verrou, sans transaction et
    // sans le moindre mouvement — le stock augmentait sans laisser de
    // trace dans le journal, et une réception suivie de sa facture
    // faisait entrer deux fois la même marchandise.
    // La marchandise entre désormais par une réception, seule voie qui
    // passe par appliquer_mouvement_stock() et journalise l'entrée.
    // La facture, elle, porte le prix et la dette.
    for (const l of lignesCalc) {
        if (!l.product_id) continue

        await adminClient.from('products')
            .update({ prix_achat: l.prix_unitaire })
            .eq('id', l.product_id)
            .eq('shop_id', shopId)
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

    // Entrée en stock, si demandée : elle passe par la réception,
    // donc par appliquer_mouvement_stock(), et se rattache à cette
    // facture — pas de seconde dette.
    let receptionPublicId: string | null = null

    if (genererReception && warehouseId) {
        const lignesStock = lignesCalc.filter(l => l.product_id)

        if (lignesStock.length > 0) {
            const { data: rec } = await adminClient.rpc('enregistrer_reception', {
                p_data: {
                    shop_id:       shopId,
                    supplier_id:   supplierId,
                    warehouse_id:  warehouseId,
                    po_id:         '',
                    facture_id:    facture.id,
                    user_id:       user.user_metadata.user_id,
                    montant_total: montantTTC,
                    notes:         `Réception générée par la facture ${facture.public_id}`,
                    items:         lignesStock.map(l => ({
                        product_id:    l.product_id,
                        poi_id:        '',
                        designation:   l.designation,
                        quantite:      l.quantite,
                        prix_unitaire: l.prix_unitaire,
                    })),
                },
            })

            if (!rec?.succes) {
                // La facture reste valide : seule l'entrée en stock a
                // échoué, et on le dit au lieu de le taire.
                return {
                    succes:     true,
                    facture_id: facture.id,
                    public_id:  facture.public_id,
                    avertissement: `Facture enregistrée, mais l'entrée en stock a échoué : ${rec?.erreur ?? 'erreur inconnue'}`,
                }
            }

            receptionPublicId = rec.public_id as string
        }
    }

    console.log('[FACT FOURN] ✅ Facture fournisseur créée :', facture.id)

    revalidatePath(`/stock/fournisseurs/${supplierId}`)
    revalidatePath('/stock/factures-fournisseurs')
    if (receptionPublicId) {
        revalidatePath('/stock/receptions')
        revalidatePath('/stock/mouvements')
    }
    return {
        succes:     true,
        facture_id: facture.id,
        public_id:  facture.public_id,
        reception:  receptionPublicId,
    }
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

    // Un seul appel : la RPC verrouille la facture, ecrit le paiement
    // dans la table unique supplier_payments avec le lettrage, met a
    // jour la facture et le solde du fournisseur, le tout dans une
    // seule transaction. Avant, c'etaient quatre requetes separees :
    // deux paiements simultanes passaient tous les deux le controle
    // du restant du.
    const { data: result, error } = await adminClient.rpc('payer_facture_fournisseur', {
        p_shop_id:    shopId,
        p_facture_id: factureId,
        p_montant:    montant,
        p_moyen:      moyen,
        p_reference:  reference,
        p_note:       '',
        p_user_id:    user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR PAIEMENT FACTURE FOURNISSEUR:', error)
        return { erreur: 'Erreur lors du paiement.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors du paiement.' }

    revalidatePath('/stock/fournisseurs')
    revalidatePath('/stock/factures-fournisseurs')
    revalidatePath(`/stock/factures-fournisseurs/${factureId}`)
    return { succes: true, statut: result.statut as string, montantRestant: Number(result.montant_restant ?? 0) }

}