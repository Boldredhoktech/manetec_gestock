'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { uploadImageCloudinary } from '@/lib/cloudinary'
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

    // Envoyer l'email de bienvenue si email fourni
    if (email) {
        const { envoyerEmailBienvenueBoutique } = await import('@/lib/resend/notifications')
        await envoyerEmailBienvenueBoutique({
            emailDestinataire: email,
            nomBoutique:       nom,
            shopPublicId:      shopPublicId,
            identifiant:       identifiantAdmin,
            motDePasse:        motDePasseTemp,
            nomProprietaire:   nomProprietaire,
        })
    }

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

    const shopId             = formData.get('shopId') as string
    const nouveauPlan        = formData.get('plan') as string
    const joursExpiration    = parseInt(formData.get('joursExpiration') as string) || 30
    const noteActivation     = (formData.get('noteActivation') as string)?.trim()
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

    // Notifier le propriétaire du changement de statut
    const { data: boutique } = await adminClient
        .from('shops').select('nom, email').eq('id', shopId).single()

    if (boutique?.email) {
        const { data: adminShop } = await adminClient
            .from('shop_users').select('nom_complet')
            .eq('shop_id', shopId).eq('role', 'super_admin_boutique').single()

        const { envoyerNotifStatutBoutique } = await import('@/lib/resend/notifications')
        await envoyerNotifStatutBoutique({
            emailDestinataire: boutique.email,
            nomBoutique:       boutique.nom,
            nomProprietaire:   adminShop?.nom_complet ?? 'Propriétaire',
            estActive:         estActive,
        })
    }

    revalidatePath('/redhok/boutiques')
    return { succes: true }
}

// ── Modifier les paramètres de la boutique ─────────────────────
export async function modifierParametresBoutique(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }
    if (user.user_metadata?.role !== 'super_admin_boutique') {
        return { erreur: 'Réservé au SuperAdmin boutique.' }
    }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const nom                   = (formData.get('nom') as string)?.trim()
    const adresse               = (formData.get('adresse') as string)?.trim() || null
    const ville                 = (formData.get('ville') as string)?.trim() || null
    const pays                  = (formData.get('pays') as string)?.trim() || null
    const telephone_1           = (formData.get('telephone_1') as string)?.trim() || null
    const telephone_2           = (formData.get('telephone_2') as string)?.trim() || null
    const email                 = (formData.get('email') as string)?.trim() || null
    const site_web              = (formData.get('site_web') as string)?.trim() || null
    const ifu                   = (formData.get('ifu') as string)?.trim() || null
    const rccm                  = (formData.get('rccm') as string)?.trim() || null
    const devise                = (formData.get('devise') as string)?.trim() || 'FCFA'
    const remise_max_pct        = parseFloat(formData.get('remise_max_pct') as string) || 15
    const message_pied_facture  = (formData.get('message_pied_facture') as string)?.trim() || null
    const message_recu_thermique = (formData.get('message_recu_thermique') as string)?.trim() || null

    if (!nom) return { erreur: 'Le nom de la boutique est obligatoire.' }
    if (remise_max_pct < 0 || remise_max_pct > 100) {
        return { erreur: 'La remise maximum doit être entre 0 et 100%.' }
    }

    const { error } = await adminClient
        .from('shops')
        .update({
            nom,
            adresse,
            ville,
            pays,
            telephone_1,
            telephone_2,
            email,
            site_web,
            ifu,
            rccm,
            devise,
            remise_max_pct,
            message_pied_facture,
            message_recu_thermique,
        })
        .eq('id', shopId)

    if (error) return { erreur: 'Erreur lors de la mise à jour.' }

    revalidatePath('/admin/parametres')
    revalidatePath('/admin/dashboard')
    return { succes: true }
}

// ── Upload logo boutique ───────────────────────────────────────
export async function uploadLogoBoutique(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const shopId    = user.user_metadata.shop_id as string
    const fichier   = formData.get('logo') as File

    if (!fichier || fichier.size === 0) return { erreur: 'Aucun fichier sélectionné.' }
    if (fichier.size > 2 * 1024 * 1024) return { erreur: 'Le logo ne doit pas dépasser 2 Mo.' }

    const ext      = fichier.name.split('.').pop()?.toLowerCase()
    const extsOk   = ['jpg','jpeg','png','webp','svg']
    if (!ext || !extsOk.includes(ext)) {
        return { erreur: 'Format non supporté. Utilisez JPG, PNG, WEBP ou SVG.' }
    }

    const adminClient = createAdminClient()

    // Upload sur Cloudinary
    let logoUrl: string
    try {
        const buffer = Buffer.from(await fichier.arrayBuffer())
        const res = await uploadImageCloudinary(buffer, `shops/${shopId}`, 'logo')
        logoUrl = res.url
    } catch {
        return { erreur: 'Erreur lors de l\'upload du logo.' }
    }

    // Enregistrer l'URL en base
    const { error: dbError } = await adminClient
        .from('shops')
        .update({ logo_url: logoUrl })
        .eq('id', shopId)

    if (dbError) return { erreur: 'Logo uploadé mais non enregistré.' }

    revalidatePath('/admin/parametres')
    return { succes: true, logoUrl }
}

