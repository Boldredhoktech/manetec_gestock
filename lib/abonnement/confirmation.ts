// lib/abonnement/confirmation.ts
// ═══════════════════════════════════════════════════════════════
// Confirmation d'un paiement en ligne — UN seul chemin pour les deux
// voies d'arrivée (ABO-02) :
//   - le navigateur, quand le widget KkiaPay signale un succès ;
//   - le webhook, filet de sécurité si le navigateur s'est fermé.
// Les deux peuvent arriver, dans n'importe quel ordre, plusieurs fois :
// le traitement est idempotent (prolonger_abonnement ne crédite qu'une
// fois, et une transaction ne peut servir qu'à un seul paiement).
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin'
import { lireTransactionKkiapay } from '@/lib/abonnement/kkiapay'

export type IssueConfirmation =
    | { etat: 'reussi';     periodeFin: string; publicId: string }
    | { etat: 'en_attente'; message: string }
    | { etat: 'echoue';     message: string }

const STATUTS_ECHEC = new Set(['FAILED', 'TRANSACTION_NOT_FOUND', 'INVALID_TRANSACTION', 'REVERTED', 'CANCELLED'])

export async function confirmerPaiementEnLigne(
    paiementId: string,
    transactionId: string,
    origine: 'navigateur' | 'webhook',
): Promise<IssueConfirmation> {
    const admin = createAdminClient()

    const { data: paiement } = await admin
        .from('abonnement_paiements')
        .select('id, public_id, statut, montant, moyen, reference_transaction, periode_fin')
        .eq('id', paiementId)
        .maybeSingle()

    if (!paiement || paiement.moyen !== 'kkiapay') {
        return { etat: 'echoue', message: 'Paiement introuvable.' }
    }
    if (paiement.statut === 'reussi') {
        return { etat: 'reussi', periodeFin: paiement.periode_fin, publicId: paiement.public_id }
    }
    if (paiement.statut !== 'en_attente') {
        return { etat: 'echoue', message: 'Ce paiement a été clos sans succès. Relancez un nouveau paiement.' }
    }

    // La parole du navigateur ou du webhook ne suffit jamais : on relit chez KkiaPay.
    const tx = await lireTransactionKkiapay(transactionId)
    if (!tx) {
        return { etat: 'en_attente', message: 'Le paiement n\'a pas encore pu être vérifié auprès de KkiaPay. Il sera pris en compte automatiquement dès confirmation.' }
    }

    const details = { ...tx.brut, verifie_par: origine, verifie_le: new Date().toISOString() }

    // KkiaPay renvoie dans `state` le `data` passé au widget, c'est-à-dire
    // l'identifiant de NOTRE paiement : une transaction ne confirme que
    // le paiement pour lequel elle a été ouverte.
    if (typeof tx.brut.state === 'string' && tx.brut.state !== '' && tx.brut.state !== paiement.id) {
        console.error(`[ABONNEMENT] transaction ${transactionId} ouverte pour ${tx.brut.state}, présentée pour ${paiement.public_id}`)
        return { etat: 'echoue', message: 'Cette transaction ne correspond pas à ce paiement.' }
    }

    if (tx.statut === 'SUCCESS') {
        // Un paiement réussi d'un montant inférieur au prix ne prolonge rien.
        if (tx.montant === null || tx.montant < Number(paiement.montant)) {
            await clore(paiement.id, 'echoue', transactionId, details,
                `Montant reçu (${tx.montant ?? '?'}) inférieur au prix (${paiement.montant}) : à rembourser.`)
            console.error(`[ABONNEMENT] ${paiement.public_id} : montant KkiaPay ${tx.montant} < ${paiement.montant}`)
            return { etat: 'echoue', message: 'Le montant payé ne correspond pas au prix. Contactez-nous : la somme vous sera remboursée.' }
        }

        const { data: confirme, error } = await admin.rpc('prolonger_abonnement', {
            p_paiement_id:           paiement.id,
            p_reference_transaction: transactionId,
            p_details_prestataire:   details,
        })

        if (error || !confirme) {
            // 23505 : cette transaction a déjà crédité un AUTRE paiement.
            console.error(`[ABONNEMENT] prolongation de ${paiement.public_id} refusée — ${error?.code} ${error?.message}`)
            return { etat: 'echoue', message: 'Cette transaction a déjà été utilisée ou n\'a pas pu être enregistrée. Contactez-nous.' }
        }
        return { etat: 'reussi', periodeFin: confirme.periode_fin, publicId: confirme.public_id }
    }

    // Un échec ne CLÔT pas le paiement : dans le widget, l'utilisateur
    // peut réessayer et réussir avec le même paiement. Le clore ici lui
    // ferait payer sans être crédité.
    if (STATUTS_ECHEC.has(tx.statut)) {
        return { etat: 'echoue', message: 'Le paiement n\'a pas abouti. Aucun montant n\'a été prélevé ; vous pouvez réessayer.' }
    }

    // PENDING ou statut inconnu : on attend le webhook.
    return { etat: 'en_attente', message: 'Le paiement est en cours de traitement chez l\'opérateur. Il sera pris en compte automatiquement.' }
}

async function clore(
    paiementId: string,
    statut: 'echoue',
    transactionId: string | null,
    details: Record<string, unknown> | null,
    motif: string,
) {
    await createAdminClient()
        .from('abonnement_paiements')
        .update({
            statut,
            motif_echec:           motif,
            reference_transaction: transactionId,
            details_prestataire:   details,
        })
        .eq('id', paiementId)
        .eq('statut', 'en_attente')
}
