import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FicheEmploye from '@/components/shop/compta/FicheEmploye'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { historiqueCorrections } from '@/lib/audit/journaliser'

export const metadata: Metadata = { title: 'Employé' }

export default async function PageEmploye({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.SALAIRES_GERER)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: employe } = await adminClient
        .from('employees')
        .select('id, nom_complet, poste, salaire_base, telephone, date_embauche, est_actif, desactive_le, created_at')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!employe) notFound()

    const [{ data: versements }, historique] = await Promise.all([
        adminClient
            .from('salary_payments')
            .select('id, public_id, periode_mois, periode_annee, montant_net, date_paiement, est_annule')
            .eq('shop_id', shopId)
            .eq('employee_id', id)
            .order('date_paiement', { ascending: false })
            .limit(24),
        historiqueCorrections(shopId, id),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/compta/salaires" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{employe.nom_complet}</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {employe.poste ?? 'Poste non renseigné'}
                        </p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-2xl">
                <FicheEmploye
                    employe={employe}
                    versements={versements ?? []}
                    historique={historique}
                />
            </main>
        </div>
    )
}
