'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { revalidatePath } from 'next/cache'

// ══════════════════════════════════════════════════════════════
// Opérations de stock : transferts, ajustements, retours.
// Toutes passent par une RPC atomique qui écrit via le point
// d'entrée unique appliquer_mouvement_stock().
// ══════════════════════════════════════════════════════════════

function revaliderStock() {
    revalidatePath('/stock/mouvements')
    revalidatePath('/stock/produits')
    revalidatePath('/stock/entrepots')
    revalidatePath('/stock/transferts')
    revalidatePath('/stock/ajustements')
    revalidatePath('/stock/retours')
}

// ── Transfert inter-entrepôts ─────────────────────────────────
export async function creerTransfert(
    warehouseFrom: string,
    warehouseTo:   string,
    note:          string,
    lignes:        { product_id: string; quantite: number }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_TRANSFERT)) return { erreur: 'Permission insuffisante pour cette action.' }

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }
    if (warehouseFrom === warehouseTo) {
        return { erreur: 'Les entrepôts source et destination doivent être différents.' }
    }

    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('effectuer_transfert', {
        p_data: {
            shop_id:        user.user_metadata.shop_id,
            warehouse_from: warehouseFrom,
            warehouse_to:   warehouseTo,
            note:           note || null,
            user_id:        user.user_metadata.user_id,
            items:          lignes.map(l => ({ product_id: l.product_id, quantite: l.quantite })),
        },
    })

    if (error) {
        console.error('ERREUR TRANSFERT:', error)
        return { erreur: 'Erreur lors du transfert.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors du transfert.' }

    revaliderStock()
    return { succes: true, public_id: result.public_id as string, nb_lignes: result.nb_lignes as number }
}

// ── Ajustement de stock ───────────────────────────────────────
export async function creerAjustement(
    warehouseId: string,
    motif:       string,
    note:        string,
    lignes:      { product_id: string; quantite_apres: number }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_AJUSTEMENT)) return { erreur: 'Permission insuffisante pour cette action.' }

    if (!motif) return { erreur: 'Le motif est obligatoire.' }
    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('effectuer_ajustement', {
        p_data: {
            shop_id:      user.user_metadata.shop_id,
            warehouse_id: warehouseId,
            motif,
            note:         note || null,
            user_id:      user.user_metadata.user_id,
            items:        lignes.map(l => ({
                product_id:     l.product_id,
                quantite_apres: l.quantite_apres,
            })),
        },
    })

    if (error) {
        console.error('ERREUR AJUSTEMENT:', error)
        return { erreur: 'Erreur lors de l\'ajustement.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de l\'ajustement.' }

    revaliderStock()
    return { succes: true, public_id: result.public_id as string, nb_lignes: result.nb_lignes as number }
}

// ── Retour client (partie stock) ──────────────────────────────
// La marchandise revient en stock. Le remboursement (avoir, geste
// commercial) est enregistré comme intention et traité au module
// Facturation : aucun solde client n'est modifié ici.
export async function creerRetourClient(donnees: {
    warehouseId: string
    saleId?:     string | null
    clientId?:   string | null
    motif:       string
    reglement:   'a_traiter' | 'avoir' | 'rembourse' | 'sans_suite'
    note?:       string
    lignes:      { product_id: string; quantite: number; prix_unitaire: number }[]
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.VENTES_RETOUR)) return { erreur: 'Permission insuffisante pour cette action.' }

    if (!donnees.motif?.trim()) return { erreur: 'Le motif du retour est obligatoire.' }
    if (donnees.lignes.length === 0) return { erreur: 'Ajoutez au moins un article retourné.' }

    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('effectuer_retour_vente', {
        p_data: {
            shop_id:      user.user_metadata.shop_id,
            warehouse_id: donnees.warehouseId,
            sale_id:      donnees.saleId   || null,
            client_id:    donnees.clientId || null,
            motif:        donnees.motif.trim(),
            reglement:    donnees.reglement,
            note:         donnees.note || null,
            user_id:      user.user_metadata.user_id,
            items:        donnees.lignes,
        },
    })

    if (error) {
        console.error('ERREUR RETOUR CLIENT:', error)
        return { erreur: 'Erreur lors de l\'enregistrement du retour.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de l\'enregistrement du retour.' }

    revaliderStock()
    return {
        succes:    true,
        public_id: result.public_id as string,
        montant:   Number(result.montant ?? 0),
    }
}

