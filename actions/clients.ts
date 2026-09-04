'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Créer un client ───────────────────────────────────────────
export async function creerClient(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }
    if (!aPermission(user, PERMISSIONS.CLIENTS_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

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
        return { erreur: `Votre plan ${limites.label} est limité à ${limites.max_clients} clients. Passez au plan supérieur.` }
    }

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