import { createAdminClient } from '@/lib/supabase/admin'
import {
    envoyerAlerteAbonnement,
    envoyerAlerteStock,
} from '@/lib/resend/notifications'
import { format } from 'date-fns'
import { fr }     from 'date-fns/locale'
import { palierAlerte } from '@/lib/abonnement/alertes'

// ── Alertes d'expiration d'abonnement (ABO-10, ABO-11) ───────
// Avant : un e-mail par jour la dernière semaine, puis un e-mail
// « expiré » chaque jour, sans fin — rien n'était mémorisé. (Et en
// pratique aucun ne partait : le cron était refusé, voir la route.)
// Désormais : un palier (J-7, J-1, J0, relances hebdomadaires) n'est
// envoyé qu'une fois par échéance ; un échec d'envoi est retenté le
// lendemain.
export async function verifierAbonnements(maintenant: Date = new Date()) {
    const adminClient = createAdminClient()
    const horizon     = new Date(maintenant.getTime() + 7 * 86400000)

    const { data: boutiques } = await adminClient
        .from('shops')
        .select('id, nom, email, plan, plan_expire_le')
        .eq('est_active', true)
        .not('email', 'is', null)
        .not('plan_expire_le', 'is', null)
        .lte('plan_expire_le', horizon.toISOString())

    const bilan = { envoyees: 0, deja_envoyees: 0, echecs: 0, hors_palier: 0 }

    for (const boutique of boutiques ?? []) {
        const expiration = new Date(boutique.plan_expire_le!)
        const palier     = palierAlerte(expiration, maintenant)
        if (!palier) { bilan.hors_palier++; continue }

        const { data: deja } = await adminClient
            .from('abonnement_alertes')
            .select('succes')
            .eq('shop_id', boutique.id)
            .eq('palier', palier)
            .eq('echeance', boutique.plan_expire_le!)
            .maybeSingle()
        if (deja?.succes) { bilan.deja_envoyees++; continue }

        const { data: admin } = await adminClient
            .from('shop_users')
            .select('nom_complet')
            .eq('shop_id', boutique.id)
            .eq('role', 'super_admin_boutique')
            .limit(1)
            .maybeSingle()

        const estExpire = expiration <= maintenant
        const envoi = await envoyerAlerteAbonnement({
            emailDestinataire: boutique.email!,
            nomBoutique:       boutique.nom,
            nomProprietaire:   admin?.nom_complet ?? 'Propriétaire',
            plan:              boutique.plan,
            dateExpiration:    format(expiration, 'dd/MM/yyyy', { locale: fr }),
            joursRestants:     estExpire ? 0 : Math.ceil((expiration.getTime() - maintenant.getTime()) / 86400000),
            estExpire,
        })

        await adminClient.from('abonnement_alertes').upsert({
            shop_id:   boutique.id,
            palier,
            echeance:  boutique.plan_expire_le!,
            email:     boutique.email!,
            succes:    envoi.succes,
            erreur:    envoi.succes ? null : (envoi.erreur ?? 'inconnue'),
            envoye_le: maintenant.toISOString(),
        }, { onConflict: 'shop_id,palier,echeance' })

        if (envoi.succes) bilan.envoyees++
        else bilan.echecs++
    }

    return bilan
}

// ── Vérifier les stocks critiques par boutique ────────────────
export async function verifierStocksCritiques(shopId: string) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops')
        .select('nom, email')
        .eq('id', shopId)
        .single()

    if (!boutique?.email) return { succes: false, erreur: 'Pas d\'email boutique' }

    const { data: produits } = await adminClient
        .from('products')
        .select(`
      public_id, nom, seuil_alerte, unite,
      stock_levels(quantite, warehouses(nom))
    `)
        .eq('shop_id', shopId)
        .eq('est_actif', true)

    const produitsEnAlerte = (produits ?? []).flatMap(p =>
        ((p.stock_levels as any[]) ?? [])
            .filter((s: any) => s.quantite <= p.seuil_alerte)
            .map((s: any) => ({
                nom:          p.nom,
                public_id:    p.public_id,
                stock:        s.quantite,
                seuil_alerte: p.seuil_alerte,
                unite:        p.unite,
                entrepot:     (s.warehouses as any)?.nom ?? 'Entrepôt',
            }))
    )

    if (produitsEnAlerte.length === 0) return { succes: true, nb: 0 }

    const result = await envoyerAlerteStock({
        emailDestinataire: boutique.email,
        nomBoutique:       boutique.nom,
        produits:          produitsEnAlerte,
    })

    return { ...result, nb: produitsEnAlerte.length }
}