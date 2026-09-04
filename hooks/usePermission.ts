'use client'

import { useSessionBoutique } from '@/hooks/useSession'
import {
    estAdminComplet,
    PERMISSIONS_PAR_DEFAUT,
    type RoleBoutique,
} from '@/lib/constants/permissions'

// Ce hook doit donner exactement la même réponse que `aPermission`
// (lib/auth/permissions-serveur.ts), sinon l'interface cache des écrans
// que le serveur autorise. C'était le cas : la session ne porte que les
// permissions ÉTENDUES du JWT, et on comparait à celles-là seules — un
// comptable, dont toutes les permissions viennent des défauts de son
// rôle, se voyait donc refuser des boutons auxquels il avait droit.
export function usePermission() {
    const { session } = useSessionBoutique()

    function peutFaire(permission: string): boolean {
        if (!session) return false
        // Le propriétaire et les administrateurs ont tout
        if (estAdminComplet(session.role)) return true

        const defauts = PERMISSIONS_PAR_DEFAUT[session.role as RoleBoutique] ?? []
        return defauts.includes(permission) || session.permissions.includes(permission)
    }

    function estRole(role: string): boolean {
        return session?.role === role
    }

    return { peutFaire, estRole, session }
}
