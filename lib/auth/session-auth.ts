// lib/auth/session-auth.ts
// ═══════════════════════════════════════════════════════════════
// Ouverture de la session Supabase Auth, une fois l'identité vérifiée
// par NOS soins (argon2, blocage après 3 essais, licence).
//
// Avant : le mot de passe Supabase d'un compte était son propre
// identifiant interne (`password: utilisateur.id`). Quiconque obtenait
// cet UUID — il circule dans les URL, les journaux, les exports — et la
// clé publique du site ouvrait une session à sa place par l'API Supabase,
// sans argon2, sans blocage, sans contrôle d'expiration.
//
// Désormais : aucun mot de passe Supabase n'est jamais connu de personne.
//   1. Le serveur génère un lien de connexion à usage unique (clé
//      service, jamais envoyé par e-mail) ;
//   2. il remplace le mot de passe du compte par 32 octets aléatoires
//      jetés aussitôt — ce qui invalide l'ancien mot de passe = UUID ;
//   3. il échange le jeton du lien contre la session (cookies).
// Les métadonnées (rôle, permissions) sont réécrites à l'étape 2, avant
// l'émission du jeton : le JWT reflète toujours la base (FIN-25).
// ═══════════════════════════════════════════════════════════════

import { randomBytes } from 'node:crypto'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ECHEC = { erreur: 'Impossible d\'ouvrir la session. Réessayez.' }

/** Trace l'étape fautive côté serveur ; l'utilisateur ne voit qu'un message neutre. */
function echec(etape: string, erreur?: { message?: string; code?: string; status?: number } | null) {
    console.error(`[SESSION AUTH] échec « ${etape} » — ${erreur?.status ?? ''} ${erreur?.code ?? ''} ${erreur?.message ?? ''}`)
    return ECHEC
}

/**
 * Client qui ouvre une session NEUVE, sans relire celle du navigateur.
 *
 * Constaté le 2026-10-12 : avec le client habituel, la session déjà
 * présente dans les cookies (expirée) était rafraîchie pendant la
 * connexion, et ce rafraîchissement ÉCRASAIT la nouvelle session —
 * l'administrateur plateforme se retrouvait connecté comme l'ancien
 * utilisateur boutique. Sur un poste de caisse partagé, le caissier B
 * aurait hérité de l'identité du caissier A.
 * Ici : les anciens cookies de session sont effacés (y compris les
 * morceaux « .0 », « .1 » qu'une session plus courte ne réécrirait pas),
 * et le client ne lit aucun cookie entrant.
 */
async function clientSessionNeuve() {
    const magasin = await cookies()
    for (const c of magasin.getAll()) {
        if (c.name.startsWith('sb-') && c.name.includes('-auth-token')) magasin.delete(c.name)
    }

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => [],
                setAll: (aEcrire: { name: string; value: string; options?: Record<string, unknown> }[]) => {
                    aEcrire.forEach(({ name, value, options }) =>
                        magasin.set(name, value, options as Parameters<typeof magasin.set>[2]))
                },
            },
        },
    )
}

/** Secret jetable : personne ne le connaît, pas même le serveur ensuite. */
function secretJetable(): string {
    return randomBytes(32).toString('base64url')
}

export async function ouvrirSessionAuth(
    emailVirtuel: string,
    metadonnees: Record<string, unknown>,
): Promise<{ erreur?: string }> {
    const adminClient = createAdminClient()

    const genererLien = () => adminClient.auth.admin.generateLink({
        type:    'magiclink',
        email:   emailVirtuel,
        options: { data: metadonnees },
    })

    // Lien à usage unique. À la première connexion le compte Auth
    // n'existe pas : on le crée (déjà confirmé, mot de passe jetable)
    // puis on redemande le lien. Le type exact du jeton renvoyé est dans
    // `verification_type`.
    let { data: lien, error: erreurLien } = await genererLien()

    if (erreurLien) {
        const { error: erreurCreation } = await adminClient.auth.admin.createUser({
            email:         emailVirtuel,
            password:      secretJetable(),
            user_metadata: metadonnees,
            email_confirm: true,
        })
        if (erreurCreation) return echec('création du compte', erreurCreation)
        ;({ data: lien, error: erreurLien } = await genererLien())
    }

    if (erreurLien || !lien?.user) {
        return echec('identification du compte', erreurLien)
    }

    const { error: erreurMaj } = await adminClient.auth.admin.updateUserById(lien.user.id, {
        password:      secretJetable(),
        user_metadata: metadonnees,
    })
    if (erreurMaj) return echec('mise à jour du compte', erreurMaj)

    // Modifier le compte invalide les liens déjà émis (constaté :
    // « otp_expired ») : le lien qui ouvre la session est donc demandé
    // APRÈS la mise à jour. Le premier n'a servi qu'à trouver le compte.
    const { data: lienFinal, error: erreurLienFinal } = await genererLien()
    if (erreurLienFinal || !lienFinal?.properties?.hashed_token) {
        return echec('lien à usage unique', erreurLienFinal)
    }

    const supabase = await clientSessionNeuve()
    const { error: erreurSession } = await supabase.auth.verifyOtp({
        token_hash: lienFinal.properties.hashed_token,
        type:       lienFinal.properties.verification_type as EmailOtpType,
    })
    if (erreurSession) return echec('échange du jeton', erreurSession)

    return {}
}
