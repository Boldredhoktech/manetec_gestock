'use client'

import { useSessionBoutique } from '@/hooks/useSession'
import { ROLES } from '@/lib/constants/permissions'

export function usePermission() {
    const { session } = useSessionBoutique()

    function peutFaire(permission: string): boolean {
        if (!session) return false
        // Le super_admin_boutique a tout
        if (session.role === ROLES.SUPER_ADMIN_BOUTIQUE) return true
        return session.permissions.includes(permission)
    }

    function estRole(role: string): boolean {
        return session?.role === role
    }

    return { peutFaire, estRole, session }
}