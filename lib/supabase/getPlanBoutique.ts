import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimites, type PlanLimites } from '@/lib/constants/plans'

// Lit TOUJOURS le plan depuis la DB, jamais depuis le JWT
export async function getPlanBoutique(shopId: string): Promise<{
    plan:    string
    limites: PlanLimites
}> {
    const adminClient = createAdminClient()
    const { data } = await adminClient
        .from('shops')
        .select('plan')
        .eq('id', shopId)
        .single()

    const plan = data?.plan ?? 'starter'
    return { plan, limites: getPlanLimites(plan) }
}