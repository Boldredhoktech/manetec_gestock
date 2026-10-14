'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { refusAbonnement } from '@/lib/abonnement/etat'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Contrôles communs à toute création de client ──────────────
// Session, licence, permission et quota du plan : la fiche complète
// (/admin/clients) et la création express du comptoir passent par ici.
async function controlerCreationClient() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' } as const
    }
    const refusLicence = await refusAbonnement(user)
    if (refusLicence) return { erreur: refusLicence } as const
    if (!aPermission(user, PERMISSIONS.CLIENTS_CREER)) return { erreur: 'Permission insuffisante pour cette action.' } as const

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // Limite clients selon le plan (lu en base, jamais le JWT)
    const { getPlanLimites } = await import('@/lib/constants/plans')
    const { data: boutiquePlan } = await adminClient
        .from('shops').select('plan').eq('id', shopId).single()
    const limites = getPlanLimites(boutiquePlan?.plan ?? 'starter')
    const { count: nbClients } = await adminClient
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId).eq('est_anonyme', false)
    if ((nbClients ?? 0) >= limites.max_clients) {
        return { erreur: `Votre plan ${limites.label} est limité à ${limites.max_clients} clients. Passez au plan supérieur.` } as const
    }

    return { user, shopId, adminClient }
}

// ── Créer un client ───────────────────────────────────────────
export async function creerClient(formData: FormData) {
    const controle = await controlerCreationClient()
    if ('erreur' in controle) return { erreur: controle.erreur }
    const { user, shopId, adminClient } = controle

    const nom      = (formData.get('nom') as string)?.trim()
    const telephone = (formData.get('telephone') as string)?.trim() || null
    const email    = (formData.get('email') as string)?.trim() || null
    const adresse  = (formData.get('adresse') as string)?.trim() || null
    const ville    = (formData.get('ville') as string)?.trim() || null
    const pays     = (formData.get('pays') as string)?.trim() || null
    const site_web = (formData.get('site_web') as string)?.trim() || null
    const ifu      = (formData.get('ifu') as string)?.trim() || null
    const rccm     = (formData.get('rccm') as string)?.trim() || null
    const notes    = (formData.get('notes') as string)?.trim() || null
    // Décision D2 : 0 vaut « pas de limite ».
    const plafond  = Math.max(0, parseFloat(formData.get('plafondCredit') as string) || 0)

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'CLI' })

    const { error } = await adminClient.from('clients').insert({
        public_id:   publicId,
        shop_id:     shopId,
        nom,
        telephone,
        email,
        adresse,
        ville,
        pays,
        site_web,
        ifu,
        rccm,
        notes,
        plafond_credit: plafond,
        est_anonyme: false,
        est_actif:   true,
        created_by:  user.user_metadata.user_id,
    })

    if (error) {
        // L'index unique partiel refuse deux fiches pour le meme numero
        // dans une meme boutique : deux fiches eclateraient l'historique
        // et les soldes d'une seule personne.
        if (error.code === '23505') {
            return { erreur: 'Un client de cette boutique porte déjà ce numéro de téléphone.' }
        }
        console.error('ERREUR CREATION CLIENT:', error)
        return { erreur: 'Erreur lors de la création du client.' }
    }

    revalidatePath('/admin/clients')
    redirect('/admin/clients')
}

// ── Créer un client depuis la caisse ──────────────────────────
// Le client absent de la recherche du comptoir est créé sans quitter
// la vente : nom et téléphone suffisent, le reste se complète ensuite
// dans Clients. Le téléphone est exigé ici : c'est lui qui retrouve le
// client à son prochain passage et qui empêche les fiches en double.
const COLONNES_CLIENT_POS =
    'id, public_id, nom, telephone, credit_balance, advance_balance, change_balance, plafond_credit'

export async function creerClientPOS(saisie: { nom: string; telephone: string }) {
    const controle = await controlerCreationClient()
    if ('erreur' in controle) return { erreur: controle.erreur }
    const { user, shopId, adminClient } = controle

    const nom       = saisie.nom?.trim()
    const telephone = saisie.telephone?.trim()
    if (!nom) return { erreur: 'Le nom est obligatoire.' }
    if (!telephone) return { erreur: 'Le téléphone est obligatoire.' }
    if (!/^\+?[\d\s.-]+$/.test(telephone) || telephone.replace(/\D/g, '').length < 6) {
        return { erreur: 'Numéro de téléphone invalide.' }
    }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'CLI' })

    const { data: client, error } = await adminClient.from('clients').insert({
        public_id:      publicId,
        shop_id:        shopId,
        nom,
        telephone,
        plafond_credit: 0,
        est_anonyme:    false,
        est_actif:      true,
        created_by:     user.user_metadata.user_id,
    }).select(COLONNES_CLIENT_POS).single()

    if (error) {
        // Le numéro appartient déjà à une fiche : on la propose plutôt
        // que d'obliger le caissier à refaire une recherche.
        if (error.code === '23505') {
            const { data: existant } = await adminClient
                .from('clients')
                .select(`${COLONNES_CLIENT_POS}, est_actif`)
                .eq('shop_id', shopId)
                .eq('telephone', telephone)
                .maybeSingle()
            return {
                erreur: existant
                    ? `Ce numéro appartient déjà à ${existant.nom}${existant.est_actif ? '' : ' (client désactivé)'}.`
                    : 'Un client de cette boutique porte déjà ce numéro de téléphone.',
                existant: existant?.est_actif ? existant : undefined,
            }
        }
        console.error('ERREUR CREATION CLIENT POS:', error)
        return { erreur: 'Erreur lors de la création du client.' }
    }

    revalidatePath('/admin/clients')
    return { client }
}

