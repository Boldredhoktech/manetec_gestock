// app/(shop)/compta/caisse/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { redirect } from 'next/navigation'
import GestionCaisse from '@/components/shop/compta/GestionCaisse'

export const metadata: Metadata = { title: 'Caisse' }

// Décision D1 : une session par journée et par entrepôt — pas par
// caissier. Sans comptage du tiroir, le solde de la ventilation livrée
// au Lot 4 Finances reste théorique.
export default async function PageCaisse() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: entrepots }, { data: sessions }, { data: boutique }] = await Promise.all([
        adminClient.from('warehouses')
            .select('id, nom, est_defaut')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('est_defaut', { ascending: false }),
        adminClient.from('cash_sessions')
            .select(`
                id, public_id, jour, statut, fond_initial,
                compte_especes, attendu_especes, ecart,
                note_ouverture, note_fermeture, ouverte_le, fermee_le,
                warehouses(nom)
            `)
            .eq('shop_id', shopId)
            .order('ouverte_le', { ascending: false })
            .limit(30),
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
    ])

    // Ce que chaque caisse ouverte devrait contenir, calculé en base :
    // fond initial + encaissements espèces − sorties espèces.
    const ouvertes = (sessions ?? []).filter(s => s.statut === 'ouverte')
    const attendus: Record<string, number> = {}

    for (const s of ouvertes) {
        const { data } = await adminClient.rpc('especes_attendues_session', {
            p_session_id: s.id,
        })
        attendus[s.id] = Number(data ?? 0)
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Caisse</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Ouverture, comptage et écart du tiroir
                </p>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <GestionCaisse
                    entrepots={entrepots ?? []}
                    sessions={(sessions ?? []) as never[]}
                    attendus={attendus}
                    devise={boutique?.devise ?? 'FCFA'}
                    peutFermer={aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)}
                    peutOuvrir={aPermission(user, PERMISSIONS.VENTES_CREER)}
                />
            </main>
        </div>
    )
}
