import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fichePlan, labelPlan } from '@/lib/abonnement/catalogue'

export default async function SidebarPlanBadge() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const adminClient = createAdminClient()
    const { data: boutique } = await adminClient
        .from('shops')
        .select('plan')
        .eq('id', user.user_metadata.shop_id)
        .single()

    const plan = boutique?.plan ?? 'starter'

    return (
        <span style={{ color: fichePlan(plan).couleurSurFonce }}>
      Plan {labelPlan(plan)}
    </span>
    )
}