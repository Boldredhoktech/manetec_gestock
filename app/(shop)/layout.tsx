// app/(shop)/layout.tsx

import { createClient } from '@/lib/supabase/server'
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

    return <>{children}</>
}