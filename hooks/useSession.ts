'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { SessionBoutique, SessionPlateforme } from '@/types'

export function useSessionBoutique() {
    const [session, setSession] = useState<SessionBoutique | null>(null)
    const [chargement, setChargement] = useState(true)

    useEffect(() => {
        const supabase = createClient()

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user || user.user_metadata?.type_acteur !== 'shop') {
                setSession(null)
                setChargement(false)
                return
            }

            const meta = user.user_metadata
            setSession({
                utilisateur_id:   meta.user_id,
                public_id:        meta.public_id,
                nom_complet:      meta.nom_complet,
                role:             meta.role,
                permissions:      meta.permissions_etendues ?? [],
                shop_id:          meta.shop_id,
                shop_nom:         meta.shop_nom ?? '',
                shop_plan:        meta.shop_plan ?? 'starter',
            })
            setChargement(false)
        })
    }, [])

    return { session, chargement }
}

export function useSessionPlateforme() {
    const [session, setSession] = useState<SessionPlateforme | null>(null)
    const [chargement, setChargement] = useState(true)

    useEffect(() => {
        const supabase = createClient()

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user || user.user_metadata?.type_acteur !== 'platform') {
                setSession(null)
                setChargement(false)
                return
            }

            const meta = user.user_metadata
            setSession({
                utilisateur_id: meta.admin_id,
                public_id:      meta.public_id ?? 'PLAT-00001',
                nom_complet:    meta.nom_complet,
                role:           meta.role,
                email:          user.email ?? '',
            })
            setChargement(false)
        })
    }, [])

    return { session, chargement }
}