// ── Relire un client au comptoir ──────────────────────────────
// Un panier mis de côté ne garde que l'identifiant du client : ses
// soldes sont relus au moment de la reprise, ils ont pu changer.
export async function lireClientPOS(clientId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return null
    if (await refusAbonnement(user)) return null
    if (!aPermission(user, PERMISSIONS.CLIENTS_VOIR)) return null

    const { data } = await createAdminClient()
        .from('clients')
        .select(COLONNES_CLIENT_POS)
        .eq('id', clientId)
        .eq('shop_id', user.user_metadata.shop_id)
        .eq('est_actif', true)
        .maybeSingle()
    return data
}

// ── Opération sur solde client ────────────────────────────────
// L'action lisait le solde, calculait en JavaScript, puis écrivait :
// deux opérations simultanées sur le même client et la seconde écrasait
// la première. Elle délègue maintenant à `operation_solde_client`
// (migration 026), qui verrouille la ligne et écrit le solde ET son
// opération dans la même transaction — la vente au comptoir passe par
// le même chemin.
export async function operationSoldeClient(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }
    const refusLicence = await refusAbonnement(user)
    if (refusLicence) return { erreur: refusLicence }
    if (!aPermission(user, PERMISSIONS.CLIENTS_ACCES_COMPLET)) {
        return { erreur: 'Permission insuffisante pour cette action.' }
    }

    const adminClient   = createAdminClient()
    const clientId      = formData.get('clientId') as string
    const typeOperation = formData.get('typeOperation') as string
    const montant       = parseFloat(formData.get('montant') as string)
    const note          = (formData.get('note') as string)?.trim() || null

    if (!clientId || !typeOperation || isNaN(montant) || montant <= 0) {
        return { erreur: 'Données invalides.' }
    }

    const { data: result, error } = await adminClient.rpc('operation_solde_client', {
        p_shop_id:   user.user_metadata.shop_id,
        p_client_id: clientId,
        p_type:      typeOperation,
        p_montant:   montant,
        p_note:      note,
        p_user_id:   user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR OPERATION SOLDE CLIENT:', error)
        return { erreur: 'Erreur lors de l\'opération.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de l\'opération.' }

    revalidatePath('/admin/clients')
    revalidatePath(`/admin/clients/${clientId}`)

    // Le plafond avertit, il ne bloque pas (décision D2).
    return { succes: true, avertissement: result.avertissement ?? null }
}

// ── Modifier un client ────────────────────────────────────────
export async function modifierClient(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }
    const refusLicence = await refusAbonnement(user)
    if (refusLicence) return { erreur: refusLicence }
    if (!aPermission(user, PERMISSIONS.CLIENTS_ACCES_COMPLET)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient = createAdminClient()
    const clientId    = formData.get('clientId') as string
    const nom         = (formData.get('nom') as string)?.trim()
    const telephone   = (formData.get('telephone') as string)?.trim() || null
    const email       = (formData.get('email') as string)?.trim() || null
    const adresse     = (formData.get('adresse') as string)?.trim() || null
    const ville       = (formData.get('ville') as string)?.trim() || null
    const pays        = (formData.get('pays') as string)?.trim() || null
    const site_web    = (formData.get('site_web') as string)?.trim() || null
    const ifu         = (formData.get('ifu') as string)?.trim() || null
    const rccm        = (formData.get('rccm') as string)?.trim() || null
    const notes       = (formData.get('notes') as string)?.trim() || null
    const plafond     = Math.max(0, parseFloat(formData.get('plafondCredit') as string) || 0)

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { error } = await adminClient
        .from('clients')
        .update({
            nom, telephone, email, adresse, ville, pays, site_web, ifu, rccm, notes,
            plafond_credit: plafond,
        })
        .eq('id', clientId)
        .eq('shop_id', user.user_metadata.shop_id)

    if (error) {
        if (error.code === '23505') {
            return { erreur: 'Un client de cette boutique porte déjà ce numéro de téléphone.' }
        }
        console.error('ERREUR MODIFICATION CLIENT:', error)
        return { erreur: 'Erreur lors de la modification.' }
    }

    revalidatePath(`/admin/clients/${clientId}`)
    revalidatePath('/admin/clients')
    return { succes: true }
}

// ── Désactiver un client ──────────────────────────────────────
export async function toggleActivationClient(
    clientId: string,
    estActif: boolean
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }
    const refusLicence = await refusAbonnement(user)
    if (refusLicence) return { erreur: refusLicence }
    if (!aPermission(user, PERMISSIONS.CLIENTS_ACCES_COMPLET)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient = createAdminClient()
    await adminClient
        .from('clients')
        .update({ est_actif: estActif })
        .eq('id', clientId)
        .eq('shop_id', user.user_metadata.shop_id)

    revalidatePath('/admin/clients')
    return { succes: true }
}