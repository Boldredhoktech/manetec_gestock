'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ROLES } from '@/lib/constants/permissions'

// ── Créer un entrepôt ─────────────────────────────────────────
export async function creerEntrepot(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const nom         = (formData.get('nom') as string)?.trim()
    const description = (formData.get('description') as string)?.trim()
    const adresse     = (formData.get('adresse') as string)?.trim()
    const estDefaut   = formData.get('estDefaut') === 'true'

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    // Multi-entrepôts selon le plan : un plan sans multi_entrepots est limité à 1 entrepôt
    const { getPlanLimites } = await import('@/lib/constants/plans')
    const { data: boutiquePlan } = await adminClient
        .from('shops').select('plan').eq('id', shopId).single()
    const limitesPlan = getPlanLimites(boutiquePlan?.plan ?? 'starter')
    if (!limitesPlan.multi_entrepots) {
        const { count: nbEntrepots } = await adminClient
            .from('warehouses')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
        if ((nbEntrepots ?? 0) >= 1) {
            return { erreur: `Votre plan ${limitesPlan.label} ne permet qu'un seul entrepôt. Passez au plan Pro ou Enterprise pour gérer plusieurs entrepôts.` }
        }
    }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'WH' })

    // Si premier entrepôt ou marqué défaut, désactiver l'ancien défaut
    if (estDefaut) {
        await adminClient
            .from('warehouses')
            .update({ est_defaut: false })
            .eq('shop_id', shopId)
    }

    // Vérifier si c'est le premier entrepôt
    const { count } = await adminClient
        .from('warehouses')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId)

    const { error } = await adminClient.from('warehouses').insert({
        public_id:   publicId,
        shop_id:     shopId,
        nom,
        description: description || null,
        adresse:     adresse || null,
        est_defaut:  estDefaut || (count === 0), // premier = défaut auto
        est_actif:   true,
        created_by:  user.user_metadata.user_id,
    })

    if (error) return { erreur: 'Erreur lors de la création de l\'entrepôt.' }

    revalidatePath('/stock/entrepots')
    redirect('/stock/entrepots')
}

// ── Créer une catégorie ───────────────────────────────────────
export async function creerCategorie(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const nom       = (formData.get('nom') as string)?.trim()
    const parentId  = (formData.get('parentId') as string) || null
    const couleur   = (formData.get('couleur') as string) || null

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'CAT' })

    const { error } = await adminClient.from('categories').insert({
        public_id:  publicId,
        shop_id:    shopId,
        parent_id:  parentId || null,
        nom,
        couleur:    couleur || null,
        est_actif:  true,
    })

    if (error) return { erreur: 'Erreur lors de la création de la catégorie.' }

    revalidatePath('/stock/categories')
    return { succes: true }
}

// ── Créer une marque ──────────────────────────────────────────
export async function creerMarque(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()
    const nom         = (formData.get('nom') as string)?.trim()

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'BRD' })

    const { error } = await adminClient.from('brands').insert({
        public_id: publicId,
        shop_id:   shopId,
        nom,
        est_actif: true,
    })

    if (error) return { erreur: 'Erreur lors de la création de la marque.' }

    revalidatePath('/stock/produits')
    return { succes: true }
}

