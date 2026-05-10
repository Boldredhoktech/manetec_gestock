import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CentreRapports from '@/components/shop/rapports/CentreRapports'

export const metadata: Metadata = { title: 'Rapports' }

export default async function PageRapports() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Rapports</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Générez et téléchargez vos rapports PDF
                </p>
            </header>
            <main className="flex-1 p-6">
                <CentreRapports />
            </main>
        </div>
    )
}