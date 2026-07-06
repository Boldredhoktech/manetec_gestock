'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import * as argon2 from 'argon2'
import {
    ROLES,
    PERMISSIONS_PAR_DEFAUT,
    EXTENSIONS_VENDEUR,
    estAdminComplet,
} from '@/lib/constants/permissions'
import { getPlanLimites } from '@/lib/constants/plans'

// Rôles qu'un administrateur (non-propriétaire) peut créer et gérer.
const ROLES_STANDARDS = [ROLES.VENDEUR, ROLES.STOCK_MANAGER, ROLES.COMPTABLE] as const

// ── Créer un utilisateur boutique ─────────────────────────────
export async function creerUtilisateur(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const roleActeur = user.user_metadata?.role as string
    if (!estAdminComplet(roleActeur)) {
        return { erreur: 'Réservé aux administrateurs de la boutique.' }
    }

    const estProprietaire = roleActeur === ROLES.SUPER_ADMIN_BOUTIQUE

    const shopId    = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // Récupérer le plan directement depuis la base (source de vérité)
    const { data: boutique } = await adminClient
        .from('shops')
        .select('plan')
        .eq('id', shopId)
        .single()

    const limites = getPlanLimites(boutique?.plan)

    if (limites.max_utilisateurs !== -1) {
        const { count } = await adminClient
            .from('shop_users')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .eq('est_actif', true)

        if ((count ?? 0) >= limites.max_utilisateurs) {
            return {
                erreur: `Votre plan ${boutique?.plan ?? 'actuel'} est limité à ${limites.max_utilisateurs} utilisateur(s). Passez au plan supérieur.`,
            }
        }
    }

    const nomComplet  = (formData.get('nomComplet') as string)?.trim()
    const identifiant = (formData.get('identifiant') as string)?.trim().toLowerCase()
    const motDePasse  = formData.get('motDePasse') as string
    const role        = formData.get('role') as string
    const permissionsEtendues = formData.getAll('permissions') as string[]

    if (!nomComplet || !identifiant || !motDePasse || !role) {
        return { erreur: 'Tous les champs obligatoires doivent être remplis.' }
    }

    // Rôles autorisés à la création. Seul le propriétaire peut créer un
    // administrateur ; personne ne crée un second propriétaire.
    const rolesAutorises: string[] = estProprietaire
        ? [...ROLES_STANDARDS, ROLES.ADMIN_BOUTIQUE]
        : [...ROLES_STANDARDS]

    if (!rolesAutorises.includes(role)) {
        return {
            erreur: role === ROLES.ADMIN_BOUTIQUE || role === ROLES.SUPER_ADMIN_BOUTIQUE
                ? 'Seul le propriétaire de la boutique peut créer un administrateur.'
                : 'Rôle invalide.',
        }
    }

    if (motDePasse.length < 6) {
        return { erreur: 'Le mot de passe doit contenir au moins 6 caractères.' }
    }

    const { data: existant } = await adminClient
        .from('shop_users')
        .select('id')
        .eq('shop_id', shopId)
        .eq('identifiant', identifiant)
        .single()

    if (existant) {
        return { erreur: 'Cet identifiant est déjà utilisé dans cette boutique.' }
    }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'UTS' })

    if (!publicId) {
        return { erreur: 'Erreur lors de la génération de l\'identifiant.' }
    }

    const passwordHash = await argon2.hash(motDePasse, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
    })

    const { data: nouvelUser, error } = await adminClient
        .from('shop_users')
        .insert({
            public_id:     publicId,
            shop_id:       shopId,
            nom_complet:   nomComplet,
            identifiant,
            password_hash: passwordHash,
            role,
            est_actif:     true,
            created_by:    user.user_metadata.user_id,
        })
        .select()
        .single()

    if (error || !nouvelUser) {
        return { erreur: 'Erreur lors de la création de l\'utilisateur.' }
    }

    const permissionsDefaut = PERMISSIONS_PAR_DEFAUT[role as keyof typeof PERMISSIONS_PAR_DEFAUT] ?? []

    const toutesPermissions = role === ROLES.VENDEUR
        ? [
            ...permissionsDefaut,
            ...permissionsEtendues.filter(p => EXTENSIONS_VENDEUR.includes(p)),
        ]
        : permissionsDefaut

    if (toutesPermissions.length > 0) {
        await adminClient.from('shop_user_permissions').insert(
            toutesPermissions.map(permission => ({
                shop_id:     shopId,
                user_id:     nouvelUser.id,
                permission,
                accorde_par: user.user_metadata.user_id,
            }))
        )
    }

    await adminClient.from('audit_logs').insert({
        shop_id:             shopId,
        user_id:             user.user_metadata.user_id,
        user_public_id:      user.user_metadata.public_id,
        user_nom:            user.user_metadata.nom_complet,
        type_acteur:         'shop',
        event_type:          'USER_CREATED',
        reference_type:      'shop_user',
        reference_id:        nouvelUser.id,
        reference_public_id: nouvelUser.public_id,
        details_json:        { role, identifiant },
    })

    revalidatePath('/admin/utilisateurs')
    redirect('/admin/utilisateurs')
}

