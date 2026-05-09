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
} from '@/lib/constants/permissions'
import { PLAN_LIMITES } from '@/lib/constants/plans'

// ── Créer un utilisateur boutique ─────────────────────────────
export async function creerUtilisateur(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    if (user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) {
        return { erreur: 'Réservé au SuperAdmin boutique.' }
    }

    const shopId    = user.user_metadata.shop_id as string
    const shopPlan  = user.user_metadata.shop_plan as string
    const adminClient = createAdminClient()

    // Vérifier la limite d'utilisateurs selon le plan
    const limites = PLAN_LIMITES[shopPlan as keyof typeof PLAN_LIMITES]
    if (limites.utilisateurs_max !== -1) {
        const { count } = await adminClient
            .from('shop_users')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .eq('est_actif', true)

        if ((count ?? 0) >= limites.utilisateurs_max) {
            return {
                erreur: `Votre plan ${shopPlan} est limité à ${limites.utilisateurs_max} utilisateur(s). Passez au plan supérieur.`,
            }
        }
    }

    const nomComplet    = (formData.get('nomComplet') as string)?.trim()
    const identifiant   = (formData.get('identifiant') as string)?.trim().toLowerCase()
    const motDePasse    = formData.get('motDePasse') as string
    const role          = formData.get('role') as string
    const permissionsEtendues = formData.getAll('permissions') as string[]

    if (!nomComplet || !identifiant || !motDePasse || !role) {
        return { erreur: 'Tous les champs obligatoires doivent être remplis.' }
    }

    if (motDePasse.length < 6) {
        return { erreur: 'Le mot de passe doit contenir au moins 6 caractères.' }
    }

    // Vérifier unicité identifiant dans la boutique
    const { data: existant } = await adminClient
        .from('shop_users')
        .select('id')
        .eq('shop_id', shopId)
        .eq('identifiant', identifiant)
        .single()

    if (existant) {
        return { erreur: 'Cet identifiant est déjà utilisé dans cette boutique.' }
    }

    // Générer public_id
    const { data: publicId } = await adminClient
        .rpc('generate_public_id', {
            p_shop_id: shopId,
            p_prefix:  'UTS',
        })

    if (!publicId) {
        return { erreur: 'Erreur lors de la génération de l\'identifiant.' }
    }

    const passwordHash = await argon2.hash(motDePasse, {
        type:         argon2.argon2id,
        memoryCost:   65536,
        timeCost:     3,
        parallelism:  1,
    })

    // Créer l'utilisateur
    const { data: nouvelUser, error } = await adminClient
        .from('shop_users')
        .insert({
            public_id:      publicId,
            shop_id:        shopId,
            nom_complet:    nomComplet,
            identifiant,
            password_hash:  passwordHash,
            role,
            est_actif:      true,
            created_by:     user.user_metadata.user_id,
        })
        .select()
        .single()

    if (error || !nouvelUser) {
        return { erreur: 'Erreur lors de la création de l\'utilisateur.' }
    }

    // Insérer les permissions par défaut du rôle
    const permissionsDefaut = PERMISSIONS_PAR_DEFAUT[role as keyof typeof PERMISSIONS_PAR_DEFAUT] ?? []

    // Pour le vendeur : ajouter les extensions accordées
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

    // Audit log
    await adminClient.from('audit_logs').insert({
        shop_id:              shopId,
        user_id:              user.user_metadata.user_id,
        user_public_id:       user.user_metadata.public_id,
        user_nom:             user.user_metadata.nom_complet,
        type_acteur:          'shop',
        event_type:           'USER_CREATED',
        reference_type:       'shop_user',
        reference_id:         nouvelUser.id,
        reference_public_id:  nouvelUser.public_id,
        details_json:         { role, identifiant },
    })

    revalidatePath('/admin/utilisateurs')
    redirect('/admin/utilisateurs')
}

// ── Modifier les permissions d'un vendeur ─────────────────────
export async function modifierPermissionsVendeur(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) {
        return { erreur: 'Non autorisé.' }
    }

    const shopId      = user.user_metadata.shop_id as string
    const userId      = formData.get('userId') as string
    const permissions = formData.getAll('permissions') as string[]

    const adminClient = createAdminClient()

    // Supprimer les anciennes extensions uniquement (garder les permissions par défaut)
    await adminClient
        .from('shop_user_permissions')
        .delete()
        .eq('user_id', userId)
        .in('permission', EXTENSIONS_VENDEUR)

    // Réinsérer les nouvelles extensions
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

    if (!user || user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) {
        return { erreur: 'Non autorisé.' }
    }

    const adminClient = createAdminClient()

    await adminClient
        .from('shop_users')
        .update({
            est_actif:    estActif,
            desactive_le: estActif ? null : new Date().toISOString(),
        })
        .eq('id', userId)

    revalidatePath('/admin/utilisateurs')
    return { succes: true }
}

// ── Débloquer un utilisateur (règle SEC2) ─────────────────────
export async function debloquerUtilisateur(userId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) {
        return { erreur: 'Non autorisé.' }
    }

    const adminClient = createAdminClient()

    await adminClient
        .from('shop_users')
        .update({
            est_bloque:           false,
            tentatives_echecs:    0,
            bloque_le:            null,
        })
        .eq('id', userId)

    await adminClient.from('audit_logs').insert({
        shop_id:    user.user_metadata.shop_id,
        user_id:    user.user_metadata.user_id,
        user_nom:   user.user_metadata.nom_complet,
        type_acteur: 'shop',
        event_type: 'USER_UNBLOCKED',
        reference_type: 'shop_user',
        details_json: { user_id: userId },
    })

    revalidatePath('/admin/utilisateurs')
    return { succes: true }
}