// ── Retour fournisseur (partie stock) ─────────────────────────
// La marchandise quitte le stock. La dette fournisseur n'est pas
// modifiée : elle relève du module Fournisseurs.
export async function creerRetourFournisseur(donnees: {
    warehouseId: string
    supplierId:  string
    motif:       string
    note?:       string
    lignes:      { product_id: string; quantite: number; prix_unitaire: number }[]
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_AJUSTEMENT)) return { erreur: 'Permission insuffisante pour cette action.' }

    if (!donnees.motif?.trim()) return { erreur: 'Le motif du retour est obligatoire.' }
    if (!donnees.supplierId) return { erreur: 'Sélectionnez un fournisseur.' }
    if (donnees.lignes.length === 0) return { erreur: 'Ajoutez au moins un article à retourner.' }

    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('effectuer_retour_fournisseur', {
        p_data: {
            shop_id:      user.user_metadata.shop_id,
            warehouse_id: donnees.warehouseId,
            supplier_id:  donnees.supplierId,
            motif:        donnees.motif.trim(),
            note:         donnees.note || null,
            user_id:      user.user_metadata.user_id,
            items:        donnees.lignes,
        },
    })

    if (error) {
        console.error('ERREUR RETOUR FOURNISSEUR:', error)
        return { erreur: 'Erreur lors de l\'enregistrement du retour.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de l\'enregistrement du retour.' }

    revaliderStock()
    return {
        succes:    true,
        public_id: result.public_id as string,
        montant:   Number(result.montant ?? 0),
    }
}

// ── Entrepôt : définir par défaut / activer / désactiver ──────
// Aucun de ces réglages n'était modifiable après la création :
// l'entrepôt par défaut est pourtant celui présélectionné à la
// caisse, en réception et à l'inventaire.
export async function definirEntrepotDefaut(entrepotId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_AJUSTEMENT)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: cible } = await adminClient
        .from('warehouses')
        .select('id, est_actif')
        .eq('id', entrepotId)
        .eq('shop_id', shopId)
        .single()

    if (!cible) return { erreur: 'Entrepôt introuvable.' }
    if (!cible.est_actif) return { erreur: 'Un entrepôt désactivé ne peut pas être l\'entrepôt par défaut.' }

    await adminClient.from('warehouses')
        .update({ est_defaut: false })
        .eq('shop_id', shopId)
        .eq('est_defaut', true)

    const { error } = await adminClient.from('warehouses')
        .update({ est_defaut: true })
        .eq('id', entrepotId)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors de la modification.' }

    revalidatePath('/stock/entrepots')
    revalidatePath(`/stock/entrepots/${entrepotId}`)
    return { succes: true }
}

export async function toggleActivationEntrepot(entrepotId: string, estActif: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_AJUSTEMENT)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: entrepot } = await adminClient
        .from('warehouses')
        .select('est_defaut')
        .eq('id', entrepotId)
        .eq('shop_id', shopId)
        .single()

    if (!entrepot) return { erreur: 'Entrepôt introuvable.' }

    if (!estActif) {
        if (entrepot.est_defaut) {
            return { erreur: 'Impossible de désactiver l\'entrepôt par défaut. Désignez d\'abord un autre entrepôt par défaut.' }
        }

        // Un entrepôt qui contient encore de la marchandise ne peut pas
        // disparaître des écrans sans que ce stock devienne invisible.
        const { data: restant } = await adminClient
            .from('stock_levels')
            .select('quantite')
            .eq('warehouse_id', entrepotId)
            .gt('quantite', 0)
            .limit(1)

        if (restant && restant.length > 0) {
            return { erreur: 'Cet entrepôt contient encore du stock. Transférez-le ailleurs avant de le désactiver.' }
        }
    }

    const { error } = await adminClient.from('warehouses')
        .update({ est_actif: estActif })
        .eq('id', entrepotId)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors de la modification.' }

    revalidatePath('/stock/entrepots')
    revalidatePath(`/stock/entrepots/${entrepotId}`)
    return { succes: true }
}
