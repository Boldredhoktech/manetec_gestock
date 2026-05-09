// app/(shop)/admin/clients/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CarteDetailClient from '@/components/shop/CarteDetailClient'
import CarteSoldesClient from '@/components/shop/CarteSoldesClient'
import CarteHistoriqueClient from '@/components/shop/CarteHistoriqueClient'

export const metadata: Metadata = { title: 'Fiche client' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailClient({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()

    const { data: client } = await adminClient
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('shop_id', user.user_metadata.shop_id)
        .single()

    if (!client) notFound()

    const { data: operations } = await adminClient
        .from('client_balance_operations')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/admin/clients" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{client.nom}</h1>
                        <p className="text-sm font-mono text-muted-foreground mt-0.5">
                            {client.public_id}
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-6 max-w-4xl space-y-5">
                <CarteDetailClient client={client} />
                <CarteSoldesClient client={client} />
                <CarteHistoriqueClient operations={operations ?? []} />
            </main>
        </div>
    )
}