'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import * as argon2 from 'argon2'

export async function creerBoutiquePublic(formData: FormData) {
    console.log('═══════════════════════════════════════════════')
    console.log('[INSCRIPTION] Début création boutique publique')
    console.log('═══════════════════════════════════════════════')

    const adminClient = createAdminClient()

    const nomBoutique     = (formData.get('nomBoutique') as string)?.trim()
    const pays            = (formData.get('pays') as string)?.trim() || 'Bénin'
    const ville           = (formData.get('ville') as string)?.trim() || null
    const telephone       = (formData.get('telephone') as string)?.trim()
    const email           = (formData.get('email') as string)?.trim() || null
    const devise          = (formData.get('devise') as string)?.trim() || 'FCFA'
    const nomProprietaire = (formData.get('nomProprietaire') as string)?.trim()

    console.log('[INSCRIPTION] Données reçues :', { nomBoutique, pays, ville, telephone, email, devise, nomProprietaire })

    if (!nomBoutique)     return { erreur: 'Le nom de la boutique est obligatoire.' }
    if (!telephone)       return { erreur: 'Le numéro de téléphone est obligatoire.' }
    if (!nomProprietaire) return { erreur: 'Votre nom complet est obligatoire.' }

    // ── Vérification doublon ───────────────────────────────────
    const { data: existant, error: erreurDoublon } = await adminClient
        .from('shops').select('id').ilike('nom', nomBoutique).maybeSingle()

    if (erreurDoublon) {
        console.error('[INSCRIPTION] ❌ Erreur doublon :', erreurDoublon)
        return { erreur: 'Erreur lors de la vérification. Réessayez.' }
    }
    if (existant) {
        console.log('[INSCRIPTION] ❌ Doublon détecté')
        return { erreur: 'Une boutique avec ce nom existe déjà. Veuillez en choisir un autre.' }
    }

    // ── public_id boutique ─────────────────────────────────────
    const { data: shopPublicId, error: erreurPid } = await adminClient
        .rpc('generate_platform_id', { p_prefix: 'SHOP' })

    if (erreurPid || !shopPublicId) {
        console.error('[INSCRIPTION] ❌ generate_platform_id :', erreurPid)
        return { erreur: `Erreur génération identifiant boutique : ${erreurPid?.message ?? 'null'}` }
    }
    console.log('[INSCRIPTION] ✓ public_id boutique :', shopPublicId)

    // ── Création boutique ──────────────────────────────────────
    const expiration = new Date()
    expiration.setDate(expiration.getDate() + 30)

    const { data: boutique, error: erreurBoutique } = await adminClient
        .from('shops')
        .insert({
            public_id:      shopPublicId,
            nom:            nomBoutique,
            pays,
            ville,
            telephone_1:    telephone,
            email,
            devise,
            plan:           'starter',
            plan_expire_le: expiration.toISOString(),
            est_active:     true,
        })
        .select()
        .single()

    if (erreurBoutique || !boutique) {
        console.error('[INSCRIPTION] ❌ INSERT shops :', erreurBoutique)
        return {
            erreur: `Erreur création boutique : ${erreurBoutique?.message ?? 'null'} | code : ${erreurBoutique?.code ?? '?'} | détails : ${erreurBoutique?.details ?? '?'}`,
        }
    }
    console.log('[INSCRIPTION] ✓ Boutique créée — id :', boutique.id)

    // ── Initialisation des compteurs ───────────────────────────
    // ⚠️ CRITIQUE : doit être fait AVANT tout appel à generate_public_id
    // pour cette boutique, sinon la fonction ne trouve pas le compteur
    // et retombe sur last_value=0, créant un doublon avec d'autres boutiques.
    console.log('[INSCRIPTION] Initialisation compteurs...')
    const prefixes = [
        'UTS','CLI','ITM','CAT','BRD','WH',
        'VENTE','FACT','DEV','AVO','FPAY',
        'SUP','PO','REC','SRET','SPAY',
        'TRF','ADJ','INV','EXP','PSAL','MVT',
    ]

    const { error: erreurCompteurs } = await adminClient
        .from('public_id_counters')
        .insert(prefixes.map(p => ({ shop_id: boutique.id, prefix: p, last_value: 0 })))

    if (erreurCompteurs) {
        // Si les compteurs échouent, on rollback la boutique
        console.error('[INSCRIPTION] ❌ INSERT public_id_counters :', {
            message: erreurCompteurs.message,
            code:    erreurCompteurs.code,
            details: erreurCompteurs.details,
        })
        await adminClient.from('shops').delete().eq('id', boutique.id)
        return {
            erreur: `Erreur initialisation compteurs : ${erreurCompteurs.message} | code : ${erreurCompteurs.code}`,
        }
    }
    console.log('[INSCRIPTION] ✓ Compteurs initialisés')

    // ── Identifiant SuperAdmin ─────────────────────────────────
    const base = nomBoutique
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9.]/g, '')
        .slice(0, 20)
    const identifiantAdmin = `admin.${base}`
    console.log('[INSCRIPTION] Identifiant admin :', identifiantAdmin)

    // ── Mot de passe ───────────────────────────────────────────
    const chars      = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const motDePasse = Array.from(
        { length: 8 },
        () => chars[Math.floor(Math.random() * chars.length)]
    ).join('')

    // ── public_id utilisateur ──────────────────────────────────
    // Les compteurs sont maintenant en place — generate_public_id
    // trouvera le compteur UTS et incrémentera correctement.
    console.log('[INSCRIPTION] Génération public_id utilisateur...')
    const { data: userPublicId, error: erreurUpid } = await adminClient
        .rpc('generate_public_id', { p_shop_id: boutique.id, p_prefix: 'UTS' })

    if (erreurUpid || !userPublicId) {
        console.error('[INSCRIPTION] ❌ generate_public_id utilisateur :', erreurUpid)
        await adminClient.from('shops').delete().eq('id', boutique.id)
        return {
            erreur: `Erreur génération compte : ${erreurUpid?.message ?? 'null'} | code : ${erreurUpid?.code ?? '?'}`,
        }
    }
    console.log('[INSCRIPTION] ✓ public_id utilisateur :', userPublicId)

    // ── Hashage mot de passe ───────────────────────────────────
    console.log('[INSCRIPTION] Hashage argon2...')
    let passwordHash: string
    try {
        passwordHash = await argon2.hash(motDePasse, {
            type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1,
        })
        console.log('[INSCRIPTION] ✓ Hash généré')
    } catch (e: any) {
        console.error('[INSCRIPTION] ❌ argon2.hash :', e?.message)
        await adminClient.from('shops').delete().eq('id', boutique.id)
        return { erreur: 'Erreur lors de la sécurisation du mot de passe.' }
    }

    // ── Création SuperAdmin ────────────────────────────────────
    console.log('[INSCRIPTION] INSERT shop_users...')
    const { error: erreurUser } = await adminClient
        .from('shop_users')
        .insert({
            public_id:     userPublicId,
            shop_id:       boutique.id,
            nom_complet:   nomProprietaire,
            identifiant:   identifiantAdmin,
            password_hash: passwordHash,
            role:          'super_admin_boutique',
            est_actif:     true,
        })

    if (erreurUser) {
        console.error('[INSCRIPTION] ❌ INSERT shop_users :', {
            message: erreurUser.message,
            code:    erreurUser.code,
            details: erreurUser.details,
            hint:    erreurUser.hint,
        })
        await adminClient.from('shops').delete().eq('id', boutique.id)
        return {
            erreur: `Erreur création compte admin : ${erreurUser.message} | code : ${erreurUser.code} | détails : ${erreurUser.details ?? '?'}`,
        }
    }
    console.log('[INSCRIPTION] ✓ SuperAdmin créé')

    // ── Email bienvenue (optionnel, non bloquant) ──────────────
    if (email) {
        console.log('[INSCRIPTION] Envoi email bienvenue à :', email)
        try {
            const { envoyerEmailBienvenueBoutique } = await import('@/lib/resend/notifications')
            const r = await envoyerEmailBienvenueBoutique({
                emailDestinataire: email,
                nomBoutique,
                shopPublicId,
                identifiant:   identifiantAdmin,
                motDePasse,
                nomProprietaire,
            })
            console.log('[INSCRIPTION] Résultat email :', r)
        } catch (e: any) {
            console.error('[INSCRIPTION] ⚠️ Email échoué (non bloquant) :', e?.message)
        }
    }

    console.log('[INSCRIPTION] ✅ Succès — identifiant :', identifiantAdmin)
    console.log('═══════════════════════════════════════════════')

    return {
        succes:        true,
        identifiant:   identifiantAdmin,
        motDePasse,
        shopId:        boutique.id,
        shopPublicId:  shopPublicId, // ← ID boutique nécessaire pour la connexion
    }
}