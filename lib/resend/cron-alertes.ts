import { createAdminClient } from '@/lib/supabase/admin'
import {
    envoyerAlerteAbonnement,
    envoyerAlerteStock,
} from '@/lib/resend/notifications'
import { format } from 'date-fns'
import { fr }     from 'date-fns/locale'

// ── Vérifier les abonnements expirant bientôt (J-7 et expirés)
export async function verifierAbonnements() {
    const adminClient = createAdminClient()
    const maintenant  = new Date()
    const dans7jours  = new Date(Date.now() + 7 * 86400000)

    // Boutiques expirant dans 7 jours
    const { data: bientotExpires } = await adminClient
        .from('shops')
        .select('id, nom, email, plan, plan_expire_le')
        .eq('est_active', true)
        .not('email', 'is', null)
        .lte('plan_expire_le', dans7jours.toISOString())
        .gte('plan_expire_le', maintenant.toISOString())

    for (const boutique of bientotExpires ?? []) {
        const expiration = new Date(boutique.plan_expire_le!)
        const joursRestants = Math.ceil(
            (expiration.getTime() - maintenant.getTime()) / 86400000
        )

        // Récupérer le nom du SuperAdmin
        const { data: admin } = await adminClient
            .from('shop_users')
            .select('nom_complet')
            .eq('shop_id', boutique.id)
            .eq('role', 'super_admin_boutique')
            .single()

        await envoyerAlerteAbonnement({
            emailDestinataire: boutique.email!,
            nomBoutique:       boutique.nom,
            nomProprietaire:   admin?.nom_complet ?? 'Propriétaire',
            plan:              boutique.plan,
            dateExpiration:    format(expiration, 'dd/MM/yyyy', { locale: fr }),
            joursRestants,
            estExpire:         false,
        })
    }

    // Boutiques expirées
    const { data: expireesActives } = await adminClient
        .from('shops')
        .select('id, nom, email, plan, plan_expire_le')
        .eq('est_active', true)
        .not('email', 'is', null)
        .lt('plan_expire_le', maintenant.toISOString())

    for (const boutique of expireesActives ?? []) {
        const { data: admin } = await adminClient
            .from('shop_users')
            .select('nom_complet')
            .eq('shop_id', boutique.id)
            .eq('role', 'super_admin_boutique')
            .single()

        await envoyerAlerteAbonnement({
            emailDestinataire: boutique.email!,
            nomBoutique:       boutique.nom,
            nomProprietaire:   admin?.nom_complet ?? 'Propriétaire',
            plan:              boutique.plan,
            dateExpiration:    format(new Date(boutique.plan_expire_le!), 'dd/MM/yyyy', { locale: fr }),
            joursRestants:     0,
            estExpire:         true,
        })
    }

    return {
        bientotExpires:  bientotExpires?.length ?? 0,
        expireesActives: expireesActives?.length ?? 0,
    }
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