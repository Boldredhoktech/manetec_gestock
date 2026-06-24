import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireFournisseur from '@/components/shop/fournisseurs/FormulaireFournisseur'

export const metadata: Metadata = { title: 'Nouveau fournisseur' }

export default async function PageNouveauFournisseur() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/stock/fournisseurs" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-foreground">Nouveau fournisseur</h1>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-lg">
                <FormulaireFournisseur />
            </main>
        </div>
    )
}