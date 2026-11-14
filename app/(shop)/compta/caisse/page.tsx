// app/(shop)/compta/caisse/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { redirect } from 'next/navigation'
import GestionCaisse from '@/components/shop/compta/GestionCaisse'
import EnTetePage from '@/components/shop/EnTetePage'
import { accesCaisses } from '@/lib/caisses/acces'

export const metadata: Metadata = { title: 'Caisse' }

// Une session par journée et par CAISSE POS (mig 044 ; avant : par
// entrepôt). À la fermeture, versement proposé vers la caisse principale.
export default async function PageCaisse() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [acces, { data: sessions }, { data: boutique }] = await Promise.all([
        accesCaisses(adminClient, shopId, user),
        adminClient.from('cash_sessions')
            .select(`
                id, public_id, jour, statut, fond_initial,
                compte_especes, attendu_especes, ecart,
                note_ouverture, note_fermeture, ouverte_le, fermee_le, compte_id,
                caisse:comptes_tresorerie(nom), warehouses(nom)
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
            <EnTetePage
                titre="Caisses du jour"
                sousTitre="Ouverture, comptage et écart de chaque caisse POS ; versement vers la caisse principale."
                ariane={[{ label: 'Finances' }, { label: 'Caisse' }]}
            />
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
                <GestionCaisse
                    caisses={acces.caisses}
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
