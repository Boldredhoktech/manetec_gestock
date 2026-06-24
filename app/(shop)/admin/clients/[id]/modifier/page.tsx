import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FormulaireModifierClient from '@/components/shop/clients/FormulaireModifierClient'

export const metadata: Metadata = { title: 'Modifier le client' }

interface Props { params: Promise<{ id: string }> }

export default async function PageModifierClient({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const adminClient = createAdminClient()
    const { data: client } = await adminClient
        .from('clients').select('*')
        .eq('id', id)
        .eq('shop_id', user.user_metadata.shop_id)
        .single()

    if (!client) notFound()

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">
            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <Link href={`/admin/clients/${id}`}
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">Modifier le client</h1>
                        <p className="text-sm text-white/70 mt-0.5">{client.nom}</p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-2xl">
                <FormulaireModifierClient client={client} />
            </main>
        </div>
    )
}