// ── Modifier les permissions d'un vendeur ─────────────────────
export async function modifierPermissionsVendeur(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !estAdminComplet(user.user_metadata?.role)) {
        return { erreur: 'Non autorisé.' }
    }

    const shopId      = user.user_metadata.shop_id as string
    const userId      = formData.get('userId') as string
    const permissions = formData.getAll('permissions') as string[]
    const adminClient = createAdminClient()

    // La cible doit appartenir à la même boutique et ne pas être un admin/propriétaire.
    const { data: cible } = await adminClient
        .from('shop_users')
        .select('role')
        .eq('id', userId)
        .eq('shop_id', shopId)
        .single()

    if (!cible) return { erreur: 'Utilisateur introuvable.' }
    if (estAdminComplet(cible.role)) {
        return { erreur: 'Impossible de modifier les permissions d\'un administrateur.' }
    }

    await adminClient
        .from('shop_user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('shop_id', shopId)
        .in('permission', EXTENSIONS_VENDEUR)

    if (permissions.length > 0) {
        await adminClient.from('shop_user_permissions').insert(
            permissions
                .filter(p => EXTENSIONS_VENDEUR.includes(p))
                .map(permission => ({
                    shop_id:     shopId,
                    user_id:     userId,
                    permission,
                    accorde_par: user.user_metadata.user_id,
                }))
        )
    }

    revalidatePath('/admin/utilisateurs')
    return { succes: true }
}

// ── Activer / Désactiver un utilisateur ───────────────────────
export async function toggleActivationUtilisateur(
    userId: string,
    estActif: boolean
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !estAdminComplet(user.user_metadata?.role)) {
        return { erreur: 'Non autorisé.' }
    }

    const shopId          = user.user_metadata.shop_id as string
    const estProprietaire = user.user_metadata.role === ROLES.SUPER_ADMIN_BOUTIQUE
    const adminClient     = createAdminClient()

    const { data: cible } = await adminClient
        .from('shop_users')
        .select('role')
        .eq('id', userId)
        .eq('shop_id', shopId)
        .single()

    if (!cible) return { erreur: 'Utilisateur introuvable.' }
    if (cible.role === ROLES.SUPER_ADMIN_BOUTIQUE) {
        return { erreur: 'Le compte propriétaire ne peut pas être désactivé.' }
    }
    if (cible.role === ROLES.ADMIN_BOUTIQUE && !estProprietaire) {
        return { erreur: 'Seul le propriétaire peut gérer un administrateur.' }
    }

    await adminClient
        .from('shop_users')
        .update({
            est_actif:    estActif,
            desactive_le: estActif ? null : new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('shop_id', shopId)

    revalidatePath('/admin/utilisateurs')
    return { succes: true }
}

// ── Débloquer un utilisateur ──────────────────────────────────
export async function debloquerUtilisateur(userId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !estAdminComplet(user.user_metadata?.role)) {
        return { erreur: 'Non autorisé.' }
    }

    const shopId          = user.user_metadata.shop_id as string
    const estProprietaire = user.user_metadata.role === ROLES.SUPER_ADMIN_BOUTIQUE
    const adminClient     = createAdminClient()

    const { data: cible } = await adminClient
        .from('shop_users')
        .select('role')
        .eq('id', userId)
        .eq('shop_id', shopId)
        .single()

    if (!cible) return { erreur: 'Utilisateur introuvable.' }
    if (cible.role === ROLES.ADMIN_BOUTIQUE && !estProprietaire) {
        return { erreur: 'Seul le propriétaire peut gérer un administrateur.' }
    }

    await adminClient
        .from('shop_users')
        .update({
            est_bloque:        false,
            tentatives_echecs: 0,
            bloque_le:         null,
        })
        .eq('id', userId)
        .eq('shop_id', shopId)

    await adminClient.from('audit_logs').insert({
        shop_id:        user.user_metadata.shop_id,
        user_id:        user.user_metadata.user_id,
        user_nom:       user.user_metadata.nom_complet,
        type_acteur:    'shop',
        event_type:     'USER_UNBLOCKED',
        reference_type: 'shop_user',
        details_json:   { user_id: userId },
    })

    revalidatePath('/admin/utilisateurs')
    return { succes: true }
}

