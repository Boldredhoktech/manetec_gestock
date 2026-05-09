'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import * as argon2 from 'argon2'

// ── Créer une boutique ─────────────────────────────────────────
export async function creerBoutique(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') {
        return { erreur: 'Non autorisé.' }
    }

    const adminClient = createAdminClient()

    const nom             = (formData.get('nom') as string)?.trim()
    const pays            = (formData.get('pays') as string)?.trim() || 'Bénin'
    const ville           = (formData.get('ville') as string)?.trim()
    const telephone1      = (formData.get('telephone1') as string)?.trim()
    const email           = (formData.get('email') as string)?.trim()
    const devise          = (formData.get('devise') as string)?.trim() || 'FCFA'
    const plan            = (formData.get('plan') as string) || 'starter'
    const joursExpiration = parseInt(formData.get('joursExpiration') as string) || 30
    const nomProprietaire = (formData.get('nomProprietaire') as string)?.trim()

    if (!nom || !telephone1 || !nomProprietaire) {
        return { erreur: 'Le nom, le téléphone et le nom du propriétaire sont obligatoires.' }
    }

    // Générer public_id boutique
    const { data: shopPublicId } = await adminClient
        .rpc('generate_platform_id', { p_prefix: 'SHOP' })

    if (!shopPublicId) {
        return { erreur: 'Erreur lors de la génération de l\'identifiant boutique.' }
    }

    const expiration = new Date()
    expiration.setDate(expiration.getDate() + joursExpiration)

    // Créer la boutique
    const { data: boutique, error: erreurBoutique } = await adminClient
        .from('shops')
        .insert({
            public_id:      shopPublicId,
            nom,
            pays,
            ville:          ville || null,
            telephone_1:    telephone1,
            email:          email || null,
            devise,
            plan,
            plan_expire_le: expiration.toISOString(),
            est_active:     true,
            created_by:     user.user_metadata.admin_id,
        })
        .select()
        .single()

    if (erreurBoutique || !boutique) {
        return { erreur: 'Erreur lors de la création de la boutique.' }
    }

    // Initialiser les compteurs
    const prefixes = [
        'UTS', 'CLI', 'ITM', 'CAT', 'BRD', 'WH',
        'VENTE', 'FACT', 'DEV', 'AVO', 'FPAY',
        'SUP', 'PO', 'REC', 'SRET', 'SPAY',
        'TRF', 'ADJ', 'INV', 'EXP', 'PSAL', 'MVT',
    ]

    await adminClient.from('public_id_counters').insert(
        prefixes.map(prefix => ({ shop_id: boutique.id, prefix, last_value: 0 }))
    )

    // Générer identifiant et mot de passe temporaire du SuperAdmin boutique
    const identifiantAdmin = `admin.${nom.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}`
    const motDePasseTemp   = Math.random().toString(36).slice(2, 8).toUpperCase() +
        Math.random().toString(36).slice(2, 5)

    const { data: userPublicId } = await adminClient
        .rpc('generate_public_id', {
            p_shop_id: boutique.id,
            p_prefix:  'UTS',
        })

    const passwordHash = await argon2.hash(motDePasseTemp, {
        type:        argon2.argon2id,
        memoryCost:  65536,
        timeCost:    3,
        parallelism: 1,
    })

    await adminClient.from('shop_users').insert({
        public_id:     userPublicId,
        shop_id:       boutique.id,
        nom_complet:   nomProprietaire,
        identifiant:   identifiantAdmin,
        password_hash: passwordHash,
        role:          'super_admin_boutique',
        est_actif:     true,
    })

    // Stocker les credentials temporaires en clair pour affichage agent
    // (effacés dès que le SuperAdmin change son mot de passe)
    await adminClient.from('shops').update({
        note_activation: JSON.stringify({
            identifiant:    identifiantAdmin,
            mot_de_passe:   motDePasseTemp,
            shop_public_id: shopPublicId,
        })
    }).eq('id', boutique.id)

    // Audit log
    await adminClient.from('audit_logs').insert({
        shop_id:             boutique.id,
        user_id:             user.user_metadata.admin_id,
        user_nom:            user.user_metadata.nom_complet ?? 'Admin Plateforme',
        type_acteur:         'platform',
        event_type:          'SHOP_CREATED',
        reference_type:      'shop',
        reference_id:        boutique.id,
        reference_public_id: boutique.public_id,
        details_json:        { nom, plan, devise },
    })

    // TODO Tranche 1 finale : envoyer email Resend si email fourni

    revalidatePath('/redhok/boutiques')
    redirect('/redhok/boutiques')
}

// ── Changer le plan d'abonnement ───────────────────────────────
export async function changerPlanAbonnement(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') {
        return { erreur: 'Non autorisé.' }
    }

    const adminClient = createAdminClient()

    const shopId          = formData.get('shopId') as string
    const nouveauPlan     = formData.get('plan') as string
    const joursExpiration = parseInt(formData.get('joursExpiration') as string) || 30
    const noteActivation  = (formData.get('noteActivation') as string)?.trim()
    const activationManuelle = formData.get('activationManuelle') === 'true'

    if (!shopId || !nouveauPlan) {
        return { erreur: 'Données manquantes.' }
    }

    const expiration = new Date()
    expiration.setDate(expiration.getDate() + joursExpiration)

    const { error } = await adminClient
        .from('shops')
        .update({
            plan:                nouveauPlan,
            plan_expire_le:      expiration.toISOString(),
            activation_manuelle: activationManuelle,
            note_activation:     noteActivation || null,
            active_par:          user.user_metadata.admin_id,
        })
        .eq('id', shopId)

    if (error) {
        return { erreur: 'Erreur lors de la mise à jour du plan.' }
    }

    await adminClient.from('audit_logs').insert({
        shop_id:        shopId,
        user_id:        user.user_metadata.admin_id,
        user_nom:       user.user_metadata.nom_complet ?? 'Admin Plateforme',
        type_acteur:    'platform',
        event_type:     'SHOP_PLAN_CHANGED',
        reference_type: 'shop',
        details_json:   {
            nouveau_plan: nouveauPlan,
            expiration:   expiration.toISOString(),
            manuel:       activationManuelle,
            note:         noteActivation,
        },
    })

    revalidatePath('/redhok/boutiques')
    return { succes: true }
}

// ── Activer / Désactiver une boutique ──────────────────────────
export async function toggleActivationBoutique(
    shopId: string,
    estActive: boolean
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'platform') {
        return { erreur: 'Non autorisé.' }
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
        .from('shops')
        .update({ est_active: estActive })
        .eq('id', shopId)

    if (error) return { erreur: 'Erreur lors de la mise à jour.' }

    await adminClient.from('audit_logs').insert({
        shop_id:        shopId,
        user_id:        user.user_metadata.admin_id,
        user_nom:       user.user_metadata.nom_complet ?? 'Admin Plateforme',
        type_acteur:    'platform',
        event_type:     estActive ? 'SHOP_ACTIVATED' : 'SHOP_DEACTIVATED',
        reference_type: 'shop',
        details_json:   { est_active: estActive },
    })

    revalidatePath('/redhok/boutiques')
    return { succes: true }
}