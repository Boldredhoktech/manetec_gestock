'use server'

// ═══════════════════════════════════════════════════════════════
// Trésorerie (mig 041) : comptes, virements, retraits / apports,
// rapprochements. Le shopId vient TOUJOURS de la session.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { refusAbonnement } from '@/lib/abonnement/etat'
import { aPermission, peutVoirSoldes } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { journaliserCorrection, champsModifies } from '@/lib/audit/journaliser'
import {
    TYPES_COMPTE, OPERATEURS_MM, messageTresorerie,
    type CompteChoix, type TypeCompte,
} from '@/lib/tresorerie/comptes'
import { revalidatePath } from 'next/cache'

type Resultat = { succes: true; id?: string; message?: string } | { erreur: string }

async function sessionBoutique(permission?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' } as const
    const refus = await refusAbonnement(user)
    if (refus) return { erreur: refus } as const
    if (permission && !aPermission(user, permission)) {
        return { erreur: 'Vous n\'avez pas la permission d\'effectuer cette action.' } as const
    }
    return { user, shopId: user.user_metadata.shop_id as string, userId: user.user_metadata.user_id as string }
}

function rafraichir(compteId?: string) {
    revalidatePath('/compta/tresorerie')
    if (compteId) revalidatePath(`/compta/tresorerie/${compteId}`)
    revalidatePath('/compta/dashboard')
}

