import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SidebarBoutique from '@/components/shop/SidebarBoutique'

// Le plan est lu EN BASE, jamais dans le JWT : celui-ci peut dater
// d'avant un changement d'abonnement.
export default async function SidebarBoutiqueWrapper() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const adminClient = createAdminClient()
    const { data: boutique } = await adminClient
        .from('shops')
        .select('plan')
        .eq('id', user.user_metadata.shop_id)
        .single()

    return <SidebarBoutique planReel={boutique?.plan ?? 'starter'} />
}
