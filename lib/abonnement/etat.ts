// lib/abonnement/etat.ts
// ═══════════════════════════════════════════════════════════════
// Seul endroit qui décide si une boutique est en service (ABO-05).
//
// Avant : l'expiration n'était contrôlée qu'au layout (affichage des
// pages), à la connexion et dans UNE server action sur 75 — une session
// ouverte avant l'échéance continuait d'écrire, et les routes PDF
// répondaient toujours. Chacun recopiait sa propre comparaison de date.
//
// Désormais : le layout, la connexion, `gardeRouteBoutique`, les routes
// API et TOUTES les server actions boutique passent par ici.
// L'état est toujours lu EN BASE, jamais dans le JWT (figé à la connexion).
// ═══════════════════════════════════════════════════════════════

import { cache } from 'react'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ENTREPRISE } from '@/lib/config/entreprise'
import { etatAbonnement, type EtatAbonnement } from '@/lib/abonnement/regle'

export { etatAbonnement, CHEMIN_ABONNEMENT, peutEntrerBoutiqueExpiree, type EtatAbonnement } from '@/lib/abonnement/regle'

/** Lu en base ; dédoublonné le temps d'un même rendu. */
export const etatAbonnementBoutique = cache(async (shopId: string): Promise<EtatAbonnement> => {
    const { data } = await createAdminClient()
        .from('shops')
        .select('est_active, plan_expire_le')
        .eq('id', shopId)
        .single()
    return etatAbonnement(data)
})

export const MESSAGES_ABONNEMENT: Record<Exclude<EtatAbonnement, 'actif'>, string> = {
    expire:    `L'abonnement de cette boutique a expiré. L'administrateur de la boutique peut le renouveler depuis la page Abonnement, ou contacter ${ENTREPRISE.nom}.`,
    desactive: `Cette boutique a été désactivée. Contactez ${ENTREPRISE.nom}.`,
}

type SessionBoutique = { user_metadata?: { shop_id?: string } } | null | undefined

/**
 * Garde des server actions : renvoie le message de refus, ou null si la
 * boutique est en service. À appeler juste après le contrôle de session.
 */
export async function refusAbonnement(user: SessionBoutique): Promise<string | null> {
    const shopId = user?.user_metadata?.shop_id
    if (!shopId) return MESSAGES_ABONNEMENT.desactive
    const etat = await etatAbonnementBoutique(shopId)
    return etat === 'actif' ? null : MESSAGES_ABONNEMENT[etat]
}

/** Même garde pour les routes API : 403 portant le motif, ou null. */
export async function refusAbonnementRoute(user: SessionBoutique): Promise<NextResponse | null> {
    const motif = await refusAbonnement(user)
    return motif ? new NextResponse(motif, { status: 403 }) : null
}
