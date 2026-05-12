'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────
export interface LigneFacture {
    product_id:    string | null
    designation:   string
    quantite:      number
    prix_unitaire: number
    remise_pct:    number
    tva_pct:       number
}

// ── Limites par plan ───────────────────────────────────────────
function getPlanLimites(plan: string) {
    return {
        factures_a4: plan === 'pro' || plan === 'enterprise',
        devis:       plan === 'pro' || plan === 'enterprise',
    }
}

// ── Clients entreprise ─────────────────────────────────────────
export async function creerClientEntreprise(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const nom        = (formData.get('nom') as string)?.trim()
    const nomContact = (formData.get('nomContact') as string)?.trim() || null
    const telephone  = (formData.get('telephone') as string)?.trim() || null
    const email      = (formData.get('email') as string)?.trim() || null
    const adresse    = (formData.get('adresse') as string)?.trim() || null
    const ville      = (formData.get('ville') as string)?.trim() || null
    const pays       = (formData.get('pays') as string)?.trim() || null
    const ifu        = (formData.get('ifu') as string)?.trim() || null
    const rccm       = (formData.get('rccm') as string)?.trim() || null

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'CLI' })

    const { error } = await adminClient.from('business_clients').insert({
        public_id: publicId, shop_id: shopId,
        nom, nom_contact: nomContact, telephone, email,
        adresse, ville, pays, ifu, rccm,
        est_actif: true, created_by: user.user_metadata.user_id,
    })

    if (error) return { erreur: 'Erreur lors de la création.' }

    revalidatePath('/admin/factures/clients')
    redirect('/admin/factures/clients')
}

// ── Créer un devis ─────────────────────────────────────────────
export async function creerDevis(
    clientId: string | null,
    objet: string,
    dateValidite: string | null,
    remisePct: number,
    noteClient: string,
    noteInterne: string,
    lignes: LigneFacture[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // ✅ LECTURE DU PLAN DEPUIS LA DB (jamais depuis le JWT)
    const { data: boutique } = await adminClient
        .from('shops').select('plan').eq('id', shopId).single()
    const plan    = boutique?.plan ?? 'starter'
    const limites = getPlanLimites(plan)

    if (!limites.devis) {
        return { erreur: 'La création de devis nécessite le plan Pro ou Enterprise.' }
    }

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    // Calculer les totaux
    let montantHT  = 0
    let montantTVA = 0

    const lignesCalculees = lignes.map((l, i) => {
        const remiseVal  = l.prix_unitaire * l.quantite * l.remise_pct / 100
        const ht         = l.prix_unitaire * l.quantite - remiseVal
        const tva        = ht * l.tva_pct / 100
        const ttc        = ht + tva
        montantHT  += ht
        montantTVA += tva
        return { ...l, remise_val: remiseVal, montant_ht: ht, montant_tva: tva, montant_ttc: ttc, ordre: i }
    })

    const remiseGlobaleVal = montantHT * remisePct / 100
    const montantHTFinal   = montantHT - remiseGlobaleVal
    const montantTTC       = montantHTFinal + montantTVA

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'DEV' })

    const { data: devis, error } = await adminClient.from('devis').insert({
        public_id:      publicId,
        shop_id:        shopId,
        client_id:      clientId || null,
        statut:         'brouillon',
        date_devis:     new Date().toISOString().split('T')[0],
        date_validite:  dateValidite || null,
        objet:          objet || null,
        montant_ht:     montantHTFinal,
        montant_tva:    montantTVA,
        montant_ttc:    montantTTC,
        remise_pct:     remisePct,
        remise_val:     remiseGlobaleVal,
        note_client:    noteClient || null,
        note_interne:   noteInterne || null,
        created_by:     user.user_metadata.user_id,
    }).select().single()

    if (error || !devis) {
        console.error('ERREUR DEVIS:', JSON.stringify(error, null, 2))
        return {
            erreur: `Erreur: ${error?.message ?? 'devis null'} | Code: ${error?.code ?? '?'} | Details: ${error?.details ?? '?'}`
        }
    }

    await adminClient.from('devis_items').insert(
        lignesCalculees.map(l => ({
            shop_id:       shopId,
            devis_id:      devis.id,
            product_id:    l.product_id || null,
            designation:   l.designation,
            quantite:      l.quantite,
            prix_unitaire: l.prix_unitaire,
            remise_pct:    l.remise_pct,
            remise_val:    l.remise_val,
            montant_ht:    l.montant_ht,
            tva_pct:       l.tva_pct,
            montant_tva:   l.montant_tva,
            montant_ttc:   l.montant_ttc,
            ordre:         l.ordre,
        }))
    )

    revalidatePath('/admin/factures')
    return { succes: true, devis_id: devis.id, public_id: devis.public_id }
}

