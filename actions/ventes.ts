'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface LigneVente {
    product_id:     string
    nom:            string
    quantite:       number
    prix_unitaire:  number
    remise_pct:     number
    remise_val:     number
    montant_ligne:  number
    tva_pct:        number
    montant_tva:    number
    imei:           string
    note:           string
    stock_disponible: number
    prix_minimum:   number | null
    unite:          string
}

export interface PaiementVente {
    moyen_paiement: string
    montant:        number
    reference:      string
}

export interface DonneesVente {
    shop_id:             string
    warehouse_id:        string
    vendeur_id:          string
    client_id:           string
    items:               LigneVente[]
    paiements:           PaiementVente[]
    montant_brut:        number
    remise_globale_pct:  number
    remise_globale_val:  number
    montant_net:         number
    montant_tva:         number
    montant_total:       number
    montant_recu:        number
    montant_rendu:       number
    credit_utilise:      number
    advance_utilise:     number
    change_utilise:      number
    credit_accorde:      number
    garder_monnaie:      boolean
    note:                string
}

export async function enregistrerVente(donnees: DonneesVente) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    // Validations règles métier côté serveur
    const shopId = user.user_metadata.shop_id as string

    if (donnees.items.length === 0) {
        return { erreur: 'Le panier est vide.' }
    }

    const adminClient = createAdminClient()

    // Récupérer la remise max de la boutique
    const { data: boutique } = await adminClient
        .from('shops')
        .select('remise_max_pct')
        .eq('id', shopId)
        .single()

    const remiseMax = boutique?.remise_max_pct ?? 15

    // Vérifier règle prix minimum par ligne
    for (const item of donnees.items) {
        if (item.prix_minimum !== null && item.prix_unitaire < item.prix_minimum) {
            return {
                erreur: `Prix de "${item.nom}" (${item.prix_unitaire}) inférieur au prix minimum (${item.prix_minimum}).`,
            }
        }
    }

    // Vérifier remise globale
    if (donnees.remise_globale_pct > remiseMax) {
        return {
            erreur: `La remise globale (${donnees.remise_globale_pct}%) dépasse le maximum autorisé (${remiseMax}%).`,
        }
    }

    // Appeler la fonction atomique Supabase
    const { data: result, error } = await adminClient.rpc('enregistrer_vente', {
        p_data: {
            ...donnees,
            shop_id:    shopId,
            vendeur_id: user.user_metadata.user_id,
        },
    })

    if (error) {
        return { erreur: error.message }
    }

    if (!result.succes) {
        return { erreur: result.erreur }
    }

    revalidatePath('/pos')
    return {
        succes:    true,
        sale_id:   result.sale_id,
        public_id: result.public_id,
    }
}

// ── Rechercher des produits pour le POS ───────────────────────
export async function rechercherProduitsPOS(
    terme: string,
    shopId: string,
    warehouseId: string
) {
    const adminClient = createAdminClient()

    const { data } = await adminClient
        .from('products')
        .select(`
      id, public_id, nom, type_produit, sku, code_barres,
      prix_vente, prix_gros, prix_minimum, unite,
      tva_pct, remise_max_pct,
      stock_levels!inner(quantite, warehouse_id)
    `)
        .eq('shop_id', shopId)
        .eq('est_actif', true)
        .eq('stock_levels.warehouse_id', warehouseId)
        .or(`nom.ilike.%${terme}%,sku.ilike.%${terme}%,code_barres.eq.${terme}`)
        .limit(10)

    return data ?? []
}

// ── Récupérer le détail d'une vente ───────────────────────────
export async function getDetailVente(saleId: string) {
    const adminClient = createAdminClient()

    const { data: vente } = await adminClient
        .from('sales')
        .select(`
      *,
      clients(nom, public_id, telephone),
      shop_users(nom_complet),
      sale_items(
        id, quantite, prix_unitaire, remise_pct,
        montant_ligne, imei, note,
        products(nom, unite, public_id)
      ),
      sale_payments(moyen_paiement, montant, reference)
    `)
        .eq('id', saleId)
        .single()

    return vente
}