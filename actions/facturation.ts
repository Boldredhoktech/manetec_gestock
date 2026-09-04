'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getPlanLimites } from '@/lib/constants/plans'
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
    if (!aPermission(user, PERMISSIONS.FACTURES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

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
        console.error('ERREUR DEVIS:', error)
        return { erreur: 'Erreur lors de la création du devis.' }
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
// Tout se passe dans une seule fonction SQL (migration 025) : l'ancienne
// version ne refusait que les devis refusés ou expirés, alors qu'un
// devis DÉJÀ CONVERTI porte le statut `accepte` — qui passait le
// contrôle. Deux clics donnaient deux factures pour la même commande.
// La RPC refuse maintenant tout devis dont `converti_en_facture` est
// rempli, et écrit l'en-tête et les lignes dans la même transaction.
export async function convertirDevisEnFacture(devisId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.FACTURES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // La conversion produit une facture A4 : elle doit être soumise au
    // même contrôle de plan que la création directe, qui l'avait et
    // qu'elle n'avait pas. Sans cela, une boutique obtenait ses factures
    // A4 en passant par un devis.
    const { data: boutique } = await adminClient
        .from('shops').select('plan').eq('id', shopId).single()
    const limites = getPlanLimites(boutique?.plan ?? 'starter')

    if (!limites.factures_a4) {
        return { erreur: 'La création de factures A4 nécessite le plan Pro ou Enterprise.' }
    }

    const { data: result, error } = await adminClient.rpc('convertir_devis_en_facture', {
        p_shop_id:  shopId,
        p_devis_id: devisId,
        p_user_id:  user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR CONVERSION DEVIS→FACTURE:', error)
        return { erreur: 'Erreur lors de la conversion du devis en facture.' }
    }
    if (!result?.succes) {
        return { erreur: result?.erreur ?? 'Erreur lors de la conversion.' }
    }

    revalidatePath('/admin/factures')
    return { succes: true, facture_id: result.facture_id, public_id: result.public_id }
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
    if (!aPermission(user, PERMISSIONS.FACTURES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

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
        console.error('ERREUR FACTURE DIRECTE:', error)
        return { erreur: 'Erreur lors de la création de la facture.' }
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
    if (!aPermission(user, PERMISSIONS.FACTURES_PAIEMENT)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient  = createAdminClient()
    const factureId    = formData.get('factureId') as string
    const montant      = parseFloat(formData.get('montant') as string)
    const moyen        = (formData.get('moyen') as string) || 'cash'
    const reference    = (formData.get('reference') as string) || ''
    const note         = (formData.get('note') as string) || ''
    // La date réelle du règlement, et non celle de la saisie : depuis le
    // Lot 4 Finances, c'est elle qui date la trésorerie. La RPC ne
    // l'écrivait jamais et la base retombait sur CURRENT_DATE.
    const datePaiement = (formData.get('datePaiement') as string)
        || new Date().toISOString().split('T')[0]

    if (!factureId || isNaN(montant) || montant <= 0) {
        return { erreur: 'Données invalides.' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePaiement)) {
        return { erreur: 'Date de règlement invalide.' }
    }

    const { data: result, error } = await adminClient.rpc('payer_facture', {
        p_shop_id:       user.user_metadata.shop_id,
        p_facture_id:    factureId,
        p_montant:       montant,
        p_moyen:         moyen,
        p_reference:     reference,
        p_note:          note,
        p_user_id:       user.user_metadata.user_id,
        p_date_paiement: datePaiement,
    })

    if (error) {
        console.error('ERREUR REGLEMENT FACTURE:', error)
        return { erreur: 'Erreur lors de l\'enregistrement du règlement.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur.' }

    revalidatePath('/admin/factures')
    revalidatePath(`/admin/factures/${factureId}`)
    revalidatePath('/compta/dashboard')
    return { succes: true, statut: result.statut }
}

// ── Créer un avoir ─────────────────────────────────────────────
// L'avoir s'enregistrait dans sa table et c'est tout : ni le montant dû,
// ni le statut de la facture ne bougeaient. Le client recevait un avoir
// qui ne le déchargeait de rien, et le rapport des impayés continuait de
// réclamer la totalité.
//
// Décision D3 : l'avoir vient en déduction tant qu'il reste à payer, et
// le surplus alimente l'avance du client — ce qu'une boutique fait
// naturellement quand la facture est déjà réglée. La RPC fait les deux
// dans la même transaction et tient le registre des soldes.
export async function creerAvoir(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.AVOIRS_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient = createAdminClient()
    const factureId   = formData.get('factureId') as string
    const motif       = (formData.get('motif') as string)?.trim()
    const montant     = parseFloat(formData.get('montant') as string)

    if (!factureId || !motif || isNaN(montant) || montant <= 0) {
        return { erreur: 'Données invalides.' }
    }

    const { data: result, error } = await adminClient.rpc('creer_avoir', {
        p_shop_id:    user.user_metadata.shop_id,
        p_facture_id: factureId,
        p_montant:    montant,
        p_motif:      motif,
        p_user_id:    user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR AVOIR:', error)
        return { erreur: 'Erreur lors de la création de l\'avoir.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de la création de l\'avoir.' }

    revalidatePath('/admin/factures')
    revalidatePath(`/admin/factures/${factureId}`)

    const deduit = Number(result.montant_deduit ?? 0)
    const avance = Number(result.montant_avance ?? 0)

    return {
        succes: true,
        detail: avance > 0
            ? (deduit > 0
                ? `${deduit} déduits de la facture, ${avance} portés à l'avance du client.`
                : `Facture déjà réglée : ${avance} portés à l'avance du client.`)
            : 'Montant déduit du reste à payer.',
    }
}

// ── Modifier statut devis ──────────────────────────────────────
// La chaîne reçue était écrite telle quelle : seule la contrainte de la
// base empêchait une valeur fantaisiste, et rien n'interdisait les
// transitions absurdes — rouvrir en brouillon un devis déjà converti,
// ou déclarer « refusé » un devis accepté.
const TRANSITIONS_DEVIS: Record<string, string[]> = {
    brouillon: ['envoye', 'refuse'],
    envoye:    ['accepte', 'refuse', 'expire'],
    accepte:   ['refuse'],   // tant qu'aucune facture n'en est issue
    refuse:    ['envoye'],   // le client se ravise
    expire:    ['envoye'],   // on relance sur les mêmes bases
}

export async function modifierStatutDevis(devisId: string, statut: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.FACTURES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: devis } = await adminClient
        .from('devis')
        .select('id, statut, converti_en_facture')
        .eq('id', devisId)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!devis) return { erreur: 'Devis introuvable.' }

    if (devis.converti_en_facture) {
        return { erreur: 'Ce devis a été converti en facture : son statut ne change plus.' }
    }
    if (devis.statut === statut) return { succes: true }

    const permises = TRANSITIONS_DEVIS[devis.statut] ?? []
    if (!permises.includes(statut)) {
        return { erreur: `Un devis « ${devis.statut} » ne peut pas passer à « ${statut} ».` }
    }

    const { error } = await adminClient.from('devis').update({ statut })
        .eq('id', devisId).eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors du changement de statut.' }

    revalidatePath('/admin/factures')
    revalidatePath(`/admin/factures/devis/${devisId}`)
    return { succes: true }
}

// ══════════════════════════════════════════════════════════════
// VIE DE LA FACTURE
//
// Une facture émise ne se réécrit pas — c'est une pièce. Mais elle doit
// pouvoir vieillir, s'annuler, et voir ses règlements corrigés. Tout
// passe par des fonctions SQL atomiques (migration 025) : le montant
// payé, le montant restant et le statut sont recalculés au même endroit,
// à partir de ce qui a réellement été encaissé et avoiré.
// ══════════════════════════════════════════════════════════════

export type ResultatFacture = {
    erreur?:  string
    succes?:  boolean
    statut?:  string
    detail?:  string
}

// ── Annuler une facture ────────────────────────────────────────
export async function annulerFacture(
    factureId: string,
    motif: string,
): Promise<ResultatFacture> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.FACTURES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('annuler_facture', {
        p_shop_id:    user.user_metadata.shop_id,
        p_facture_id: factureId,
        p_motif:      motif,
        p_user_id:    user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR ANNULATION FACTURE:', error)
        return { erreur: 'Erreur lors de l\'annulation.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de l\'annulation.' }

    revalidatePath('/admin/factures')
    revalidatePath(`/admin/factures/${factureId}`)
    return { succes: true }
}

// ── Corriger un règlement ──────────────────────────────────────
export async function modifierPaiementFacture(formData: FormData): Promise<ResultatFacture> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.FACTURES_PAIEMENT)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient  = createAdminClient()
    const paiementId   = formData.get('paiementId') as string
    const factureId    = formData.get('factureId') as string
    const montant      = parseFloat(formData.get('montant') as string)
    const moyen        = (formData.get('moyen') as string) || 'cash'
    const reference    = (formData.get('reference') as string)?.trim() || ''
    const datePaiement = (formData.get('datePaiement') as string) || ''

    if (!paiementId || isNaN(montant) || montant <= 0) return { erreur: 'Données invalides.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePaiement)) return { erreur: 'Date de règlement invalide.' }

    const { data: result, error } = await adminClient.rpc('modifier_paiement_facture', {
        p_shop_id:       user.user_metadata.shop_id,
        p_paiement_id:   paiementId,
        p_montant:       montant,
        p_moyen:         moyen,
        p_reference:     reference,
        p_date_paiement: datePaiement,
        p_user_id:       user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR MODIFICATION REGLEMENT:', error)
        return { erreur: 'Erreur lors de la modification.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de la modification.' }

    revalidatePath('/admin/factures')
    if (factureId) revalidatePath(`/admin/factures/${factureId}`)
    revalidatePath('/compta/dashboard')
    return { succes: true }
}

// ── Annuler un règlement ───────────────────────────────────────
export async function annulerPaiementFacture(
    paiementId: string,
    motif: string,
    factureId?: string,
): Promise<ResultatFacture> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.FACTURES_PAIEMENT)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('annuler_paiement_facture', {
        p_shop_id:     user.user_metadata.shop_id,
        p_paiement_id: paiementId,
        p_motif:       motif,
        p_user_id:     user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR ANNULATION REGLEMENT:', error)
        return { erreur: 'Erreur lors de l\'annulation.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de l\'annulation.' }

    revalidatePath('/admin/factures')
    if (factureId) revalidatePath(`/admin/factures/${factureId}`)
    revalidatePath('/compta/dashboard')
    return { succes: true }
}

// ── Modifier un devis ──────────────────────────────────────────
// Un devis n'est qu'une proposition : une faute de frappe ou un prix
// erroné obligeait à tout ressaisir. La facture, elle, reste immuable —
// c'est une pièce — et c'est l'annulation qui sert à la corriger.
export async function modifierDevis(
    devisId: string,
    clientId: string | null,
    objet: string,
    dateValidite: string | null,
    remisePct: number,
    noteClient: string,
    noteInterne: string,
    lignes: LigneFacture[],
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.FACTURES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient = createAdminClient()

    if (lignes.length === 0) return { erreur: 'Ajoutez au moins une ligne.' }

    const { data: result, error } = await adminClient.rpc('modifier_devis', {
        p_shop_id:       user.user_metadata.shop_id,
        p_devis_id:      devisId,
        p_client_id:     clientId || null,
        p_objet:         objet || '',
        p_date_validite: dateValidite || null,
        p_remise_pct:    remisePct,
        p_note_client:   noteClient || '',
        p_note_interne:  noteInterne || '',
        p_lignes:        lignes,
        p_user_id:       user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR MODIFICATION DEVIS:', error)
        return { erreur: 'Erreur lors de la modification du devis.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de la modification.' }

    revalidatePath('/admin/factures')
    revalidatePath(`/admin/factures/devis/${devisId}`)
    return { succes: true }
}