// ── Créer un produit ──────────────────────────────────────────
export async function creerProduit(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const nom           = (formData.get('nom') as string)?.trim()
    const typeProduit   = (formData.get('typeProduit') as string) || 'simple'
    const categoryId    = (formData.get('categoryId') as string) || null
    const brandId       = (formData.get('brandId') as string) || null
    const sku           = (formData.get('sku') as string)?.trim() || null
    const codeBarres    = (formData.get('codeBarres') as string)?.trim() || null
    const unite         = (formData.get('unite') as string)?.trim() || 'pièce'
    const prixAchat     = parseFloat(formData.get('prixAchat') as string) || 0
    const prixVente     = parseFloat(formData.get('prixVente') as string) || 0
    const prixGros      = parseFloat(formData.get('prixGros') as string) || null
    const prixMinimum   = parseFloat(formData.get('prixMinimum') as string) || null
    const seuilAlerte   = parseInt(formData.get('seuilAlerte') as string) || 5
    const description   = (formData.get('description') as string)?.trim() || null
    const necessiteImei   = formData.get('necessite_imei') === 'true'
    const necessiteSerie  = formData.get('necessite_serie') === 'true'
    const estRetournable  = formData.get('est_retournable') === 'true'
    const garantieMois    = parseInt(formData.get('garantie_mois') as string) || null

    // Stock initial
    const stockInitial  = parseFloat(formData.get('stockInitial') as string) || 0
    const warehouseId   = formData.get('warehouseId') as string

    if (!nom) return { erreur: 'Le nom du produit est obligatoire.' }
    if (prixVente <= 0) return { erreur: 'Le prix de vente doit être supérieur à 0.' }
    if (!warehouseId) return { erreur: 'Veuillez sélectionner un entrepôt.' }

    // Vérifier limite produits selon plan
    const { data: boutique } = await adminClient
        .from('shops')
        .select('plan')
        .eq('id', shopId)
        .single()

    const { PLANS } = await import('@/lib/constants/plans')
    const limites = PLANS[(boutique?.plan ?? 'starter') as keyof typeof PLANS]

    if (limites.max_produits !== -1) {
        const { count } = await adminClient
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .eq('est_actif', true)

        if ((count ?? 0) >= limites.max_produits) {
            return {
                erreur: `Votre plan est limité à ${limites.max_produits} produits. Passez au plan supérieur.`,
            }
        }
    }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'ITM' })

    const { data: produit, error } = await adminClient
        .from('products')
        .insert({
            public_id:    publicId,
            shop_id:      shopId,
            category_id:  categoryId || null,
            brand_id:     brandId || null,
            nom,
            description,
            type_produit: typeProduit,
            sku,
            code_barres:  codeBarres,
            unite,
            prix_achat:   prixAchat,
            prix_vente:   prixVente,
            prix_gros:    prixGros || null,
            prix_minimum: prixMinimum || null,
            seuil_alerte: seuilAlerte,
            necessite_imei:  necessiteImei,
            necessite_serie: necessiteSerie,
            est_retournable: estRetournable,
            garantie_mois:   garantieMois,
            est_actif:    true,
            created_by:   user.user_metadata.user_id,
        })
        .select()
        .single()

    if (error || !produit) return { erreur: 'Erreur lors de la création du produit.' }

    // Créer le niveau de stock initial
    await adminClient.from('stock_levels').insert({
        shop_id:      shopId,
        product_id:   produit.id,
        warehouse_id: warehouseId,
        quantite:     stockInitial,
    })

    // Si stock initial > 0 : enregistrer le mouvement
    if (stockInitial > 0) {
        const { data: mvtPublicId } = await adminClient
            .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'MVT' })

        await adminClient.from('stock_movements').insert({
            public_id:      mvtPublicId,
            shop_id:        shopId,
            product_id:     produit.id,
            warehouse_id:   warehouseId,
            type_mouvement: 'entree_initiale',
            quantite:       stockInitial,
            quantite_avant: 0,
            quantite_apres: stockInitial,
            note:           'Stock initial à la création du produit',
            created_by:     user.user_metadata.user_id,
        })
    }

    revalidatePath('/stock/produits')
    redirect('/stock/produits')
}

// ── Modifier les prix d'un produit ────────────────────────────
export async function modifierPrixProduit(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const adminClient = createAdminClient()
    const productId   = formData.get('productId') as string
    const prixAchat   = parseFloat(formData.get('prixAchat') as string)
    const prixVente   = parseFloat(formData.get('prixVente') as string)
    const prixGros    = parseFloat(formData.get('prixGros') as string) || null
    const prixMinimum = parseFloat(formData.get('prixMinimum') as string) || null

    // Récupérer anciens prix pour historique
    const { data: ancien } = await adminClient
        .from('products')
        .select('prix_achat, prix_vente, shop_id')
        .eq('id', productId)
        .single()

    if (!ancien) return { erreur: 'Produit introuvable.' }

    await adminClient
        .from('products')
        .update({ prix_achat: prixAchat, prix_vente: prixVente, prix_gros: prixGros, prix_minimum: prixMinimum })
        .eq('id', productId)

    // Historique des prix
    await adminClient.from('price_history').insert({
        shop_id:            ancien.shop_id,
        product_id:         productId,
        ancien_prix_achat:  ancien.prix_achat,
        nouveau_prix_achat: prixAchat,
        ancien_prix_vente:  ancien.prix_vente,
        nouveau_prix_vente: prixVente,
        modifie_par:        user.user_metadata.user_id,
    })

    revalidatePath('/stock/produits')
    return { succes: true }
}

// ── Désactiver un produit ─────────────────────────────────────
export async function toggleActivationProduit(
    productId: string,
    estActif: boolean
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const adminClient = createAdminClient()

    await adminClient
        .from('products')
        .update({ est_actif: estActif })
        .eq('id', productId)

    revalidatePath('/stock/produits')
    return { succes: true }
}

// ── Créer une variante produit ─────────────────────────────────
export async function creerVarianteProduit(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId        = user.user_metadata.shop_id as string
    const adminClient   = createAdminClient()
    const productId     = formData.get('productId') as string
    const nom           = (formData.get('nom') as string)?.trim()
    const attributeType = (formData.get('attributeType') as string) || 'other'
    const colorHex      = (formData.get('colorHex') as string) || null

    if (!nom || !productId) return { erreur: 'Données manquantes.' }

    const { error } = await adminClient.from('product_variants').insert({
        shop_id:        shopId,
        product_id:     productId,
        nom,
        attribute_type: attributeType,
        color_hex:      colorHex || null,
        est_actif:      true,
    })

    if (error) return { erreur: 'Erreur lors de la création de la variante.' }

    revalidatePath(`/stock/produits/${productId}`)
    return { succes: true }
}

