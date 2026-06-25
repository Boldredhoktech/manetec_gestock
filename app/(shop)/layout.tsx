// app/(shop)/layout.tsx

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function LayoutShop({
                                             children,
                                         }: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        redirect('/login')
    }

    // Application de la licence — statut lu en base (jamais depuis le JWT, qui est périmé)
    const adminClient = createAdminClient()
    const { data: shop } = await adminClient
        .from('shops')
        .select('est_active, plan_expire_le')
        .eq('id', user.user_metadata.shop_id)
        .single()

    if (!shop || !shop.est_active) {
        redirect('/login?suspendu=desactive')
    }

    if (shop.plan_expire_le && new Date(shop.plan_expire_le) < new Date()) {
        redirect('/login?suspendu=expire')
    }

    return <>{children}</>
}