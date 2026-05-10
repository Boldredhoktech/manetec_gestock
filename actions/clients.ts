'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Créer un client ───────────────────────────────────────────
export async function creerClient(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

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
        est_anonyme: false,
        est_actif:   true,
        created_by:  user.user_metadata.user_id,
    })

    if (error) return { erreur: 'Erreur lors de la création du client.' }

    revalidatePath('/admin/clients')
    redirect('/admin/clients')
}

// ── Opération sur solde client ────────────────────────────────
export async function operationSoldeClient(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

    const shopId        = user.user_metadata.shop_id as string
    const adminClient   = createAdminClient()
    const clientId      = formData.get('clientId') as string
    const typeOperation = formData.get('typeOperation') as string
    const montant       = parseFloat(formData.get('montant') as string)
    const note          = (formData.get('note') as string)?.trim() || null

    if (!clientId || !typeOperation || isNaN(montant) || montant <= 0) {
        return { erreur: 'Données invalides.' }
    }

    // Récupérer le client
    const { data: client } = await adminClient
        .from('clients')
        .select('id, est_anonyme, credit_balance, advance_balance, change_balance')
        .eq('id', clientId)
        .eq('shop_id', shopId)
        .single()

    if (!client) return { erreur: 'Client introuvable.' }

    // Règle F2 : client anonyme
    if (client.est_anonyme &&
        ['credit_remboursement', 'advance_depot'].includes(typeOperation)) {
        return { erreur: 'Un client anonyme ne peut pas avoir de solde (règle F2).' }
    }

    // Calculer le nouveau solde
    let champSolde: 'credit_balance' | 'advance_balance' | 'change_balance'
    let soldeAvant: number
    let soldeApres: number

    switch (typeOperation) {
        case 'credit_remboursement':
            champSolde = 'credit_balance'
            soldeAvant = client.credit_balance
            soldeApres = soldeAvant - montant
            if (soldeApres < 0) return { erreur: 'Le remboursement dépasse le solde crédit.' }
            break
        case 'credit_utilisation':
            champSolde = 'credit_balance'
            soldeAvant = client.credit_balance
            soldeApres = soldeAvant + montant
            break
        case 'advance_depot':
            champSolde = 'advance_balance'
            soldeAvant = client.advance_balance
            soldeApres = soldeAvant + montant
            break
        case 'advance_utilisation':
            champSolde = 'advance_balance'
            soldeAvant = client.advance_balance
            soldeApres = soldeAvant - montant
            if (soldeApres < 0) return { erreur: 'Solde avance insuffisant.' }
            break
        case 'change_depot':
            champSolde = 'change_balance'
            soldeAvant = client.change_balance
            soldeApres = soldeAvant + montant
            break
        case 'change_utilisation':
            champSolde = 'change_balance'
            soldeAvant = client.change_balance
            soldeApres = soldeAvant - montant
            if (soldeApres < 0) return { erreur: 'Solde monnaie insuffisant.' }
            break
        default:
            return { erreur: 'Type d\'opération invalide.' }
    }

    // Mettre à jour le solde
    await adminClient
        .from('clients')
        .update({ [champSolde]: soldeApres })
        .eq('id', clientId)

    // Enregistrer l'opération
    await adminClient.from('client_balance_operations').insert({
        shop_id:        shopId,
        client_id:      clientId,
        type_operation: typeOperation,
        montant,
        solde_avant:    soldeAvant,
        solde_apres:    soldeApres,
        note,
        created_by:     user.user_metadata.user_id,
    })

    revalidatePath('/admin/clients')
    return { succes: true }
}

// ── Modifier un client ────────────────────────────────────────
export async function modifierClient(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { erreur: 'Non autorisé.' }
    }

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

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { error } = await adminClient
        .from('clients')
        .update({ nom, telephone, email, adresse, ville, pays, site_web, ifu, rccm, notes })
        .eq('id', clientId)
        .eq('shop_id', user.user_metadata.shop_id)

    if (error) return { erreur: 'Erreur lors de la modification.' }

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

    const adminClient = createAdminClient()
    await adminClient
        .from('clients')
        .update({ est_actif: estActif })
        .eq('id', clientId)
        .eq('shop_id', user.user_metadata.shop_id)

    revalidatePath('/admin/clients')
    return { succes: true }
}