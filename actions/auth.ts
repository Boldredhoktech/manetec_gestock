'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import * as argon2 from 'argon2'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ouvrirSessionAuth } from '@/lib/auth/session-auth'
import { etatAbonnement, peutEntrerBoutiqueExpiree, CHEMIN_ABONNEMENT, MESSAGES_ABONNEMENT } from '@/lib/abonnement/etat'

// ── Connexion Platform Admin (Bold Redhok Tech) ────────────────
export async function connexionPlateforme(formData: FormData) {
    const email = formData.get('email') as string
    const motDePasse = formData.get('motDePasse') as string

    if (!email || !motDePasse) {
        return { erreur: 'Email et mot de passe requis.' }
    }

    const adminClient = createAdminClient()

    // Récupérer l'admin plateforme
    const { data: admin, error } = await adminClient
        .from('platform_admins')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single()

    if (error || !admin) {
        return { erreur: 'Identifiants incorrects.' }
    }

    // Vérifier si le compte est bloqué
    if (admin.est_bloque) {
        return { erreur: 'Ce compte est bloqué. Contactez le Super Admin.' }
    }

    if (!admin.est_actif) {
        return { erreur: 'Ce compte est désactivé.' }
    }

    // Vérifier le mot de passe avec Argon2
    let motDePasseValide = false
    try {
        motDePasseValide = await argon2.verify(admin.password_hash, motDePasse)
    } catch {
        return { erreur: 'Erreur lors de la vérification du mot de passe.' }
    }

    if (!motDePasseValide) {
        // Incrémenter les tentatives
        const nouvellesTentatives = admin.tentatives_echecs + 1
        const doitBloquer = nouvellesTentatives >= 3

        await adminClient
            .from('platform_admins')
            .update({
                tentatives_echecs: nouvellesTentatives,
                est_bloque: doitBloquer,
                bloque_le: doitBloquer ? new Date().toISOString() : null,
            })
            .eq('id', admin.id)

        if (doitBloquer) {
            return { erreur: 'Compte bloqué après 3 tentatives échouées.' }
        }

        const restantes = 3 - nouvellesTentatives
        return { erreur: `Mot de passe incorrect. ${restantes} tentative(s) restante(s).` }
    }

    // Réinitialiser les tentatives
    await adminClient
        .from('platform_admins')
        .update({ tentatives_echecs: 0 })
        .eq('id', admin.id)

    // Ouvrir la session Supabase Auth (voir lib/auth/session-auth.ts :
    // plus aucun mot de passe Auth dérivé de l'identifiant).
    const session = await ouvrirSessionAuth(`platform_${admin.id}@internal.manetec.app`, {
        type_acteur: 'platform',
        role:        admin.role,
        admin_id:    admin.id,
        nom_complet: admin.nom_complet,
    })

    if (session.erreur) {
        return { erreur: session.erreur }
    }

    // Journaliser la connexion
    await adminClient.from('audit_logs').insert({
        user_id: admin.id,
        user_public_id: admin.public_id,
        user_nom: admin.nom_complet,
        type_acteur: 'platform',
        event_type: 'AUTH_LOGIN_SUCCESS',
        details_json: { role: admin.role },
    })

    revalidatePath('/redhok')
    redirect('/redhok/dashboard')
}