const nettoyer = (v: FormDataEntryValue | null) => ((v as string) ?? '').trim()
const nombre = (v: FormDataEntryValue | null) => {
    const n = parseFloat(((v as string) ?? '').replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : NaN
}
const aujourdhui = () => new Date().toISOString().split('T')[0]

// ── Comptes proposés dans les formulaires de paiement ─────────
// Tout utilisateur qui encaisse ou paie doit pouvoir CHOISIR un compte ;
// seul celui qui a le droit voit les soldes.
export async function listerComptesChoix(): Promise<{ comptes: CompteChoix[]; voitSoldes: boolean } | { erreur: string }> {
    const s = await sessionBoutique()
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
        .from('comptes_tresorerie')
        .select('id, public_id, type, nom, operateur, numero, warehouse_id')
        .eq('shop_id', s.shopId)
        .eq('est_actif', true)
        .order('type').order('nom')
    if (error) return { erreur: 'Comptes de trésorerie indisponibles.' }

    const voitSoldes = peutVoirSoldes(s.user)
    let soldes = new Map<string, number>()
    if (voitSoldes) {
        const { data: lignes } = await adminClient.rpc('soldes_comptes', { p_shop_id: s.shopId })
        soldes = new Map((lignes ?? []).map((l: { compte_id: string; solde: number }) => [l.compte_id, Number(l.solde)]))
    }

    // La caisse de l'entrepôt par défaut d'abord : c'est elle qu'un
    // formulaire propose quand on ne précise rien.
    const { data: entrepotDefaut } = await adminClient.from('warehouses')
        .select('id').eq('shop_id', s.shopId).eq('est_defaut', true).maybeSingle()
    const tries = [...(data ?? [])].sort((a, b) =>
        Number(b.warehouse_id === entrepotDefaut?.id) - Number(a.warehouse_id === entrepotDefaut?.id))

    return {
        voitSoldes,
        comptes: tries.map(c => ({
            ...c,
            type: c.type as TypeCompte,
            ...(voitSoldes ? { solde: soldes.get(c.id) ?? 0 } : {}),
        })),
    }
}

// ── Créer un compte ───────────────────────────────────────────
export async function creerCompte(formData: FormData): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }

    const type          = nettoyer(formData.get('type')) as TypeCompte
    const nom           = nettoyer(formData.get('nom'))
    const operateur     = nettoyer(formData.get('operateur')) || null
    const banque        = nettoyer(formData.get('banque')) || null
    const numero        = nettoyer(formData.get('numero')) || null
    const reversement   = nettoyer(formData.get('compteReversementId')) || null
    const soldeOuv      = formData.get('soldeOuverture') ? nombre(formData.get('soldeOuverture')) : 0
    const dateOuv       = nettoyer(formData.get('dateOuverture')) || aujourdhui()
    const note          = nettoyer(formData.get('note')) || null

    if (!TYPES_COMPTE.includes(type)) return { erreur: 'Type de compte invalide.' }
    if (type === 'caisse') return { erreur: 'Une caisse POS se crée avec le bouton « Nouvelle caisse POS ».' }
    if (nom.length < 2) return { erreur: 'Donnez un nom au compte.' }
    if (type === 'mobile_money' && !OPERATEURS_MM.some(o => o.code === operateur)) {
        return { erreur: 'Choisissez l\'opérateur Mobile Money.' }
    }
    if ((type === 'mobile_money' || type === 'banque') && !numero) {
        return { erreur: type === 'banque' ? 'Indiquez le numéro de compte.' : 'Indiquez le numéro de téléphone du compte.' }
    }
    if (Number.isNaN(soldeOuv)) return { erreur: 'Solde d\'ouverture invalide.' }
    if (soldeOuv < 0 && type === 'mobile_money') return { erreur: 'Un compte Mobile Money ne peut pas démarrer en négatif.' }
    if (dateOuv > aujourdhui()) return { erreur: 'La date d\'ouverture ne peut pas être dans le futur.' }

    const adminClient = createAdminClient()
    if (reversement) {
        const { data: banqueCible } = await adminClient.from('comptes_tresorerie')
            .select('id').eq('id', reversement).eq('shop_id', s.shopId).eq('type', 'banque').maybeSingle()
        if (!banqueCible) return { erreur: 'Compte de reversement invalide.' }
    }

    const { data: publicId } = await adminClient.rpc('prochain_numero', { p_shop_id: s.shopId, p_prefix: 'CPT' })
    const { data, error } = await adminClient.from('comptes_tresorerie').insert({
        public_id: publicId, shop_id: s.shopId, type, nom,
        operateur: type === 'mobile_money' ? operateur : null,
        banque: type === 'banque' ? banque : null,
        numero,
        compte_reversement_id: type === 'tpe' ? reversement : null,
        solde_ouverture: soldeOuv, date_ouverture: dateOuv, note,
        created_by: s.userId,
    }).select('id').single()

    if (error) {
        return { erreur: error.code === '23505' ? 'Un compte porte déjà ce nom.' : 'Erreur lors de la création du compte.' }
    }

    await journaliserCorrection({
        user: s.user, eventType: 'TRESORERIE_COMPTE_CREE', referenceType: 'compte_tresorerie',
        referenceId: data.id, referencePublicId: publicId,
        modifications: [{ champ: 'solde_ouverture', libelle: 'Solde d\'ouverture', avant: null, apres: soldeOuv }],
    })
    rafraichir()
    return { succes: true, id: data.id }
}

