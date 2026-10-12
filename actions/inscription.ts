'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import * as argon2 from 'argon2'
import { motDePasseTemporaire } from '@/lib/auth/mot-de-passe-temporaire'

// ABO-16 : cette action est appelée par un visiteur ANONYME. Avant, elle
// lui renvoyait le message, le code et les détails bruts de PostgreSQL,
// et écrivait dans les journaux serveur toutes les données saisies
// (nom, téléphone, e-mail). Désormais : un message neutre au visiteur,
// et dans les journaux seulement l'étape et le code d'erreur.
const ECHEC = 'La création de la boutique a échoué. Réessayez dans quelques instants ; si le problème persiste, contactez-nous.'

function journaliserEchec(etape: string, erreur: { code?: string; message?: string } | null | undefined) {
    console.error(`[INSCRIPTION] échec à l'étape « ${etape} » — code ${erreur?.code ?? '?'}`)
}

export async function creerBoutiquePublic(formData: FormData) {
    const adminClient = createAdminClient()

    const nomBoutique     = (formData.get('nomBoutique') as string)?.trim()
    const pays            = (formData.get('pays') as string)?.trim() || 'Bénin'
    const ville           = (formData.get('ville') as string)?.trim() || null
    const telephone       = (formData.get('telephone') as string)?.trim()
    const email           = (formData.get('email') as string)?.trim() || null
    const devise          = (formData.get('devise') as string)?.trim() || 'FCFA'
    const nomProprietaire = (formData.get('nomProprietaire') as string)?.trim()

    if (!nomBoutique)     return { erreur: 'Le nom de la boutique est obligatoire.' }
    if (!telephone)       return { erreur: 'Le numéro de téléphone est obligatoire.' }
    if (!nomProprietaire) return { erreur: 'Votre nom complet est obligatoire.' }

    // ── Vérification doublon ───────────────────────────────────
    const { data: existant, error: erreurDoublon } = await adminClient
        .from('shops').select('id').ilike('nom', nomBoutique).maybeSingle()

    if (erreurDoublon) {
        journaliserEchec('doublon', erreurDoublon)
        return { erreur: ECHEC }
    }
    if (existant) {
        return { erreur: 'Une boutique avec ce nom existe déjà. Veuillez en choisir un autre.' }
    }

    // ── public_id boutique ─────────────────────────────────────
    const { data: shopPublicId, error: erreurPid } = await adminClient
        .rpc('generate_platform_id', { p_prefix: 'SHOP' })

    if (erreurPid || !shopPublicId) {
        journaliserEchec('identifiant boutique', erreurPid)
        return { erreur: ECHEC }
    }

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
        journaliserEchec('boutique', erreurBoutique)
        return { erreur: ECHEC }
    }

    // ── Initialisation des compteurs ───────────────────────────
    // ⚠️ CRITIQUE : doit être fait AVANT tout appel à generate_public_id
    // pour cette boutique, sinon la fonction ne trouve pas le compteur
    // et retombe sur last_value=0, créant un doublon avec d'autres boutiques.
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
        journaliserEchec('compteurs', erreurCompteurs)
        await adminClient.from('shops').delete().eq('id', boutique.id)
        return { erreur: ECHEC }
    }

    // ── Identifiant SuperAdmin ─────────────────────────────────
    const base = nomBoutique
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9.]/g, '')
        .slice(0, 20)
    const identifiantAdmin = `admin.${base}`

    // ── Mot de passe ───────────────────────────────────────────
    const motDePasse = motDePasseTemporaire()

    // ── public_id utilisateur ──────────────────────────────────
    // Les compteurs sont maintenant en place — generate_public_id
    // trouvera le compteur UTS et incrémentera correctement.
    const { data: userPublicId, error: erreurUpid } = await adminClient
        .rpc('generate_public_id', { p_shop_id: boutique.id, p_prefix: 'UTS' })

    if (erreurUpid || !userPublicId) {
        journaliserEchec('identifiant utilisateur', erreurUpid)
        await adminClient.from('shops').delete().eq('id', boutique.id)
        return { erreur: ECHEC }
    }

    // ── Hashage mot de passe ───────────────────────────────────
    let passwordHash: string
    try {
        passwordHash = await argon2.hash(motDePasse, {
            type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1,
        })
    } catch {
        journaliserEchec('hachage', null)
        await adminClient.from('shops').delete().eq('id', boutique.id)
        return { erreur: ECHEC }
    }

    // ── Création SuperAdmin ────────────────────────────────────
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
        journaliserEchec('compte administrateur', erreurUser)
        await adminClient.from('shops').delete().eq('id', boutique.id)
        return { erreur: ECHEC }
    }

    // ── Email bienvenue (optionnel, non bloquant) ──────────────
    if (email) {
        try {
            const { envoyerEmailBienvenueBoutique } = await import('@/lib/resend/notifications')
            await envoyerEmailBienvenueBoutique({
                emailDestinataire: email,
                nomBoutique,
                shopPublicId,
                identifiant:   identifiantAdmin,
                motDePasse,
                nomProprietaire,
            })
        } catch {
            journaliserEchec('e-mail de bienvenue (non bloquant)', null)
        }
    }

    return {
        succes:        true,
        identifiant:   identifiantAdmin,
        motDePasse,
        shopId:        boutique.id,
        shopPublicId:  shopPublicId, // ← ID boutique nécessaire pour la connexion
    }
}