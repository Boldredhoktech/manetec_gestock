// app/(shop)/admin/clients/nouveau/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireClient from '@/components/shop/FormulaireClient'

export const metadata: Metadata = { title: 'Nouveau client' }

export default async function PageNouveauClient() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/admin/clients" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Nouveau client</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Enregistrer un nouveau client
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-lg">
                <FormulaireClient />
            </main>
        </div>
    )
}