// ── Convertir devis en facture ─────────────────────────────────
export async function convertirDevisEnFacture(devisId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: devis } = await adminClient
        .from('devis')
        .select('*, devis_items(*)')
        .eq('id', devisId)
        .eq('shop_id', shopId)
        .single()

    if (!devis) return { erreur: 'Devis introuvable.' }
    if (devis.statut === 'refuse' || devis.statut === 'expire') {
        return { erreur: 'Ce devis ne peut pas être converti.' }
    }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'FACT' })

    const dateEcheance = new Date()
    dateEcheance.setDate(dateEcheance.getDate() + 30)

    const { data: facture, error } = await adminClient.from('factures').insert({
        public_id:        publicId,
        shop_id:          shopId,
        client_id:        devis.client_id,
        devis_id:         devisId,
        statut:           'emise',
        date_facture:     new Date().toISOString().split('T')[0],
        date_echeance:    dateEcheance.toISOString().split('T')[0],
        objet:            devis.objet,
        montant_ht:       devis.montant_ht,
        montant_tva:      devis.montant_tva,
        montant_ttc:      devis.montant_ttc,
        montant_paye:     0,
        montant_restant:  devis.montant_ttc,
        remise_pct:       devis.remise_pct,
        remise_val:       devis.remise_val,
        note_client:      devis.note_client,
        est_immutable:    true,
        created_by:       user.user_metadata.user_id,
    }).select().single()

    if (error || !facture) {
        console.error('ERREUR CONVERSION DEVIS→FACTURE:', JSON.stringify(error, null, 2))
        return {
            erreur: `Erreur: ${error?.message ?? 'facture null'} | Code: ${error?.code ?? '?'} | Details: ${error?.details ?? '?'}`
        }
    }

    await adminClient.from('facture_items').insert(
        (devis.devis_items as any[]).map((l: any) => ({
            shop_id:       shopId,
            facture_id:    facture.id,
            product_id:    l.product_id,
            designation:   l.designation,
            quantite:      l.quantite,
            prix_unitaire: l.prix_unitaire,
            remise_pct:    l.remise_pct,
            remise_val:    l.remise_val,
            montant_ht:    l.montant_ht,
            tva_pct:       l.tva_pct,
            montant_tva:   l.montant_tva,
            montant_ttc:   l.montant_ttc,
            ordre:         l.ordre,
        }))
    )

    await adminClient.from('devis').update({
        statut:              'accepte',
        converti_en_facture: facture.id,
    }).eq('id', devisId)

    revalidatePath('/admin/factures')
    return { succes: true, facture_id: facture.id, public_id: facture.public_id }
}

