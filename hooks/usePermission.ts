'use client'

import { useSessionBoutique } from '@/hooks/useSession'
import { estAdminComplet } from '@/lib/constants/permissions'

export function usePermission() {
    const { session } = useSessionBoutique()

    function peutFaire(permission: string): boolean {
        if (!session) return false
        // Le propriétaire et les administrateurs ont tout
        if (estAdminComplet(session.role)) return true
        return session.permissions.includes(permission)
    }

    function estRole(role: string): boolean {
        return session?.role === role
    }

    return { peutFaire, estRole, session }
}