// ── Modifier un compte (correction tracée) ────────────────────
export async function modifierCompte(formData: FormData): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    const adminClient = createAdminClient()

    const id = nettoyer(formData.get('id'))
    const { data: avant } = await adminClient.from('comptes_tresorerie')
        .select('id, public_id, type, nom, operateur, banque, numero, solde_ouverture, date_ouverture, note')
        .eq('id', id).eq('shop_id', s.shopId).maybeSingle()
    if (!avant) return { erreur: 'Compte introuvable.' }

    const apres = {
        nom:             nettoyer(formData.get('nom')),
        operateur:       avant.type === 'mobile_money' ? (nettoyer(formData.get('operateur')) || avant.operateur) : null,
        banque:          avant.type === 'banque' ? (nettoyer(formData.get('banque')) || null) : null,
        numero:          nettoyer(formData.get('numero')) || null,
        solde_ouverture: nombre(formData.get('soldeOuverture')),
        date_ouverture:  nettoyer(formData.get('dateOuverture')),
        note:            nettoyer(formData.get('note')) || null,
    }
    const motif = nettoyer(formData.get('motif'))

    if (apres.nom.length < 2) return { erreur: 'Donnez un nom au compte.' }
    if (Number.isNaN(apres.solde_ouverture)) return { erreur: 'Solde d\'ouverture invalide.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(apres.date_ouverture) || apres.date_ouverture > aujourdhui()) {
        return { erreur: 'Date d\'ouverture invalide.' }
    }

    const modifications = champsModifies(avant, apres, {
        nom: 'Nom', operateur: 'Opérateur', banque: 'Banque', numero: 'Numéro',
        solde_ouverture: 'Solde d\'ouverture', date_ouverture: 'Date d\'ouverture', note: 'Note',
    })
    if (modifications.length === 0) return { succes: true, message: 'Aucun changement.' }
    const toucheAuSolde = modifications.some(m => m.champ === 'solde_ouverture' || m.champ === 'date_ouverture')
    if (toucheAuSolde && motif.length < 3) {
        return { erreur: 'Changer le solde ou la date d\'ouverture est une correction : indiquez-en le motif.' }
    }

    const { error } = await adminClient.from('comptes_tresorerie')
        .update(apres).eq('id', id).eq('shop_id', s.shopId)
    if (error) return { erreur: error.code === '23505' ? 'Un compte porte déjà ce nom.' : 'Erreur lors de la modification.' }

    await journaliserCorrection({
        user: s.user, eventType: 'TRESORERIE_COMPTE_MODIFIE', referenceType: 'compte_tresorerie',
        referenceId: id, referencePublicId: avant.public_id, modifications, motif: motif || null,
    })
    rafraichir(id)
    return { succes: true }
}

// ── Désactiver / réactiver ────────────────────────────────────
export async function changerEtatCompte(id: string, actif: boolean, motif: string): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    const adminClient = createAdminClient()

    const { data: compte } = await adminClient.from('comptes_tresorerie')
        .select('id, public_id, type, est_actif, warehouse_id, est_principale').eq('id', id).eq('shop_id', s.shopId).maybeSingle()
    if (!compte) return { erreur: 'Compte introuvable.' }
    if (compte.est_actif === actif) return { succes: true }
    // (mig 044) une caisse POS se désactive (ses caissières sont libérées) ;
    // la caisse principale, jamais.
    if (!actif && compte.est_principale) return { erreur: 'La caisse principale ne se désactive pas.' }
    if (!actif && compte.type === 'caisse') {
        const { data: ouverte } = await adminClient.from('cash_sessions').select('id')
            .eq('compte_id', id).eq('statut', 'ouverte').maybeSingle()
        if (ouverte) return { erreur: 'Comptez et fermez d’abord la session ouverte de cette caisse.' }
    }
    if (!actif && (motif ?? '').trim().length < 3) return { erreur: 'Indiquez le motif.' }

    if (!actif) {
        const { data: solde } = await adminClient.rpc('solde_compte', { p_compte_id: id })
        if (Number(solde) !== 0) {
            return { erreur: 'Videz d\'abord le compte (virement vers un autre compte) : son solde n\'est pas nul.' }
        }
    }

    const { error } = await adminClient.from('comptes_tresorerie').update({ est_actif: actif }).eq('id', id)
    if (error) return { erreur: messageTresorerie(error.message, 'Erreur lors de la mise à jour.') }
    await journaliserCorrection({
        user: s.user, eventType: actif ? 'TRESORERIE_COMPTE_REACTIVE' : 'TRESORERIE_COMPTE_DESACTIVE',
        referenceType: 'compte_tresorerie', referenceId: id, referencePublicId: compte.public_id,
        motif: (motif ?? '').trim() || null,
    })
    rafraichir(id)
    return { succes: true }
}

