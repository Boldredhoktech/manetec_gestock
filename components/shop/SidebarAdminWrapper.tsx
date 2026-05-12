import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SidebarAdmin from '@/components/shop/SidebarAdmin'

export default async function SidebarAdminWrapper() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const adminClient = createAdminClient()
    const { data: boutique } = await adminClient
        .from('shops')
        .select('plan')
        .eq('id', user.user_metadata.shop_id)
        .single()

    // Lecture du plan réel depuis la DB — jamais depuis le JWT stale
    const planReel = boutique?.plan ?? 'starter'

    return <SidebarAdmin planReel={planReel} />
}