// ── Créer une facture directe (sans devis) ─────────────────────
export async function creerFactureDirecte(
    clientId: string | null,
    objet: string,
    dateEcheance: string | null,
    remisePct: number,
    noteClient: string,
    lignes: LigneFacture[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // ✅ LECTURE DU PLAN DEPUIS LA DB (jamais depuis le JWT)
    const { data: boutique } = await adminClient
        .from('shops').select('plan').eq('id', shopId).single()
    const plan    = boutique?.plan ?? 'starter'
    const limites = getPlanLimites(plan)

    if (!limites.factures_a4) {
        return { erreur: 'La création de factures A4 nécessite le plan Pro ou Enterprise.' }
    }

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    let montantHT = 0, montantTVA = 0

    const lignesCalc = lignes.map((l, i) => {
        const remiseVal = l.prix_unitaire * l.quantite * l.remise_pct / 100
        const ht        = l.prix_unitaire * l.quantite - remiseVal
        const tva       = ht * l.tva_pct / 100
        montantHT  += ht
        montantTVA += tva
        return { ...l, remise_val: remiseVal, montant_ht: ht, montant_tva: tva, montant_ttc: ht + tva, ordre: i }
    })

    const remiseGlobaleVal = montantHT * remisePct / 100
    const montantHTFinal   = montantHT - remiseGlobaleVal
    const montantTTC       = montantHTFinal + montantTVA

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'FACT' })

    const { data: facture, error } = await adminClient.from('factures').insert({
        public_id:       publicId,
        shop_id:         shopId,
        client_id:       clientId || null,
        statut:          'emise',
        date_facture:    new Date().toISOString().split('T')[0],
        date_echeance:   dateEcheance || null,
        objet:           objet || null,
        montant_ht:      montantHTFinal,
        montant_tva:     montantTVA,
        montant_ttc:     montantTTC,
        montant_paye:    0,
        montant_restant: montantTTC,
        remise_pct:      remisePct,
        remise_val:      remiseGlobaleVal,
        note_client:     noteClient || null,
        est_immutable:   true,
        created_by:      user.user_metadata.user_id,
    }).select().single()

    if (error || !facture) {
        console.error('ERREUR FACTURE DIRECTE:', JSON.stringify(error, null, 2))
        return {
            erreur: `Erreur: ${error?.message ?? 'facture null'} | Code: ${error?.code ?? '?'} | Details: ${error?.details ?? '?'}`
        }
    }

    await adminClient.from('facture_items').insert(
        lignesCalc.map(l => ({
            shop_id:       shopId,
            facture_id:    facture.id,
            product_id:    l.product_id || null,
            designation:   l.designation,
            quantite:      l.quantite,
            prix_unitaire: l.prix_unitaire,
            remise_pct:    l.remise_pct,
            remise_val:    l.remise_val,
            montant_ht:    l.montant_ht,
            tva_pct:       l.tva_pct,
            montant_tva:   l.montant_tva,
            montant_ttc:   l.montant_ttc,
            ordre:         l.ordre,
        }))
    )

    revalidatePath('/admin/factures')
    return { succes: true, facture_id: facture.id, public_id: facture.public_id }
}

// ── Payer une facture ──────────────────────────────────────────
export async function payerFacture(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const adminClient = createAdminClient()
    const factureId   = formData.get('factureId') as string
    const montant     = parseFloat(formData.get('montant') as string)
    const moyen       = formData.get('moyen') as string
    const reference   = (formData.get('reference') as string) || ''
    const note        = (formData.get('note') as string) || ''

    if (!factureId || isNaN(montant) || montant <= 0) {
        return { erreur: 'Données invalides.' }
    }

    const { data: result } = await adminClient.rpc('payer_facture', {
        p_shop_id:    user.user_metadata.shop_id,
        p_facture_id: factureId,
        p_montant:    montant,
        p_moyen:      moyen,
        p_reference:  reference,
        p_note:       note,
        p_user_id:    user.user_metadata.user_id,
    })

    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur.' }

    revalidatePath('/admin/factures')
    return { succes: true, statut: result.statut }
}

// ── Créer un avoir ─────────────────────────────────────────────
export async function creerAvoir(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()
    const factureId   = formData.get('factureId') as string
    const motif       = (formData.get('motif') as string)?.trim()
    const montant     = parseFloat(formData.get('montant') as string)

    if (!motif || isNaN(montant) || montant <= 0) return { erreur: 'Données invalides.' }

    const { data: facture } = await adminClient
        .from('factures').select('client_id').eq('id', factureId).single()

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'AVO' })

    const { error } = await adminClient.from('avoirs').insert({
        public_id:  publicId,
        shop_id:    shopId,
        facture_id: factureId,
        client_id:  facture?.client_id || null,
        motif,
        montant,
        created_by: user.user_metadata.user_id,
    })

    if (error) return { erreur: 'Erreur lors de la création de l\'avoir.' }

    revalidatePath('/admin/factures')
    return { succes: true }
}

// ── Modifier statut devis ──────────────────────────────────────
export async function modifierStatutDevis(devisId: string, statut: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }

    const adminClient = createAdminClient()
    await adminClient.from('devis').update({ statut })
        .eq('id', devisId).eq('shop_id', user.user_metadata.shop_id)

    revalidatePath('/admin/factures')
    return { succes: true }
}