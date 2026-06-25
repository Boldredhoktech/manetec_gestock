'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import * as argon2 from 'argon2'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

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

    // Créer une session Supabase Auth
    const supabase = await createClient()
    const emailVirtuel = `platform_${admin.id}@internal.manetec.app`

    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailVirtuel,
        password: admin.id, // clé interne non exposée
    })

    if (signInError) {
        // Créer le compte auth si première connexion
        await adminClient.auth.admin.createUser({
            email: emailVirtuel,
            password: admin.id,
            user_metadata: {
                type_acteur: 'platform',
                role: admin.role,
                admin_id: admin.id,
                nom_complet: admin.nom_complet,
            },
            email_confirm: true,
        })

        await supabase.auth.signInWithPassword({
            email: emailVirtuel,
            password: admin.id,
        })
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
        .select('id, est_active, plan, plan_expire_le')
        .eq('public_id', shopPublicId.toUpperCase().trim())
        .single()

    if (!shop) {
        return { erreur: 'Boutique introuvable.' }
    }

    if (!shop.est_active) {
        return { erreur: 'Cette boutique est désactivée.' }
    }

    // Vérifier l'expiration de l'abonnement / licence
    if (shop.plan_expire_le && new Date(shop.plan_expire_le) < new Date()) {
        return { erreur: 'L\'abonnement de cette boutique a expiré. Contactez Manetec Inter BJ pour le renouveler.' }
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
    const supabase = await createClient()
    const emailVirtuel = `shop_${utilisateur.id}@internal.manetec.app`

    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailVirtuel,
        password: utilisateur.id,
    })

    if (signInError) {
        await adminClient.auth.admin.createUser({
            email: emailVirtuel,
            password: utilisateur.id,
            user_metadata: {
                type_acteur: 'shop',
                role: utilisateur.role,
                user_id: utilisateur.id,
                public_id: utilisateur.public_id,
                nom_complet: utilisateur.nom_complet,
                shop_id: shop.id,
                shop_public_id: shopPublicId,
                permissions_etendues: permissionsEtendues,
            },
            email_confirm: true,
        })

        await supabase.auth.signInWithPassword({
            email: emailVirtuel,
            password: utilisateur.id,
        })
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
        vendeur: '/pos',
        stock_manager: '/stock',
        comptable: '/compta',
    }

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