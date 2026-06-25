// lib/auth/permissions-serveur.ts
// ═══════════════════════════════════════════════════════════════
// Vérification des permissions côté serveur (source de vérité).
// Miroir de hooks/usePermission mais pour les Server Actions / routes.
// L'UI ne fait que masquer — c'est ICI que l'autorisation est réellement
// appliquée.
// ═══════════════════════════════════════════════════════════════

import { ROLES, PERMISSIONS_PAR_DEFAUT, type RoleBoutique } from '@/lib/constants/permissions'

type UserLike = {
    user_metadata?: {
        type_acteur?: string
        role?: string
        permissions_etendues?: string[]
    }
} | null | undefined

/**
 * Renvoie true si l'utilisateur boutique possède la permission demandée.
 * - super_admin_boutique : tout
 * - autres rôles : permissions par défaut du rôle ∪ permissions étendues (JWT)
 */
export function aPermission(user: UserLike, permission: string): boolean {
    const meta = user?.user_metadata
    if (!meta || meta.type_acteur !== 'shop') return false
    if (meta.role === ROLES.SUPER_ADMIN_BOUTIQUE) return true

    const defauts  = PERMISSIONS_PAR_DEFAUT[meta.role as RoleBoutique] ?? []
    const etendues = meta.permissions_etendues ?? []
    return defauts.includes(permission) || etendues.includes(permission)
}

/** Variante qui renvoie directement l'objet d'erreur standard, ou null si OK. */
export function refusSiPasPermission(
    user: UserLike,
    permission: string,
): { erreur: string } | null {
    return aPermission(user, permission)
        ? null
        : { erreur: 'Vous n\'avez pas la permission d\'effectuer cette action.' }
}