// ── Virement entre comptes ────────────────────────────────────
export async function effectuerVirement(formData: FormData): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }

    const source      = nettoyer(formData.get('compteSourceId'))
    const destination = nettoyer(formData.get('compteDestinationId'))
    const montant     = nombre(formData.get('montant'))
    const frais       = formData.get('frais') ? nombre(formData.get('frais')) : 0
    if (!source || !destination) return { erreur: 'Choisissez les deux comptes.' }
    if (Number.isNaN(montant) || montant <= 0) return { erreur: 'Montant invalide.' }
    if (Number.isNaN(frais) || frais < 0) return { erreur: 'Frais invalides.' }

    const { data, error } = await createAdminClient().rpc('effectuer_virement', {
        p_shop_id: s.shopId, p_source_id: source, p_destination_id: destination,
        p_montant: montant, p_frais: frais,
        p_date: nettoyer(formData.get('date')) || aujourdhui(),
        p_reference: nettoyer(formData.get('reference')), p_note: nettoyer(formData.get('note')),
        p_user_id: s.userId,
    })
    if (error || !data?.succes) return { erreur: messageTresorerie(data?.erreur ?? error?.message, 'Le virement n\'a pas pu être enregistré.') }
    rafraichir(source); rafraichir(destination)
    return { succes: true, id: data.id, message: `Virement ${data.public_id} enregistré.` }
}

export async function annulerVirement(id: string, motif: string, compteId?: string): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    const { data, error } = await createAdminClient().rpc('annuler_virement', {
        p_shop_id: s.shopId, p_virement_id: id, p_motif: motif, p_user_id: s.userId,
    })
    if (error || !data?.succes) return { erreur: messageTresorerie(data?.erreur ?? error?.message, 'Annulation impossible.') }
    rafraichir(compteId)
    return { succes: true }
}

// ── Retrait / apport du propriétaire ──────────────────────────
export async function enregistrerOperationProprietaire(formData: FormData): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }

    const compteId = nettoyer(formData.get('compteId'))
    const type     = nettoyer(formData.get('type'))
    const montant  = nombre(formData.get('montant'))
    if (!compteId) return { erreur: 'Choisissez le compte.' }
    if (type !== 'retrait' && type !== 'apport') return { erreur: 'Opération invalide.' }
    if (Number.isNaN(montant) || montant <= 0) return { erreur: 'Montant invalide.' }

    const { data, error } = await createAdminClient().rpc('enregistrer_operation_proprietaire', {
        p_shop_id: s.shopId, p_compte_id: compteId, p_type: type, p_montant: montant,
        p_date: nettoyer(formData.get('date')) || aujourdhui(),
        p_beneficiaire: nettoyer(formData.get('beneficiaire')),
        p_motif: nettoyer(formData.get('motif')), p_reference: nettoyer(formData.get('reference')),
        p_user_id: s.userId,
    })
    if (error || !data?.succes) {
        const brut = data?.erreur ?? error?.message
        return { erreur: brut === 'Indiquez le motif.' ? brut : messageTresorerie(brut, 'L\'opération n\'a pas pu être enregistrée.') }
    }
    rafraichir(compteId)
    return { succes: true, id: data.id, message: `${type === 'retrait' ? 'Retrait' : 'Apport'} ${data.public_id} enregistré.` }
}

export async function annulerOperationProprietaire(id: string, motif: string, compteId?: string): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    const { data, error } = await createAdminClient().rpc('annuler_operation_proprietaire', {
        p_shop_id: s.shopId, p_operation_id: id, p_motif: motif, p_user_id: s.userId,
    })
    if (error || !data?.succes) return { erreur: messageTresorerie(data?.erreur ?? error?.message, 'Annulation impossible.') }
    rafraichir(compteId)
    return { succes: true }
}

