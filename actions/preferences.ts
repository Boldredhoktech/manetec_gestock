'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { COOKIE_THEME, estTheme, type Theme } from '@/lib/theme'

/** Change le thème de l'utilisateur connecté (compte + cookie). */
export async function changerTheme(theme: Theme): Promise<{ succes: true } | { erreur: string }> {
    if (!estTheme(theme)) return { erreur: 'Thème inconnu.' }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    await createAdminClient().from('shop_users')
        .update({ preference_theme: theme })
        .eq('id', user.user_metadata.user_id)
        .eq('shop_id', user.user_metadata.shop_id)

    ;(await cookies()).set(COOKIE_THEME, theme, {
        path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365,
    })
    return { succes: true }
}
