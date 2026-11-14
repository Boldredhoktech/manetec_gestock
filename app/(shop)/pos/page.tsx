import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { redirect } from 'next/navigation'
import InterfacePOS from '@/components/shop/pos/InterfacePOS'
import { AlertTriangle } from 'lucide-react'
import { jourBoutique } from '@/lib/dates/periode'
import { accesCaisses, MESSAGE_SANS_CAISSE } from '@/lib/caisses/acces'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Caisse — POS' }

export default async function PagePOS() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    // La permission n'etait appliquee qu'a l'enregistrement : un
    // comptable composait un panier entier avant de se le voir refuser.
    if (!aPermission(user, PERMISSIONS.VENTES_CREER)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [
        { data: entrepots },
        { data: boutique },
        { data: sessions },
        acces,
    ] = await Promise.all([
        adminClient.from('warehouses')
            .select('id, nom, est_defaut')
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
        adminClient.from('shops')
            .select('nom, devise, remise_max_pct, plan')
            .eq('id', shopId)
            .single(),
        // La caisse ouverte de chaque entrepôt, et celle d'aujourd'hui
        // même fermée (pour proposer de la rouvrir).
        adminClient.from('cash_sessions')
            .select('id, compte_id, warehouse_id, jour, statut, fermee_le')
            .eq('shop_id', shopId)
            .or(`statut.eq.ouverte,jour.eq.${jourBoutique()}`),
        // (mig 044) les caisses POS que cette personne peut utiliser.
        accesCaisses(adminClient, shopId, user),
    ])

    if (!entrepots || entrepots.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 text-sm max-w-md text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 mx-auto" />
                    <p>Aucun entrepôt actif. Créez un entrepôt avant d'utiliser la caisse.</p>
                </div>
            </div>
        )
    }

    // Pas de caisse : pas de vente au POS (décision du 14/11).
    if (acces.caisses.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="bg-card border border-border rounded-2xl p-6 text-sm max-w-md text-center space-y-3">
                    <AlertTriangle className="w-8 h-8 mx-auto text-accent-foreground" />
                    <p className="font-semibold text-foreground">Aucune caisse disponible</p>
                    <p className="text-muted-foreground">
                        {acces.peutChoisir
                            ? 'La boutique n’a aucune caisse POS active. Créez-en une dans Trésorerie.'
                            : MESSAGE_SANS_CAISSE}
                    </p>
                    <Link href="/admin/dashboard" className="inline-block text-sm font-semibold text-[var(--primary-strong)] hover:underline">
                        Retour au tableau de bord
                    </Link>
                </div>
            </div>
        )
    }

    // Sa caisse ; à défaut (administrateur), la caisse de l'entrepôt par
    // défaut, sinon la première.
    const entrepotDefaut = entrepots.find(e => e.est_defaut) ?? entrepots[0]
    const caisseInitiale = acces.caisses.find(c => c.id === acces.maCaisseId)
        ?? acces.caisses.find(c => c.warehouse_id === entrepotDefaut.id)
        ?? acces.caisses[0]

    return (
        <InterfacePOS
            shopId={shopId}
            vendeurId={user.user_metadata.user_id}
            vendeurNom={user.user_metadata.nom_complet}
            boutique={boutique!}
            entrepots={entrepots}
            caisses={acces.caisses}
            caisseInitialeId={caisseInitiale.id}
            peutAutresEntrepots={aPermission(user, PERMISSIONS.POS_AUTRES_ENTREPOTS)}
            peutCreerClient={aPermission(user, PERMISSIONS.CLIENTS_CREER)}
            sessionsCaisse={sessions ?? []}
            jourCaisse={jourBoutique()}
            peutFermerCaisse={aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)}
        />
    )
}