// ═══════════════════════════════════════════════════════════════
// Gestion des utilisateurs d'une boutique par l'admin plateforme
// (Bold Redhok) — accès profond à n'importe quelle boutique
// ═══════════════════════════════════════════════════════════════

async function gardePlateforme() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'platform') return null
    return user
}

// ── Modifier l'identifiant de connexion d'un utilisateur boutique ──
export async function modifierIdentifiantUserBoutique(
    shopId: string, userId: string, nouvelIdentifiant: string
) {
    const user = await gardePlateforme()
    if (!user) return { erreur: 'Non autorisé.' }

    const identifiant = (nouvelIdentifiant ?? '').trim().toLowerCase()
    if (!identifiant) return { erreur: 'L\'identifiant est requis.' }

    const adminClient = createAdminClient()

    const { data: existant } = await adminClient
        .from('shop_users')
        .select('id')
        .eq('shop_id', shopId)
        .eq('identifiant', identifiant)
        .neq('id', userId)
        .maybeSingle()

    if (existant) return { erreur: 'Cet identifiant est déjà utilisé dans cette boutique.' }

    const { error } = await adminClient
        .from('shop_users')
        .update({ identifiant })
        .eq('id', userId)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors de la mise à jour de l\'identifiant.' }

    await adminClient.from('audit_logs').insert({
        shop_id:        shopId,
        user_id:        user.user_metadata.admin_id,
        user_nom:       user.user_metadata.nom_complet ?? 'Admin Plateforme',
        type_acteur:    'platform',
        event_type:     'SHOP_USER_IDENTIFIANT_CHANGED',
        reference_type: 'shop_user',
        reference_id:   userId,
        details_json:   { identifiant },
    })

    revalidatePath(`/redhok/boutiques/${shopId}`)
    return { succes: true }
}

// ── Réinitialiser le mot de passe d'un utilisateur boutique ──────
// Génère un mot de passe temporaire (renvoyé pour communication) et
// débloque le compte. Le propriétaire le changera ensuite.
export async function reinitialiserMdpUserBoutique(shopId: string, userId: string) {
    const user = await gardePlateforme()
    if (!user) return { erreur: 'Non autorisé.' }

    const adminClient = createAdminClient()

    const motDePasseTemp = Math.random().toString(36).slice(2, 8).toUpperCase() +
        Math.random().toString(36).slice(2, 5)

    const passwordHash = await argon2.hash(motDePasseTemp, {
        type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1,
    })

    const { error } = await adminClient
        .from('shop_users')
        .update({
            password_hash:     passwordHash,
            est_bloque:        false,
            tentatives_echecs: 0,
            bloque_le:         null,
        })
        .eq('id', userId)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors de la réinitialisation.' }

    await adminClient.from('audit_logs').insert({
        shop_id:        shopId,
        user_id:        user.user_metadata.admin_id,
        user_nom:       user.user_metadata.nom_complet ?? 'Admin Plateforme',
        type_acteur:    'platform',
        event_type:     'SHOP_USER_PASSWORD_RESET',
        reference_type: 'shop_user',
        reference_id:   userId,
    })

    revalidatePath(`/redhok/boutiques/${shopId}`)
    return { succes: true, motDePasse: motDePasseTemp }
}

// ── Activer / Désactiver un utilisateur boutique ────────────────
export async function toggleActifUserBoutique(
    shopId: string, userId: string, estActif: boolean
) {
    const user = await gardePlateforme()
    if (!user) return { erreur: 'Non autorisé.' }

    const adminClient = createAdminClient()
    const { error } = await adminClient
        .from('shop_users')
        .update({
            est_actif:    estActif,
            desactive_le: estActif ? null : new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors de la mise à jour.' }

    await adminClient.from('audit_logs').insert({
        shop_id:        shopId,
        user_id:        user.user_metadata.admin_id,
        user_nom:       user.user_metadata.nom_complet ?? 'Admin Plateforme',
        type_acteur:    'platform',
        event_type:     estActif ? 'SHOP_USER_ACTIVATED' : 'SHOP_USER_DEACTIVATED',
        reference_type: 'shop_user',
        reference_id:   userId,
    })

    revalidatePath(`/redhok/boutiques/${shopId}`)
    return { succes: true }
}

// ── Débloquer un utilisateur boutique ───────────────────────────
export async function debloquerUserBoutique(shopId: string, userId: string) {
    const user = await gardePlateforme()
    if (!user) return { erreur: 'Non autorisé.' }

    const adminClient = createAdminClient()
    const { error } = await adminClient
        .from('shop_users')
        .update({ est_bloque: false, tentatives_echecs: 0, bloque_le: null })
        .eq('id', userId)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors du déblocage.' }

    revalidatePath(`/redhok/boutiques/${shopId}`)
    return { succes: true }
}