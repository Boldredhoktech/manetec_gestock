// app/(shop)/admin/import/page.tsx
// Imports Excel (mig 042) : produits et stock d'ouverture, clients et
// créances, fournisseurs et dettes.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import AssistantImport from '@/components/shop/import/AssistantImport'
import HistoriqueImports, { type ImportPasse } from '@/components/shop/import/HistoriqueImports'

export const metadata: Metadata = { title: 'Import de données' }

export default async function PageImport() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.IMPORTER_DONNEES)) redirect('/admin/dashboard')

    const shopId = user.user_metadata.shop_id as string
    const admin = createAdminClient()
    const [{ data: boutique }, { data: imports }] = await Promise.all([
        admin.from('shops').select('date_demarrage').eq('id', shopId).single(),
        admin.from('imports_donnees')
            .select('id, public_id, type, nom_fichier, date_demarrage, nb_lignes, nb_importees, nb_rejetees, statut, motif_annulation, created_at')
            .eq('shop_id', shopId).order('created_at', { ascending: false }).limit(30),
    ])

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Import de données</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Reprenez vos produits, clients et fournisseurs avec leurs soldes de départ, sans tout ressaisir.
                </p>
            </header>
            <main className="flex-1 p-4 sm:p-6 space-y-6">
                <AssistantImport dateDemarrage={boutique?.date_demarrage ?? null} />
                <section aria-labelledby="historique" className="bg-card border border-border rounded-xl">
                    <h2 id="historique" className="p-4 border-b border-border font-semibold">Imports précédents</h2>
                    <HistoriqueImports imports={(imports ?? []) as ImportPasse[]} peutAnnuler />
                </section>
            </main>
        </div>
    )
}
