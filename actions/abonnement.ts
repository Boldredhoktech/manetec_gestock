'use server'

// ═══════════════════════════════════════════════════════════════
// Paiement en ligne de l'abonnement (Lot 3, ABO-02).
//
// SEULES server actions boutique sans `refusAbonnement` : c'est
// précisément ce qu'une boutique expirée doit encore pouvoir faire (D3).
// Elles sont réservées à l'administrateur de la boutique, et le prix
// est TOUJOURS calculé ici depuis le catalogue, jamais reçu du navigateur.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { estAdminComplet } from '@/lib/constants/permissions'
import { estPlan, estDuree, fichePlan, prixPeriode, DUREES } from '@/lib/abonnement/catalogue'
import { refusChangementPlan } from '@/lib/abonnement/quotas'
import { configWidgetKkiapay } from '@/lib/abonnement/kkiapay'
import { confirmerPaiementEnLigne, type IssueConfirmation } from '@/lib/abonnement/confirmation'
import { CHEMIN_ABONNEMENT } from '@/lib/abonnement/regle'

async function sessionAdministrateur() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return null
    if (!estAdminComplet(user.user_metadata?.role)) return null
    return {
        shopId: user.user_metadata.shop_id as string,
        userId: user.user_metadata.user_id as string,
    }
}

export type PaiementPrepare = {
    paiementId: string
    publicId:   string
    montant:    number
    cle:        string
    sandbox:    boolean
    libelle:    string
}

/** Crée le paiement « en attente » AVANT d'ouvrir le widget. */
export async function preparerPaiementAbonnement(
    plan: string,
    duree: string,
): Promise<{ erreur: string } | { paiement: PaiementPrepare }> {
    const session = await sessionAdministrateur()
    if (!session) return { erreur: 'Seul l\'administrateur de la boutique peut payer l\'abonnement.' }

    if (!estPlan(plan) || !estDuree(duree)) return { erreur: 'Plan ou durée inconnus.' }

    const fiche = fichePlan(plan)
    const montant = prixPeriode(plan, duree)
    if (!fiche.payableEnLigne || montant === null) {
        return { erreur: `Le plan ${fiche.label} s'active sur devis : contactez-nous.` }
    }

    const widget = configWidgetKkiapay()
    if (!widget) return { erreur: 'Le paiement en ligne n\'est pas disponible pour le moment.' }

    // D8 : pas de descente si la boutique dépasse les quotas du plan visé.
    const refusQuotas = await refusChangementPlan(session.shopId, plan)
    if (refusQuotas) return { erreur: refusQuotas }

    const admin = createAdminClient()
    const { data: publicId } = await admin.rpc('generate_platform_id', { p_prefix: 'ABO' })
    if (!publicId) return { erreur: 'Le paiement n\'a pas pu être préparé. Réessayez.' }

    const { data: paiement, error } = await admin
        .from('abonnement_paiements')
        .insert({
            public_id:            publicId,
            shop_id:              session.shopId,
            plan,
            duree,
            nb_mois:              DUREES[duree].nbMois,
            montant,
            moyen:                'kkiapay',
            cree_par_utilisateur: session.userId,
        })
        .select('id, public_id')
        .single()

    if (error || !paiement) return { erreur: 'Le paiement n\'a pas pu être préparé. Réessayez.' }

    return {
        paiement: {
            paiementId: paiement.id,
            publicId:   paiement.public_id,
            montant,
            cle:        widget.cle,
            sandbox:    widget.sandbox,
            libelle:    `Abonnement ${fiche.label} — ${DUREES[duree].label}`,
        },
    }
}

/** Appelée quand le widget signale un succès. Vérifie chez KkiaPay avant tout. */
export async function confirmerPaiementAbonnement(
    paiementId: string,
    transactionId: string,
): Promise<IssueConfirmation> {
    const session = await sessionAdministrateur()
    if (!session) return { etat: 'echoue', message: 'Session expirée : reconnectez-vous.' }
    if (!transactionId || typeof transactionId !== 'string') {
        return { etat: 'echoue', message: 'Référence de transaction manquante.' }
    }

    // Le paiement doit appartenir à la boutique de la session.
    const { data: paiement } = await createAdminClient()
        .from('abonnement_paiements')
        .select('id')
        .eq('id', paiementId)
        .eq('shop_id', session.shopId)
        .maybeSingle()
    if (!paiement) return { etat: 'echoue', message: 'Paiement introuvable.' }

    const issue = await confirmerPaiementEnLigne(paiement.id, transactionId.trim(), 'navigateur')
    if (issue.etat === 'reussi') revalidatePath(CHEMIN_ABONNEMENT)
    return issue
}