// ── Modifier un entrepôt ───────────────────────────────────────
export async function modifierEntrepot(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const adminClient  = createAdminClient()
    const entrepotId   = formData.get('entrepotId') as string
    const nom          = (formData.get('nom') as string)?.trim()
    const description  = (formData.get('description') as string)?.trim() || null
    const adresse      = (formData.get('adresse') as string)?.trim() || null

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { error } = await adminClient
        .from('warehouses')
        .update({ nom, description, adresse })
        .eq('id', entrepotId)
        .eq('shop_id', user.user_metadata.shop_id)

    if (error) return { erreur: 'Erreur lors de la modification.' }

    revalidatePath(`/stock/entrepots/${entrepotId}`)
    revalidatePath('/stock/entrepots')
    return { succes: true }
}

// ── À AJOUTER À LA FIN DE actions/produits.ts ─────────────────

export async function modifierProduit(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const productId     = formData.get('productId') as string
    const nom           = (formData.get('nom') as string)?.trim()
    const description   = (formData.get('description') as string)?.trim() || null
    const typeProduit   = (formData.get('type_produit') as string) || 'simple'
    const sku           = (formData.get('sku') as string)?.trim() || null
    const codeBarres    = (formData.get('code_barres') as string)?.trim() || null
    const unite         = (formData.get('unite') as string)?.trim() || 'unité'
    const categoryId    = (formData.get('category_id') as string) || null
    const brandId       = (formData.get('brand_id') as string) || null
    const prixAchat     = parseFloat(formData.get('prix_achat') as string) || 0
    const prixVente     = parseFloat(formData.get('prix_vente') as string) || 0
    const prixGros      = parseFloat(formData.get('prix_gros') as string) || null
    const prixMinimum   = parseFloat(formData.get('prix_minimum') as string) || null
    const tvaPct        = parseFloat(formData.get('tva_pct') as string) || 0
    const seuilAlerte   = parseInt(formData.get('seuil_alerte') as string) || 0
    const garantieMois  = parseInt(formData.get('garantie_mois') as string) || null
    const necessiteImei  = formData.get('necessite_imei') === 'true'
    const necessiteSerie = formData.get('necessite_serie') === 'true'
    const estRetournable = formData.get('est_retournable') === 'true'

    if (!nom)        return { erreur: 'Le nom est obligatoire.' }
    if (!productId)  return { erreur: 'Produit introuvable.' }
    if (prixVente <= 0) return { erreur: 'Le prix de vente doit être supérieur à 0.' }

    // Enregistrer l'historique des prix si le prix de vente ou d'achat change
    const { data: ancienProduit } = await adminClient
        .from('products')
        .select('prix_achat, prix_vente')
        .eq('id', productId)
        .single()

    const prixChange = ancienProduit && (
        ancienProduit.prix_vente !== prixVente ||
        ancienProduit.prix_achat !== prixAchat
    )

    const { error } = await adminClient
        .from('products')
        .update({
            nom,
            description,
            type_produit:    typeProduit,
            sku,
            code_barres:     codeBarres,
            unite,
            category_id:     categoryId || null,
            brand_id:        brandId || null,
            prix_achat:      prixAchat,
            prix_vente:      prixVente,
            prix_gros:       prixGros || null,
            prix_minimum:    prixMinimum || null,
            tva_pct:         tvaPct,
            seuil_alerte:    seuilAlerte,
            garantie_mois:   garantieMois || null,
            necessite_imei:  necessiteImei,
            necessite_serie: necessiteSerie,
            est_retournable: estRetournable,
        })
        .eq('id', productId)
        .eq('shop_id', shopId)

    if (error) {
        console.error('ERREUR MODIFIER PRODUIT:', error)
        return { erreur: 'Erreur lors de la modification du produit.' }
    }

    // Enregistrer dans l'historique des prix si changement
    if (prixChange) {
        await adminClient.from('price_history').insert({
            shop_id:            shopId,
            product_id:         productId,
            ancien_prix_achat:  ancienProduit!.prix_achat,
            nouveau_prix_achat: prixAchat,
            ancien_prix_vente:  ancienProduit!.prix_vente,
            nouveau_prix_vente: prixVente,
            created_by:         user.user_metadata.user_id,
        })
    }

    revalidatePath(`/stock/produits/${productId}`)
    revalidatePath('/stock/produits')
    return { succes: true }
}