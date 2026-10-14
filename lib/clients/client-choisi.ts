// lib/clients/client-choisi.ts
// Le client tel que le manipulent les écrans de vente (caisse, facture,
// proforma) via le composant ChoixClient.

import type { createAdminClient } from '@/lib/supabase/admin'

export const COLONNES_CLIENT_CHOISI =
    'id, public_id, nom, telephone, credit_balance, advance_balance, change_balance, plafond_credit'

export interface ClientChoisi {
    id: string; public_id: string; nom: string; telephone: string | null
    credit_balance: number; advance_balance: number; change_balance: number
    plafond_credit: number
}

/**
 * Client déjà choisi à l'ouverture d'un formulaire (lien « nouvelle
 * facture » depuis une fiche, proforma en modification). Lu même s'il a
 * été désactivé depuis : il reste le client de la pièce.
 */
export async function chargerClientChoisi(
    adminClient: ReturnType<typeof createAdminClient>,
    shopId: string,
    clientId: string | null | undefined,
): Promise<ClientChoisi | null> {
    if (!clientId) return null
    const { data } = await adminClient
        .from('clients')
        .select(COLONNES_CLIENT_CHOISI)
        .eq('id', clientId)
        .eq('shop_id', shopId)
        .maybeSingle()
    return data
}
