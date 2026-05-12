import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireAgent from '@/components/redhok/FormulaireAgent'

export const metadata: Metadata = { title: 'Nouvel agent' }

export default async function PageNouvelAgent() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== 'super_platform_admin') {
        redirect('/redhok/agents')
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/redhok/agents"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Nouvel agent
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Ajouter un membre à l'équipe Manetec Inter BJ
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-6 max-w-lg">
                <FormulaireAgent />
            </main>
        </div>
    )
}