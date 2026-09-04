'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
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
    necessite_imei: boolean
    necessite_serie: boolean
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
    if (!aPermission(user, PERMISSIONS.VENTES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    // Validations règles métier côté serveur
    const shopId = user.user_metadata.shop_id as string

    if (donnees.items.length === 0) {
        return { erreur: 'Le panier est vide.' }
    }

    const adminClient = createAdminClient()

    // Récupérer la remise max + statut licence de la boutique
    const { data: boutique } = await adminClient
        .from('shops')
        .select('remise_max_pct, est_active, plan_expire_le')
        .eq('id', shopId)
        .single()

    // Garde licence — bloque la vente si boutique désactivée ou abonnement expiré
    if (!boutique || !boutique.est_active ||
        (boutique.plan_expire_le && new Date(boutique.plan_expire_le) < new Date())) {
        return { erreur: 'Abonnement expiré ou boutique désactivée. Vente impossible — contactez Manetec Inter BJ.' }
    }

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
        // Le message brut de la base — en anglais, technique — n'aide
        // pas un vendeur devant un client qui attend.
        console.error('ERREUR ENREGISTREMENT VENTE:', error)
        return { erreur: 'La vente n\'a pas pu être enregistrée. Réessayez ; si le problème persiste, prévenez votre responsable.' }
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
// La boutique est lue DANS LA SESSION, jamais reçue en argument : ce
// fichier porte 'use server', donc cette fonction est publiée comme
// Server Action et reste appelable par requête directe. Tant que
// `shopId` était un paramètre et qu'aucune vérification n'était faite,
// le catalogue, les prix de vente et les niveaux de stock d'une boutique
// se lisaient depuis une autre.
export async function rechercherProduitsPOS(terme: string, warehouseId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return []
    if (!aPermission(user, PERMISSIONS.PRODUITS_VOIR)) return []

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // L'entrepôt doit appartenir à la boutique : sans ce contrôle, on
    // choisissait librement dans quel stock regarder.
    const { data: entrepot } = await adminClient
        .from('warehouses')
        .select('id')
        .eq('id', warehouseId)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!entrepot) return []

    // Le terme était interpolé tel quel dans le filtre : une virgule ou
    // une parenthèse modifiait la structure de la clause au lieu d'être
    // cherchée. On retire ce que PostgREST interprète, et les jokers de
    // `ilike` qu'un utilisateur n'a pas à piloter.
    const propre = terme.replace(/[%_,().*:"'\\]/g, '').trim()
    if (propre.length < 2) return []

    const { data } = await adminClient
        .from('products')
        .select(`
      id, public_id, nom, type_produit, sku, code_barres,
      prix_vente, prix_gros, prix_minimum, unite,
      tva_pct, remise_max_pct, necessite_imei, necessite_serie,
      stock_levels!inner(quantite, warehouse_id)
    `)
        .eq('shop_id', shopId)
        .eq('est_actif', true)
        .eq('stock_levels.warehouse_id', warehouseId)
        .or(`nom.ilike.%${propre}%,sku.ilike.%${propre}%,code_barres.eq.${propre}`)
        .limit(10)

    return data ?? []
}

// ── Récupérer le détail d'une vente ───────────────────────────
// Lisait la vente par son seul identifiant, sans `shop_id` ni
// vérification de l'appelant : les lignes, les prix, le client et les
// règlements d'une vente appartenant à une autre boutique étaient
// lisibles. Même faille que celle corrigée dans `getDonneesRecu`.
export async function getDetailVente(saleId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return null
    if (!aPermission(user, PERMISSIONS.VENTES_VOIR)) return null

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
        .eq('shop_id', user.user_metadata.shop_id)
        .maybeSingle()

    return vente
}