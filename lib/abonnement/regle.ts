// lib/abonnement/regle.ts
// ═══════════════════════════════════════════════════════════════
// La règle d'état d'abonnement, sans aucune dépendance : le middleware
// la charge aussi, et il ne doit embarquer ni le client admin ni React.
// Le reste du code passe par `lib/abonnement/etat.ts`, qui la réexporte.
// ═══════════════════════════════════════════════════════════════

export type EtatAbonnement = 'actif' | 'expire' | 'desactive'

/** Seule page qu'une boutique expirée peut encore atteindre (D3). */
export const CHEMIN_ABONNEMENT = '/admin/abonnement'

type BoutiqueLicence = {
    est_active:     boolean
    plan_expire_le: string | null
} | null | undefined

/** Une boutique introuvable est traitée comme désactivée. */
export function etatAbonnement(
    boutique: BoutiqueLicence,
    maintenant: Date = new Date()
): EtatAbonnement {
    if (!boutique || !boutique.est_active) return 'desactive'
    if (boutique.plan_expire_le && new Date(boutique.plan_expire_le) <= maintenant) return 'expire'
    return 'actif'
}

/** D3 : à l'expiration, seul l'administrateur de la boutique entre encore. */
export function peutEntrerBoutiqueExpiree(role?: string | null): boolean {
    return role === 'super_admin_boutique' || role === 'admin_boutique'
}