// ── Rapprochement ─────────────────────────────────────────────
export async function enregistrerRapprochement(formData: FormData): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }

    const compteId  = nettoyer(formData.get('compteId'))
    const soldeReel = nombre(formData.get('soldeReel'))
    if (!compteId) return { erreur: 'Compte introuvable.' }
    if (Number.isNaN(soldeReel)) return { erreur: 'Indiquez le solde réel.' }

    const { data, error } = await createAdminClient().rpc('enregistrer_rapprochement', {
        p_shop_id: s.shopId, p_compte_id: compteId,
        p_date: nettoyer(formData.get('date')) || aujourdhui(),
        p_solde_reel: soldeReel, p_note: nettoyer(formData.get('note')), p_user_id: s.userId,
    })
    if (error || !data?.succes) return { erreur: messageTresorerie(data?.erreur ?? error?.message, 'Le rapprochement n\'a pas pu être enregistré.') }
    rafraichir(compteId)
    const ecart = Number(data.ecart)
    return {
        succes: true,
        message: ecart === 0 ? 'Aucun écart : le compte est juste.' : `Écart constaté : ${ecart > 0 ? '+' : ''}${ecart.toLocaleString('fr-FR')} F.`,
    }
}

// ══════════════════════════════════════════════════════════════
// Caisses POS (mig 044) : création dans la limite du forfait, et
// affectation des caissières (une caisse par personne).
// ══════════════════════════════════════════════════════════════

export async function creerCaissePOS(formData: FormData): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    const { data, error } = await createAdminClient().rpc('creer_caisse_pos', {
        p_shop_id:      s.shopId,
        p_warehouse_id: nettoyer(formData.get('warehouseId')),
        p_nom:          nettoyer(formData.get('nom')),
        p_user_id:      s.userId,
    })
    if (error) { console.error('ERREUR CAISSE POS:', error); return { erreur: 'La caisse n’a pas pu être créée.' } }
    if (!data?.succes) return { erreur: messageTresorerie(data?.erreur, 'La caisse n’a pas pu être créée.') }
    rafraichir()
    revalidatePath('/pos')
    return { succes: true, id: data.id, message: 'Caisse créée.' }
}

/** Les caissières de cette caisse : les cochées y sont affectées (et
 *  quittent leur ancienne caisse), les décochées n'ont plus de caisse. */
export async function affecterCaissieres(compteId: string, userIds: string[]): Promise<Resultat> {
    const s = await sessionBoutique(PERMISSIONS.TRESORERIE_GERER)
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    const db = createAdminClient()
    const { data: caisse } = await db.from('comptes_tresorerie').select('id, nom')
        .eq('id', compteId).eq('shop_id', s.shopId).eq('type', 'caisse').eq('est_actif', true)
        .not('warehouse_id', 'is', null).maybeSingle()
    if (!caisse) return { erreur: 'Seule une caisse POS active peut recevoir des caissières.' }
    const ids = [...new Set(userIds)]
    if (ids.length) {
        const { data: membres } = await db.from('shop_users').select('id').eq('shop_id', s.shopId).in('id', ids)
        if ((membres ?? []).length !== ids.length) return { erreur: 'Utilisateur introuvable dans cette boutique.' }
    }
    const { error: e1 } = await db.from('caisse_utilisateurs').delete().eq('compte_id', compteId)
        .not('user_id', 'in', `(${ids.length ? ids.join(',') : '00000000-0000-0000-0000-000000000000'})`)
    if (e1) { console.error('ERREUR CAISSIERES:', e1); return { erreur: 'Enregistrement impossible.' } }
    if (ids.length) {
        const { error: e2 } = await db.from('caisse_utilisateurs').upsert(
            ids.map(user_id => ({ user_id, shop_id: s.shopId, compte_id: compteId, affecte_par: s.userId, affecte_le: new Date().toISOString() })),
            { onConflict: 'user_id' })
        if (e2) { console.error('ERREUR CAISSIERES:', e2); return { erreur: messageTresorerie(e2.message, 'Enregistrement impossible.') } }
    }
    rafraichir(compteId)
    revalidatePath('/pos')
    return { succes: true, message: `${ids.length} caissière(s) sur ${caisse.nom}.` }
}