// ── Mettre à jour les permissions d'un utilisateur ──────────────
export async function mettreAJourPermissions(
    userId:      string,
    shopId:      string,
    permissions: string[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !estAdminComplet(user.user_metadata?.role)) {
        return { erreur: 'Réservé aux administrateurs.' }
    }

    // La cible doit appartenir à la boutique de l'acteur.
    if (shopId !== user.user_metadata.shop_id) {
        return { erreur: 'Non autorisé.' }
    }

    const adminClient = createAdminClient()

    // Interdiction de modifier les permissions d'un admin/propriétaire (ils ont tout).
    const { data: cible } = await adminClient
        .from('shop_users')
        .select('role')
        .eq('id', userId)
        .eq('shop_id', shopId)
        .single()

    if (!cible) return { erreur: 'Utilisateur introuvable.' }
    if (estAdminComplet(cible.role)) {
        return { erreur: 'Impossible de modifier les permissions d\'un administrateur.' }
    }

    // Supprimer toutes les permissions existantes
    await adminClient
        .from('shop_user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('shop_id', shopId)

    // Réinsérer les nouvelles
    if (permissions.length > 0) {
        const { error } = await adminClient
            .from('shop_user_permissions')
            .insert(permissions.map(p => ({
                user_id:     userId,
                shop_id:     shopId,
                permission:  p,
                accorde_par: user.user_metadata.user_id,
            })))

        if (error) return { erreur: 'Erreur lors de la mise à jour.' }
    }

    revalidatePath(`/admin/utilisateurs/${userId}`)
    return { succes: true }
}

// ── Changer son propre mot de passe ───────────────────────────
export async function changerMotDePasse(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const userId            = formData.get('userId') as string
    const motDePasseActuel  = formData.get('motDePasseActuel') as string
    const nouveauMotDePasse = formData.get('nouveauMotDePasse') as string

    // Vérifier que l'utilisateur ne change que son propre mot de passe
    if (userId !== user.user_metadata.user_id) {
        return { erreur: 'Vous ne pouvez changer que votre propre mot de passe.' }
    }

    if (!motDePasseActuel || !nouveauMotDePasse) {
        return { erreur: 'Tous les champs sont obligatoires.' }
    }

    if (nouveauMotDePasse.length < 6) {
        return { erreur: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' }
    }

    const adminClient = createAdminClient()

    // Récupérer le hash actuel
    const { data: utilisateur } = await adminClient
        .from('shop_users')
        .select('password_hash')
        .eq('id', userId)
        .single()

    if (!utilisateur) return { erreur: 'Utilisateur introuvable.' }

    // Vérifier le mot de passe actuel
    let motDePasseValide = false
    try {
        motDePasseValide = await argon2.verify(utilisateur.password_hash, motDePasseActuel)
    } catch {
        return { erreur: 'Erreur lors de la vérification du mot de passe actuel.' }
    }

    if (!motDePasseValide) {
        return { erreur: 'Le mot de passe actuel est incorrect.' }
    }

    // Hasher le nouveau mot de passe
    let nouveauHash: string
    try {
        nouveauHash = await argon2.hash(nouveauMotDePasse, {
            type:        argon2.argon2id,
            memoryCost:  65536,
            timeCost:    3,
            parallelism: 1,
        })
    } catch {
        return { erreur: 'Erreur lors du hashage du nouveau mot de passe.' }
    }

    // Mettre à jour en base
    const { error } = await adminClient
        .from('shop_users')
        .update({ password_hash: nouveauHash })
        .eq('id', userId)

    if (error) return { erreur: 'Erreur lors de la mise à jour du mot de passe.' }

    revalidatePath('/admin/profil')
    return { succes: true }
}

// ── Modifier son nom complet ───────────────────────────────────
export async function modifierNomComplet(userId: string, nomComplet: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    // Un utilisateur peut modifier son propre nom. Un administrateur peut aussi
    // modifier le nom des comptes standards, mais pas celui d'un autre
    // admin/propriétaire (réservé au propriétaire).
    const shopId          = user.user_metadata.shop_id as string
    const estProprietaire = user.user_metadata.role === ROLES.SUPER_ADMIN_BOUTIQUE
    const estAdmin        = estAdminComplet(user.user_metadata.role)
    const estSonPropre    = userId === user.user_metadata.user_id

    if (!estSonPropre && !estAdmin) {
        return { erreur: 'Vous ne pouvez modifier que votre propre nom.' }
    }

    const nom = nomComplet.trim()
    if (!nom) return { erreur: 'Le nom ne peut pas être vide.' }

    const adminClient = createAdminClient()

    // Si l'acteur agit sur un autre compte, vérifier la cible.
    if (!estSonPropre) {
        const { data: cible } = await adminClient
            .from('shop_users')
            .select('role')
            .eq('id', userId)
            .eq('shop_id', shopId)
            .single()

        if (!cible) return { erreur: 'Utilisateur introuvable.' }
        if (estAdminComplet(cible.role) && !estProprietaire) {
            return { erreur: 'Seul le propriétaire peut modifier un administrateur.' }
        }
    }

    const { error } = await adminClient
        .from('shop_users')
        .update({ nom_complet: nom })
        .eq('id', userId)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors de la mise à jour du nom.' }

    revalidatePath('/admin/profil')
    revalidatePath(`/admin/utilisateurs/${userId}`)
    return { succes: true }
}