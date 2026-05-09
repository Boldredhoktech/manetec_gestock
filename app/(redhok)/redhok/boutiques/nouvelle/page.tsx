import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireBoutique from '@/components/redhok/FormulaireBoutique'

export const metadata: Metadata = { title: 'Nouvelle boutique' }

export default async function PageNouvelleBoutique() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') {
        redirect('/redhok/login')
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/redhok/boutiques"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Nouvelle boutique
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Créer et enregistrer une boutique sur la plateforme
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-6 max-w-2xl">
                <FormulaireBoutique />
            </main>
        </div>
    )
}