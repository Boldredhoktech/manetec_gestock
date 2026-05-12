import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const PLAN_LABELS: Record<string, string> = {
        starter:    'Starter',
        pro:        'Pro',
        enterprise: 'Enterprise',
    }

    const PLAN_COLORS: Record<string, string> = {
        starter:    'rgba(255,255,255,0.65)',
        pro:        '#f59e0b',
        enterprise: '#10b981',
    }

    return (
        <span style={{ color: PLAN_COLORS[plan] ?? 'rgba(255,255,255,0.65)' }}>
      Plan {PLAN_LABELS[plan] ?? plan}
    </span>
    )
}