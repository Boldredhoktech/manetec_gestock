import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CarteInfosBoutique from '@/components/redhok/CarteInfosBoutique'
import CarteAbonnement from '@/components/redhok/CarteAbonnement'
import CarteActivationBoutique from '@/components/redhok/CarteActivationBoutique'

export const metadata: Metadata = { title: 'Détail boutique' }

interface Props {
    params: Promise<{ id: string }>
}

export default async function PageDetailBoutique({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') {
        redirect('/redhok/login')
    }

    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops')
        .select('*')
        .eq('id', id)
        .single()

    if (!boutique) notFound()

    const { count: nbUtilisateurs } = await adminClient
        .from('shop_users')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', id)

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/redhok/boutiques"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            {boutique.nom}
                        </h1>
                        <p className="text-sm text-muted-foreground font-mono mt-0.5">
                            {boutique.public_id}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-4xl">
                <CarteInfosBoutique
                    boutique={boutique}
                    nbUtilisateurs={nbUtilisateurs ?? 0}
                />
                <CarteAbonnement boutique={boutique} />
                <CarteActivationBoutique boutique={boutique} />
            </main>
        </div>
    )
}