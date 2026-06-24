import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireUtilisateur from '@/components/shop/FormulaireUtilisateur'
import { ROLES } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Nouvel utilisateur' }

export default async function PageNouvelUtilisateur() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) {
        redirect('/admin/utilisateurs')
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/utilisateurs"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Nouvel utilisateur
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Créer un compte pour un membre de votre équipe
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-xl">
                <FormulaireUtilisateur />
            </main>
        </div>
    )
}