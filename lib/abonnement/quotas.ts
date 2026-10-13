// lib/abonnement/quotas.ts
// ═══════════════════════════════════════════════════════════════
// D8 / ABO-13 : passer à un plan inférieur est refusé tant que la
// boutique dépasse ses quotas. Avant, rien ne le vérifiait : une
// boutique Pro à 300 produits devenait Starter (alors 50) sans le savoir.
// Les décomptes sont ceux des actions de création (mêmes filtres).
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimites, ILLIMITE } from '@/lib/constants/plans'
import { labelPlan } from '@/lib/abonnement/catalogue'

/** Renvoie le motif du refus, ou null si la boutique tient dans le plan visé. */
export async function refusChangementPlan(shopId: string, planVise: string): Promise<string | null> {
    const limites = getPlanLimites(planVise)
    const admin   = createAdminClient()

    const [produits, utilisateurs, clients] = await Promise.all([
        // Produits désactivés inclus, comme à la création.
        admin.from('products').select('*', { count: 'exact', head: true }).eq('shop_id', shopId),
        admin.from('shop_users').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('est_actif', true),
        admin.from('clients').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('est_anonyme', false),
    ])

    const depassements: string[] = []
    const verifier = (n: number | null, max: number, quoi: string) => {
        if (max < ILLIMITE && (n ?? 0) > max) depassements.push(`${n} ${quoi} (maximum ${max})`)
    }
    verifier(produits.count,     limites.max_produits,     'produits')
    verifier(utilisateurs.count, limites.max_utilisateurs, 'utilisateurs actifs')
    verifier(clients.count,      limites.max_clients,      'clients')

    if (depassements.length === 0) return null
    return `Impossible de passer au plan ${labelPlan(planVise)} : la boutique compte ${depassements.join(', ')}. `
        + 'Réduisez d\'abord ces éléments ou gardez le plan actuel.'
}