// ── Connexion Utilisateur Boutique ─────────────────────────────
export async function connexionBoutique(formData: FormData) {
    const identifiant = formData.get('identifiant') as string
    const motDePasse = formData.get('motDePasse') as string
    const shopPublicId = formData.get('shopPublicId') as string

    if (!identifiant || !motDePasse || !shopPublicId) {
        return { erreur: 'Tous les champs sont requis.' }
    }

    const adminClient = createAdminClient()

    // Trouver la boutique
    const { data: shop } = await adminClient
        .from('shops')
        .select('id, nom, est_active, plan, plan_expire_le')
        .eq('public_id', shopPublicId.toUpperCase().trim())
        .single()

    if (!shop) {
        return { erreur: 'Boutique introuvable.' }
    }

    if (!shop.est_active) {
        return { erreur: 'Cette boutique est désactivée.' }
    }

    // Trouver l'utilisateur dans cette boutique
    const { data: utilisateur } = await adminClient
        .from('shop_users')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('identifiant', identifiant.trim())
        .single()

    if (!utilisateur) {
        return { erreur: 'Identifiant ou mot de passe incorrect.' }
    }

    if (utilisateur.est_bloque) {
        return { erreur: 'Compte bloqué. Contactez votre SuperAdmin.' }
    }

    if (!utilisateur.est_actif) {
        return { erreur: 'Ce compte est désactivé.' }
    }

    // Vérifier le mot de passe
    let motDePasseValide = false
    try {
        motDePasseValide = await argon2.verify(utilisateur.password_hash, motDePasse)
    } catch {
        return { erreur: 'Erreur lors de la vérification.' }
    }

    if (!motDePasseValide) {
        const nouvellesTentatives = utilisateur.tentatives_echecs + 1
        const doitBloquer = nouvellesTentatives >= 3

        await adminClient
            .from('shop_users')
            .update({
                tentatives_echecs: nouvellesTentatives,
                est_bloque: doitBloquer,
                bloque_le: doitBloquer ? new Date().toISOString() : null,
            })
            .eq('id', utilisateur.id)

        if (doitBloquer) {
            return { erreur: 'Compte bloqué après 3 tentatives échouées.' }
        }

        const restantes = 3 - nouvellesTentatives
        return { erreur: `Mot de passe incorrect. ${restantes} tentative(s) restante(s).` }
    }

    // Licence (D3). Contrôlée APRÈS le mot de passe : avant, le message
    // aurait révélé à n'importe qui l'existence d'un identifiant.
    // Une boutique expirée ne laisse entrer que son administrateur, et
    // seulement jusqu'à la page Abonnement (le middleware l'y retient).
    const etat = etatAbonnement(shop)
    if (etat === 'desactive') {
        return { erreur: MESSAGES_ABONNEMENT.desactive }
    }
    if (etat === 'expire' && !peutEntrerBoutiqueExpiree(utilisateur.role)) {
        return { erreur: MESSAGES_ABONNEMENT.expire }
    }

    // Réinitialiser les tentatives
    await adminClient
        .from('shop_users')
        .update({ tentatives_echecs: 0 })
        .eq('id', utilisateur.id)

    // Récupérer les permissions étendues
    const { data: permissions } = await adminClient
        .from('shop_user_permissions')
        .select('permission')
        .eq('user_id', utilisateur.id)

    const permissionsEtendues = permissions?.map(p => p.permission) ?? []

    // Créer session Supabase Auth
    //
    // Le JWT porte le rôle et les permissions étendues, et c'est lui que
    // lisent `aPermission` (serveur) et `usePermission` (client). Les
    // métadonnées sont réécrites à chaque connexion, avant l'émission du
    // jeton, pour qu'il reflète la base (FIN-25) — voir ouvrirSessionAuth.
    const metadonnees = {
        type_acteur:          'shop',
        role:                 utilisateur.role,
        user_id:              utilisateur.id,
        public_id:            utilisateur.public_id,
        nom_complet:          utilisateur.nom_complet,
        shop_id:              shop.id,
        shop_public_id:       shopPublicId,
        shop_nom:             shop.nom,
        shop_plan:            shop.plan,
        permissions_etendues: permissionsEtendues,
    }

    const session = await ouvrirSessionAuth(`shop_${utilisateur.id}@internal.manetec.app`, metadonnees)
    if (session.erreur) {
        return { erreur: session.erreur }
    }

    // Journaliser
    await adminClient.from('audit_logs').insert({
        shop_id: shop.id,
        user_id: utilisateur.id,
        user_public_id: utilisateur.public_id,
        user_nom: utilisateur.nom_complet,
        type_acteur: 'shop',
        event_type: 'AUTH_LOGIN_SUCCESS',
        details_json: { role: utilisateur.role },
    })

    revalidatePath('/admin')

    // Redirection selon le rôle
    const redirections: Record<string, string> = {
        super_admin_boutique: '/admin/dashboard',
        admin_boutique: '/admin/dashboard',
        vendeur: '/pos',
        stock_manager: '/stock',
        comptable: '/compta',
    }

    // Boutique expirée : l'administrateur n'a plus que la page de paiement.
    if (etat === 'expire') redirect(CHEMIN_ABONNEMENT)

    redirect(redirections[utilisateur.role] ?? '/admin/dashboard')
}

// ── Déconnexion ────────────────────────────────────────────────
export async function deconnexion(typeActeur: 'platform' | 'shop') {
    const supabase = await createClient()
    await supabase.auth.signOut()

    revalidatePath('/')

    if (typeActeur === 'platform') {
        redirect('/redhok/login')
    } else {
        redirect('/login')
    }
}